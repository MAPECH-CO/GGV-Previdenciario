import { beforeEach, describe, expect, it } from 'vitest'
import { problemaG20 } from '../regras/parecer.ts'
import { emVigor } from '../regras/roteiro.ts'
import { decidirComplemento, obterComplemento, registrarTentativaDoComplemento, tarefasDeComplemento, tarefasDeDecidirComplemento } from './complemento.ts'
import { enviarArquivos } from './documentos.ts'
import { obterParecer, registrarParecer } from './parecer.ts'
import { obterRoteiro } from './roteiro.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 6, 15, 10)

beforeEach(() => {
  agora = new Date(2026, 9, 6, 15, 10)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const PAULA = { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' }

/** A advogada confirma a análise como veio e registra a decisão, com o que a IA sugeriu para o médico abordar. */
async function parecer(processoId: string, decisao: 'suficiente' | 'insuficiente') {
  const p = (await obterParecer(processoId, 'juridico'))!.juridico!
  const conferidos = Object.fromEntries(p.analise!.itens.map((i) => [i.id, i.situacao]))
  return registrarParecer(processoId, { analise: p.analise!.quando, conferidos, decisao, abordar: p.abordarSugerido }, PAULA)
}

describe('Complemento ao médico · servidor de exemplo', () => {
  it('CA1, CA2 e CA6 · o parecer Insuficiente da Rita: a orientação em perguntas, sem frase-chave nem conteúdo clínico', async () => {
    await parecer('rita-exemplo-1', 'insuficiente')
    const c = (await obterComplemento('rita-exemplo-1'))!
    expect(c.situacao).toBe('aberto')
    expect(c.complemento.perguntas).toEqual([
      'Qual a previsão de duração do quadro?',
      'O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
    ])
    expect(c.orientacao).toContain('Orientação para o médico de Rita Exemplo')
    expect(c.orientacao).toContain('• Qual a previsão de duração do quadro?')
    for (const item of emVigor((await obterRoteiro('loas-deficiente'))!).itens) expect(c.orientacao).not.toContain(item.texto)
    expect(problemaG20(c.mensagem)).toBeNull()
    // Nada do conteúdo clínico: nem o trecho do laudo, nem o resumo do documento.
    expect(JSON.stringify(c)).not.toContain('Impedimento físico')
    expect(JSON.stringify(c)).not.toContain('trecho')
    expect([c.tentativa, c.proxima, c.urgente]).toEqual([1, '2026-10-06', true])
  })

  it('CA3 · duas tentativas sem resposta sobem para a sênior, que decide uma nova tentativa com prazo', async () => {
    await parecer('rita-exemplo-1', 'insuficiente')
    await registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'chatwoot', resultado: 'sem-resposta' })
    await expect(registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'ligacao', resultado: 'sem-resposta' })).rejects.toThrow('A próxima tentativa é em 09/10')
    expect(tarefasDeComplemento()).toEqual([expect.objectContaining({ prazo: '09/10', detalhe: expect.stringContaining('2ª tentativa') })])
    agora = new Date(2026, 9, 9, 10, 0)
    const depois = await registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'ligacao', resultado: 'sem-resposta' })
    expect(depois.situacao).toBe('na-senior')
    expect(tarefasDeComplemento()[0]).toMatchObject({ prazo: 'na sênior', detalhe: expect.stringContaining('passou do limite: na sênior (G15)') })
    expect(tarefasDeDecidirComplemento()).toEqual([
      expect.objectContaining({ acao: 'Decidir complemento', href: '/casos/rita-exemplo-1/complemento', cliente: { id: 'rita-exemplo', nome: 'Rita Exemplo' } }),
    ])
    await expect(decidirComplemento('rita-exemplo-1', { justificativa: 'cliente está internada', prazo: '2026-10-20' }, PAULA)).rejects.toThrow('Só a sênior')
    const senior = { perfil: 'senior', nome: 'Dra. Renata (exemplo)' }
    await expect(decidirComplemento('rita-exemplo-1', { justificativa: '', prazo: '2026-10-20' }, senior)).rejects.toThrow('justificativa')
    const decidido = await decidirComplemento('rita-exemplo-1', { justificativa: 'cliente está internada', prazo: '2026-10-20' }, senior)
    expect([decidido.situacao, decidido.tentativa, decidido.proxima]).toEqual(['aberto', 3, '2026-10-20'])
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)).toMatchObject({
      quem: 'Dra. Renata (exemplo)',
      oQue: 'Complemento ao médico: a sênior decidiu nova tentativa até 20/10. Justificativa: cliente está internada',
    })
  })

  it('CA3 · com prazo do juiz no caso, o limite é o prazo e a tarefa é urgente', async () => {
    await parecer('antonio-exemplo-1', 'insuficiente').catch(async () => {
      // O laudo novo do Antônio cobre tudo: a advogada corrige um item para registrar o Insuficiente.
      const p = (await obterParecer('antonio-exemplo-1', 'juridico'))!.juridico!
      const conferidos = Object.fromEntries(p.analise!.itens.map((i) => [i.id, i.id === 'reabilitacao' ? 'ausente' : i.situacao]))
      return registrarParecer(
        'antonio-exemplo-1',
        { analise: p.analise!.quando, conferidos, decisao: 'insuficiente', abordar: 'Existe possibilidade de reabilitação para outra atividade? Por quê?' },
        PAULA,
      )
    })
    const c = (await obterComplemento('antonio-exemplo-1'))!
    expect(c.complemento.prazo).toEqual({ de: 'juiz', data: '2026-10-08' })
    expect(c.urgente).toBe(true)
    // A mensagem pede até o dia antes do prazo do juiz.
    expect(c.mensagem).toContain('até 07/10')
  })

  it('CA4 e CA5 · o relatório chega pelo card: a prévia diz que responde ao pedido; o parecer Suficiente encerra a pendência', async () => {
    await parecer('rita-exemplo-1', 'insuficiente')
    agora = new Date(2026, 9, 7, 9, 0)
    await enviarArquivos('rita-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'relatorio medico.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '5'.padStart(64, '0') }],
    })
    const c = (await obterComplemento('rita-exemplo-1'))!
    expect(c.previa).toEqual({
      documentos: ['Laudo médico · 07/10/2026'],
      respondidas: [
        'Qual a previsão de duração do quadro?',
        'O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
      ],
      faltam: [],
    })
    await parecer('rita-exemplo-1', 'suficiente')
    const encerrado = (await obterComplemento('rita-exemplo-1'))!
    expect(encerrado.situacao).toBe('encerrado')
    expect(encerrado.complemento.encerrado).toEqual({ quando: agora.toISOString(), porque: 'parecer-suficiente' })
    expect(tarefasDeComplemento()).toEqual([])
    await expect(registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'chatwoot', resultado: 'sem-resposta' })).rejects.toThrow('encerrado')
  })

  it('sem parecer Insuficiente, não há complemento', async () => {
    expect(await obterComplemento('sebastiao-exemplo-1')).toBeNull()
  })
})
