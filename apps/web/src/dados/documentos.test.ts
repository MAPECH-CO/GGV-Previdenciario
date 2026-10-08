import { beforeEach, describe, expect, it } from 'vitest'
import {
  SCANNER,
  enviarArquivos,
  obterTarefa,
  pastaDoProcesso,
  receberLote,
  registrarRecebimento,
  resumosParaOJuridico,
  tarefasDeCompletarTelefone,
} from './documentos.ts'
import { telefoneDeExemplo } from './exemplo.ts'
import { configurarExemplo, encaminhar, gravar, ler, obterFicha, salvarFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'
import type { ArquivoParaEnviar } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

/** Um arquivo já conferido na janela; `n` faz o conteúdo (o SHA-256) diferente. */
const arquivo = (nome: string, tipo: string, n: number, formato: ArquivoParaEnviar['formato'] = 'pdf'): ArquivoParaEnviar => ({
  nome,
  formato,
  tamanho: 1000,
  tipo,
  hash: n.toString(16).padStart(64, '0'),
})
const pelaFicha = (fichaId: string, ...arquivos: ArquivoParaEnviar[]) => enviarArquivos(fichaId, { origem: 'card', arquivos })

const entregar = (fichaId: string) => encaminhar({ fichaId, motivo: 'documento', setor: 'Documentação · ADM' })

describe('Receber documento · servidor de exemplo', () => {
  it('CA1 e CA3 · "Entregar documento" dá à Documentação a tarefa com o nome do cliente, ligada ao caso', async () => {
    const { tarefa, evento } = await entregar('antonio-exemplo')
    expect(tarefa).toMatchObject({
      codigo: 'D1.02',
      acao: 'Receber documento',
      cliente: { id: 'antonio-exemplo', nome: 'Antônio Exemplo' },
      setor: 'Documentação · ADM',
      processoId: 'antonio-exemplo-1',
      href: `/balcao/documento/${tarefa.id}`,
    })
    expect(tarefa.detalhe).toBe('Aposentadoria por Incapacidade Permanente · Judicial · exigência · chegou ao balcão às 14:32')
    expect(evento.oQue).toBe('Encaminhou à Documentação · ADM para receber documento, ligado ao caso Aposentadoria por Incapacidade Permanente')
    expect(tarefasDoSetor('Documentação · ADM').map((t) => t.id)).toEqual([tarefa.id])
    expect((await obterTarefa(tarefa.id))?.ficha.nome).toBe('Antônio Exemplo')
    expect(await obterTarefa('nenhuma')).toBeNull()
  })

  it('CA2 · o scanner guarda o PDF na pasta do cliente com o nome "Tipo - Nome - data", e segue para a leitura', async () => {
    const { tarefa } = await entregar('rita-exemplo')
    const lote = await receberLote(tarefa.id)
    expect(lote).toMatchObject({ status: 'arquivado', motivo: 'nome igual', fichaId: 'rita-exemplo', conferirPapel: false })
    const rita = await obterFicha('rita-exemplo')
    expect(rita?.arquivos.map((a) => a.nome)).toEqual([
      'Comprovante de residencia - Rita Exemplo - 2026-10-05.pdf',
      'CNIS - Rita Exemplo - 2026-10-05.pdf',
    ])
    expect(rita?.arquivos.every((a) => a.origem === 'scanner' && a.aguardaLeitura && a.local === 'pessoais')).toBe(true)
    expect(rita?.historico.at(-1)).toMatchObject({ quem: SCANNER, oQue: 'Guardou 2 documentos na pasta do Drive, em PDF pesquisável' })

    await receberLote(tarefa.id)
    expect((await obterFicha('rita-exemplo'))?.arquivos.at(-1)?.nome).toBe('CNIS - Rita Exemplo - 2026-10-05 (2).pdf')
  })

  it('CA4 · sem pasta e sem CPF no papel, o lote vai para "A REVISAR" com o motivo e não mexe na ficha', async () => {
    const { tarefa } = await entregar('natalia-exemplo')
    const lote = await receberLote(tarefa.id)
    expect(lote.status).toBe('revisao')
    expect(lote.motivo).toBe('não existe pasta parecida, mas o CPF dessa pessoa não está escrito no papel')
    expect(lote.fichaId).toBeUndefined()
    const natalia = await obterFicha('natalia-exemplo')
    expect(natalia?.arquivos).toEqual([])
    expect(natalia?.historico.some((e) => e.quem === SCANNER)).toBe(false)
  })

  it('CA5 e CA10 · "Registrar" só com o lote, o tipo conferido e, com "CONFERIR O PAPEL", o papel conferido', async () => {
    const { tarefa } = await entregar('antonio-exemplo')
    const papel = { forma: 'papel', conferiTipos: true, conferiPapel: false } as const
    await expect(registrarRecebimento(tarefa.id, papel)).rejects.toThrow('O lote do scanner ainda não chegou')
    expect((await receberLote(tarefa.id)).conferirPapel).toBe(true)
    await expect(registrarRecebimento(tarefa.id, { ...papel, conferiTipos: false as true })).rejects.toThrow('Confira o tipo')
    await expect(registrarRecebimento(tarefa.id, papel)).rejects.toThrow('Confira o papel')
    await expect(registrarRecebimento(tarefa.id, { forma: 'digital', conferiTipos: true, conferiPapel: false })).rejects.toThrow('Nenhum arquivo')

    const { evento } = await registrarRecebimento(tarefa.id, { ...papel, conferiPapel: true })
    expect(evento.oQue).toBe('Registrou o recebimento de 2 documentos em papel, pelo scanner; conferiu o tipo de cada documento')
    expect(tarefasDoSetor('Documentação · ADM')).toEqual([])
    await expect(registrarRecebimento(tarefa.id, { ...papel, conferiPapel: true })).rejects.toThrow('já foi registrada')
  })

  it('CA15 · a ficha que o scanner criou sem telefone pede "Completar telefone" até alguém completar', async () => {
    expect((await obterFicha('marta-exemplo'))?.telefone).toBe('')
    expect(tarefasDeCompletarTelefone()).toEqual([
      expect.objectContaining({ acao: 'Completar telefone', cliente: { id: 'marta-exemplo', nome: 'Marta Exemplo' }, href: '/clientes/marta-exemplo' }),
    ])
    await salvarFicha('marta-exemplo', { nome: 'Marta Exemplo', telefone: telefoneDeExemplo(6) })
    expect(tarefasDeCompletarTelefone()).toEqual([])
  })

  it('GGVP-29 CA5 · relatório médico e prontuário também são laudo novo; atestado e exame, não', async () => {
    expect(await pelaFicha('rita-exemplo', arquivo('atestado.pdf', 'atestado', 1), arquivo('exame.pdf', 'exame', 2))).toMatchObject({ laudoNovo: false })
    expect(await pelaFicha('rita-exemplo', arquivo('relatorio medico.pdf', 'relatorio-medico', 3))).toMatchObject({ laudoNovo: true })
    expect((await obterFicha('rita-exemplo'))?.processos[0].laudoNovoEm).toBe('2026-10-05')
  })

  it('CA6, CA7 e CA9 · laudo novo marca a ficha e o processo, a IA resume só para o Jurídico e a advogada recebe a tarefa', async () => {
    const resposta = await pelaFicha('antonio-exemplo', arquivo('laudo_ortopedia_set2026.pdf', 'laudo', 1))
    expect(resposta).toMatchObject({ resultado: 'enviado', laudoNovo: true })
    const antonio = await obterFicha('antonio-exemplo')
    expect(antonio?.laudoNovoEm).toBe('2026-10-05')
    expect(antonio?.processos[0].laudoNovoEm).toBe('2026-10-05')
    expect(antonio?.historico.at(-1)?.oQue).toBe('Subiu laudo novo pelo card; enviado ao Jurídico para análise')
    expect(tarefasDoSetor('Jurídico')).toEqual([
      expect.objectContaining({ codigo: 'D1.21M', acao: 'Analisar laudo novo', processoId: 'antonio-exemplo-1', cliente: { id: 'antonio-exemplo', nome: 'Antônio Exemplo' } }),
    ])
    expect(resumosParaOJuridico('antonio-exemplo')).toHaveLength(1)
    expect(JSON.stringify(antonio)).not.toContain(resumosParaOJuridico('antonio-exemplo')[0].resumo)
  })

  it('CA13 · nome repetido entra como "(2)", o mesmo conteúdo fica "repetido" e foto entra como foto', async () => {
    await pelaFicha('rita-exemplo', arquivo('rg.jpg', 'rg', 1, 'jpg'))
    const resposta = await pelaFicha('rita-exemplo', arquivo('rg.jpg', 'rg', 1, 'jpg'), arquivo('rg.jpg', 'rg', 2, 'jpg'))
    if (resposta.resultado !== 'enviado') throw new Error(resposta.resultado)
    expect(resposta.arquivos.map((a) => [a.nome, a.repetido])).toEqual([
      ['rg (2).jpg', true],
      ['rg (3).jpg', false],
    ])
    expect((await obterFicha('rita-exemplo'))?.arquivos).toHaveLength(3)
    await expect(pelaFicha('rita-exemplo', arquivo('video.mp4', 'outro', 3))).rejects.toThrow('Arquivos inválidos')
    await expect(pelaFicha('rita-exemplo', { ...arquivo('grande.pdf', 'outro', 4), tamanho: 20 * 1024 * 1024 + 1 })).rejects.toThrow()
  })

  it('CA14 · documento pessoal vai para Documentos pessoais; laudo, para a subpasta do processo', async () => {
    await pelaFicha('antonio-exemplo', arquivo('rg.pdf', 'rg', 1), arquivo('laudo.pdf', 'laudo', 2))
    const pasta = await pastaDoProcesso('antonio-exemplo-1')
    expect(pasta?.pessoais.map((a) => a.nome)).toEqual(['rg.pdf'])
    expect(pasta?.processo.map((a) => a.nome)).toEqual(['laudo.pdf'])
    expect(await pastaDoProcesso('nenhum')).toBeNull()
  })

  it('CA11 · sem pasta na ficha, acha a que existe pelo CPF; sem pasta e sem CPF, não cria', async () => {
    expect(await pelaFicha('natalia-exemplo', arquivo('rg.pdf', 'rg', 1))).toEqual({ resultado: 'sem-pasta' })
    expect((await obterFicha('natalia-exemplo'))?.arquivos).toEqual([])

    const banco = ler()
    const antonio = banco.fichas.find((f) => f.id === 'antonio-exemplo')!
    antonio.pastaId = undefined
    gravar(banco)
    const quantas = ler().pastas.length
    await pelaFicha('antonio-exemplo', arquivo('rg.pdf', 'rg', 1))
    expect((await obterFicha('antonio-exemplo'))?.pastaId).toBe('drive-antonio-exemplo')
    expect(ler().pastas).toHaveLength(quantas)

    const semPasta = ler()
    semPasta.fichas.find((f) => f.id === 'antonio-exemplo')!.pastaId = undefined
    semPasta.pastas = semPasta.pastas.filter((p) => p.id !== 'drive-antonio-exemplo')
    gravar(semPasta)
    await pelaFicha('antonio-exemplo', arquivo('cnis.pdf', 'cnis', 2))
    expect(ler().pastas.find((p) => p.id === 'drive-antonio-exemplo')).toMatchObject({ caminho: 'Clientes/2026' })
  })
})
