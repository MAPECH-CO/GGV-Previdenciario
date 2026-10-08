import { beforeEach, describe, expect, it } from 'vitest'
import { obterContrato, simularRetornoDoZapSign } from './contrato.ts'
import { enviarArquivos, receberLote } from './documentos.ts'
import { obterChecklist } from './checklist.ts'
import {
  arquivarDocumentos,
  documentosLidos,
  liberarDaQuarentena,
  moverDocumento,
  relatorioDeQuarentena,
  tarefasDeConferirDocumento,
  tarefasDePedirLegivel,
  usarNoCadastro,
  type Conferencia,
} from './leitura.ts'
import { configurarExemplo, encaminhar, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const ONTEM = '2026-10-04'
const ID = (tipo: string, copia = '') => `rita-exemplo/${tipo} - Rita Exemplo - ${ONTEM}${copia}.pdf`
const RG = ID('RG')
const COMPROVANTE = ID('Comprovante de residencia')
const COPIA = ID('Comprovante de residencia', ' (2)')
const LAUDO = ID('Laudo medico')
const CNIS = ID('CNIS')

/** O que a tela manda ao arquivar: o tipo e a data da IA, sem troca. */
const comoAIASugeriu = (c: Conferencia) => c.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))

async function rita() {
  const c = await documentosLidos('rita-exemplo')
  if (!c) throw new Error('sem conferência')
  return c
}

describe('Ler e arquivar os documentos · servidor de exemplo', () => {
  it('a pilha da Rita: tipo, data e confiança de cada documento, o duplicado e o CNIS de outra pessoa em quarentena', async () => {
    const c = await rita()
    expect(c.processo?.id).toBe('rita-exemplo-1')
    expect(c.documentos.map((d) => [d.id, d.tipo, d.data, d.confianca, d.situacao])).toEqual([
      [RG, 'rg', '2015-03-10', 96, 'a-conferir'],
      [COMPROVANTE, 'comprovante-residencia', '2026-09-12', 91, 'a-conferir'],
      [COPIA, 'comprovante-residencia', '2026-09-12', 74, 'a-conferir'],
      [LAUDO, 'laudo', '2026-08-20', 62, 'a-conferir'],
      [CNIS, 'cnis', '2026-09-30', 88, 'quarentena'],
    ])
    expect(c.documentos.find((d) => d.id === COPIA)?.duplicadoDe).toBe(COMPROVANTE)
    expect(c.documentos.find((d) => d.id === CNIS)?.quarentena).toBe('o nome lido é Antônio Exemplo, não Rita Exemplo')
    // CA11: para a quarentena, o caso da Rita e o do Antônio, cujo nome a IA leu.
    expect(c.destinos.map((d) => d.processoId)).toEqual(['rita-exemplo-1', 'antonio-exemplo-1'])
    expect(await documentosLidos('ninguem')).toBeNull()
  })

  it('a Central mostra "Conferir documento" da Rita, com a quarentena, e a leitura é uma só por arquivo (CA13)', async () => {
    const [tarefa] = tarefasDeConferirDocumento()
    expect(tarefa).toMatchObject({
      codigo: 'D1.18',
      acao: 'Conferir documento',
      cliente: { id: 'rita-exemplo', nome: 'Rita Exemplo' },
      detalhe: 'LOAS Deficiente · 5 documentos lidos pela IA · 1 em quarentena · scanner',
      href: '/clientes/rita-exemplo/conferir-documentos',
      urgente: true,
    })
    tarefasDeConferirDocumento()
    expect((await rita()).documentos).toHaveLength(5)
    expect((await obterFicha('rita-exemplo'))?.arquivos.filter((a) => a.aguardaLeitura)).toHaveLength(5)
  })

  it('CA1 · o papel que a automação guardou entra na leitura, sem refazer o scanner; o lote em revisão não (CA6)', async () => {
    const { tarefa } = await encaminhar({ fichaId: 'antonio-exemplo', motivo: 'documento', setor: 'Documentação · ADM' })
    await receberLote(tarefa.id)
    const c = await documentosLidos('antonio-exemplo')
    expect(c?.documentos.map((d) => [d.tipo, d.origem, d.situacao, d.lidos])).toEqual([
      ['comprovante-residencia', 'scanner', 'a-conferir', { nome: 'Antônio Exemplo', endereco: 'Rua Exemplo, 100 · São Paulo/SP' }],
      ['cnis', 'scanner', 'a-conferir', { nome: 'Antônio Exemplo', cpf: '00000000191' }],
    ])
    const natalia = await encaminhar({ fichaId: 'natalia-exemplo', motivo: 'documento', setor: 'Documentação · ADM' })
    expect((await receberLote(natalia.tarefa.id)).status).toBe('revisao')
    expect((await documentosLidos('natalia-exemplo'))?.documentos).toEqual([])
  })

  it('CA2 e CA9 · o digital do card vai para a leitura; o mesmo conteúdo de novo vira duplicado apontado', async () => {
    const pdf = { nome: 'rg.pdf', formato: 'pdf' as const, tamanho: 1000, tipo: 'rg', hash: '1'.padStart(64, '0') }
    await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf] })
    await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf] })
    const docs = (await documentosLidos('maria-exemplo'))?.documentos
    expect(docs?.map((d) => [d.arquivo, d.origem, d.duplicadoDe])).toEqual([
      ['rg.pdf', 'card', undefined],
      ['rg (2).pdf', 'card', 'maria-exemplo/rg.pdf'],
    ])
  })

  it('CA7, CA9 e CA14 · "Arquivar" grava o tipo trocado, descarta a cópia menos legível e tira a tarefa da Central', async () => {
    const c = await rita()
    const escolhas = comoAIASugeriu(c).map((d) => (d.id === LAUDO ? { ...d, data: '2026-08-21' } : d))
    await expect(arquivarDocumentos('rita-exemplo', { conferi: true, documentos: escolhas })).rejects.toThrow('Decida o que fazer com o documento duplicado')
    const resposta = await arquivarDocumentos('rita-exemplo', { conferi: true, documentos: escolhas, duplicados: 'descartar' })
    expect(resposta).toMatchObject({ arquivados: 3, descartados: 1, contrato: false, processoId: 'rita-exemplo-1' })
    expect(resposta.evento.oQue).toBe(
      'Arquivou 3 documentos lidos pela IA (Documento pessoal (RG), Comprovante de residência, Laudo médico); descartou 1 cópia menos legível (o original fica guardado); conferiu a leitura',
    )
    const ficha = await obterFicha('rita-exemplo')
    const laudo = ficha?.arquivos.find((a) => a.tipo === 'laudo')
    expect(laudo).toMatchObject({ local: 'rita-exemplo-1', aguardaLeitura: false })
    // CA9 e CA13: a cópia descartada continua guardada, marcada como repetida.
    expect(ficha?.arquivos.find((a) => a.nome.endsWith('(2).pdf'))).toMatchObject({ repetido: true, aguardaLeitura: false })
    // Fica só a quarentena.
    expect((await rita()).documentos.map((d) => d.id)).toEqual([CNIS])
    expect(tarefasDeConferirDocumento()[0].detalhe).toBe('LOAS Deficiente · 1 documento lidos pela IA · 1 em quarentena · scanner')
  })

  it('CA7 · reclassificar: o tipo que a pessoa escolheu vale, e muda a pasta', async () => {
    const c = await rita()
    const escolhas = comoAIASugeriu(c).map((d) => (d.id === LAUDO ? { ...d, tipo: 'receita' } : d.id === RG ? { ...d, tipo: 'certidao' } : d))
    await arquivarDocumentos('rita-exemplo', { conferi: true, documentos: escolhas, duplicados: 'manter' })
    const tipos = (await obterFicha('rita-exemplo'))?.arquivos.map((a) => [a.tipo, a.local, a.repetido])
    expect(tipos).toEqual([
      ['certidao', 'pessoais', false],
      ['comprovante-residencia', 'pessoais', false],
      ['comprovante-residencia', 'pessoais', false],
      ['receita', 'rita-exemplo-1', false],
      ['cnis', 'pessoais', false],
    ])
  })

  it('o servidor recusa sem a conferência, com a lista mudada e com tipo ou data inválidos', async () => {
    const c = await rita()
    const escolhas = comoAIASugeriu(c)
    // @ts-expect-error a conferência é obrigatória
    await expect(arquivarDocumentos('rita-exemplo', { conferi: false, documentos: escolhas, duplicados: 'manter' })).rejects.toThrow('Confira')
    await expect(arquivarDocumentos('rita-exemplo', { conferi: true, documentos: escolhas.slice(1), duplicados: 'manter' })).rejects.toThrow('A conferência mudou')
    const errada = escolhas.map((d, i) => (i === 0 ? { ...d, data: '2026-02-31' } : d))
    await expect(arquivarDocumentos('rita-exemplo', { conferi: true, documentos: errada, duplicados: 'manter' })).rejects.toThrow('Tipo ou data inválidos')
  })

  it('CA16 · documento médico não se descarta, nem como cópia menos legível', async () => {
    const c = await rita()
    // A pessoa diz que a cópia do comprovante é um laudo: a cópia que sairia é documento médico.
    const escolhas = comoAIASugeriu(c).map((d) => (d.id === COPIA ? { ...d, tipo: 'laudo' } : d))
    await expect(arquivarDocumentos('rita-exemplo', { conferi: true, documentos: escolhas, duplicados: 'descartar' })).rejects.toThrow(
      'Documento médico não se descarta',
    )
    expect((await rita()).documentos).toHaveLength(5)
  })

  it('CA4 · contrato assinado lido segue para a verificação do contrato', async () => {
    const contrato = { nome: 'contrato assinado.pdf', formato: 'pdf' as const, tamanho: 1000, tipo: 'contrato', hash: '2'.padStart(64, '0') }
    await enviarArquivos('sebastiao-exemplo', { origem: 'card', arquivos: [contrato] })
    const c = await documentosLidos('sebastiao-exemplo')
    const resposta = await arquivarDocumentos('sebastiao-exemplo', { conferi: true, documentos: comoAIASugeriu(c!) })
    expect(resposta.contrato).toBe(true)
    expect((await obterFicha('sebastiao-exemplo'))?.historico.at(-1)?.oQue).toBe('O contrato assinado segue para a verificação do contrato (D1.19)')
  })

  it('CA4 · o contrato que esperava a leitura sai dela quando a Documentação arquiva o assinado (junção com a GGVP-85)', async () => {
    await simularRetornoDoZapSign('nair-exemplo-1')
    expect((await obterContrato('nair-exemplo-1'))?.contrato.etapa).toBe('leitura')
    const c = await documentosLidos('nair-exemplo')
    const resposta = await arquivarDocumentos('nair-exemplo', { conferi: true, documentos: comoAIASugeriu(c!) })
    expect(resposta.contrato).toBe(true)
    expect((await obterContrato('nair-exemplo-1'))?.contrato.etapa).toBe('copia')
    const assinado = (await obterFicha('nair-exemplo'))?.arquivos.find((a) => a.tipo === 'contrato')
    expect(assinado?.local).toBe('nair-exemplo-1')
  })

  it('CA3 e CA8 · o cadastro só muda com "Usar no cadastro", e o histórico não guarda o valor', async () => {
    expect((await obterFicha('rita-exemplo'))?.nome).toBe('Rita Exemplo')
    await rita()
    const ficha = await usarNoCadastro(RG, 'nome')
    expect(ficha.nome).toBe('Rita de Cássia Exemplo')
    expect(ficha.historico.at(-1)?.oQue).toBe('Atualizou o nome do cadastro com o que a IA leu (Documento pessoal (RG))')
    expect((await usarNoCadastro(RG, 'rg')).rg).toBe('000000000') // só letras e números, como o cadastro (GGVP-43)
    expect((await usarNoCadastro(COMPROVANTE, 'endereco')).endereco).toBe('Rua Exemplo, 100 · São Paulo/SP')
    await expect(usarNoCadastro(LAUDO, 'cpf')).rejects.toThrow('A IA não leu este dado')
    // CA10: dado de quem está em quarentena não entra no cadastro.
    await expect(usarNoCadastro(CNIS, 'cpf')).rejects.toThrow('quarentena')
  })

  it('CA10 · "É deste cliente" tira da quarentena, e o documento volta à conferência', async () => {
    await rita()
    await liberarDaQuarentena(CNIS)
    expect((await rita()).documentos.find((d) => d.id === CNIS)?.situacao).toBe('a-conferir')
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toContain('Conferiu o documento em quarentena (CNIS:')
    await expect(liberarDaQuarentena(CNIS)).rejects.toThrow('não está em quarentena')
  })

  it('CA11 · mover sem motivo é recusado no servidor; com motivo, vai para a pasta do outro caso e fica nas duas fichas', async () => {
    await rita()
    await expect(moverDocumento(CNIS, { processoId: 'antonio-exemplo-1', motivo: '  ' })).rejects.toThrow('Informe o motivo para mover o documento')
    expect((await rita()).documentos.find((d) => d.id === CNIS)?.situacao).toBe('quarentena')

    const { evento } = await moverDocumento(CNIS, { processoId: 'antonio-exemplo-1', motivo: 'veio na pilha da Rita' })
    expect(evento.oQue).toBe('Moveu CNIS para o caso Aposentadoria por Incapacidade Permanente de Antônio Exemplo. Motivo: veio na pilha da Rita')
    expect((await rita()).documentos.map((d) => d.id)).not.toContain(CNIS)
    expect((await obterFicha('rita-exemplo'))?.arquivos.some((a) => a.tipo === 'cnis')).toBe(false)
    const antonio = await obterFicha('antonio-exemplo')
    expect(antonio?.historico.at(-1)?.oQue).toBe('Recebeu CNIS vindo da pasta de Rita Exemplo. Motivo: veio na pilha da Rita')
    // Na pasta do Antônio, a leitura agora bate com o dono: vai para a conferência dele.
    expect((await documentosLidos('antonio-exemplo'))?.documentos.map((d) => [d.tipo, d.situacao])).toEqual([['cnis', 'a-conferir']])
    await expect(moverDocumento(CNIS, { processoId: 'nenhum', motivo: 'teste' })).rejects.toThrow()
  })

  it('CA12 · o relatório traz a quarentena com mais de um dia', async () => {
    await rita()
    expect(relatorioDeQuarentena()).toEqual([])
    agora = new Date(2026, 9, 5, 18, 0)
    expect(relatorioDeQuarentena().map((r) => [r.documento.id, r.cliente])).toEqual([[CNIS, 'Rita Exemplo']])
  })

  describe('GGVP-95 · documento médico', () => {
    const pdf = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })

    it('CA1 e CA6 · o laudo da Rita: tipo, data de emissão, médico, registro e a confiança baixa para conferir com atenção', async () => {
      const laudo = (await rita()).documentos.find((d) => d.id === LAUDO)!
      expect([laudo.tipo, laudo.data, laudo.emitente, laudo.registro, laudo.confianca]).toEqual(['laudo', '2026-08-20', 'Dra. Exemplo Neurologista', 'CRM-SP 000000', 62])
      // O que não é documento médico não ganha emitente.
      expect((await rita()).documentos.find((d) => d.id === RG)?.emitente).toBeUndefined()
    })

    it('CA4 · o laudo novo que sobe pelo card é lido e classificado como os demais', async () => {
      await enviarArquivos('antonio-exemplo', { origem: 'card', arquivos: [pdf('laudo ortopedia.pdf', 'laudo', 7), pdf('atestado.pdf', 'atestado', 8)] })
      const docs = (await documentosLidos('antonio-exemplo'))!.documentos
      expect(docs.map((d) => [d.arquivo, d.tipo, d.emitente, d.registro, d.situacao])).toEqual([
        ['laudo ortopedia.pdf', 'laudo', 'Dr. Exemplo Silva', 'CRM-SP 000000', 'a-conferir'],
        ['atestado.pdf', 'atestado', 'Dr. Exemplo Silva', 'CRM-SP 000000', 'a-conferir'],
      ])
      expect((await obterFicha('antonio-exemplo'))?.laudoNovoEm).toBe('2026-10-05')
    })

    it('CA2 · a classificação corrigida vale e fica no histórico, com o que a IA tinha sugerido', async () => {
      const escolhas = comoAIASugeriu(await rita()).map((d) => (d.id === LAUDO ? { ...d, tipo: 'relatorio-medico' } : d))
      await arquivarDocumentos('rita-exemplo', { conferi: true, documentos: escolhas, duplicados: 'manter' })
      const ficha = await obterFicha('rita-exemplo')
      expect(ficha?.arquivos.find((a) => a.nome.startsWith('Laudo medico'))?.tipo).toBe('relatorio-medico')
      expect(ficha?.historico.map((e) => e.oQue)).toContain(
        `Corrigiu a classificação de Laudo medico - Rita Exemplo - ${ONTEM}.pdf: a IA sugeriu Laudo médico; ficou Relatório médico`,
      )
    })

    it('CA3 · a leitura que falha vira "Pedir documento legível" no Atendimento; o original fica; o legível que chega fecha a pendência', async () => {
      await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf('laudo ilegivel.pdf', 'laudo', 9)] })
      const c = (await documentosLidos('maria-exemplo'))!
      expect(c.documentos).toEqual([])
      expect(c.ilegiveis.map((d) => [d.arquivo, d.situacao, d.confianca])).toEqual([['laudo ilegivel.pdf', 'ilegivel', 0]])
      expect((await obterFicha('maria-exemplo'))?.arquivos.map((a) => a.nome)).toEqual(['laudo ilegivel.pdf'])
      expect(tarefasDePedirLegivel()).toEqual([
        expect.objectContaining({
          acao: 'Pedir documento legível',
          cliente: { id: 'maria-exemplo', nome: 'Maria Exemplo' },
          detalhe: 'Laudo médico de 05/10 · a leitura falhou: pedir o reenvio legível ao cliente',
          href: '/clientes/maria-exemplo',
        }),
      ])
      agora = new Date(2026, 9, 5, 16, 0)
      await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf('laudo novo.pdf', 'laudo', 10)] })
      expect(tarefasDePedirLegivel()).toEqual([])
      expect((await documentosLidos('maria-exemplo'))!.ilegiveis).toEqual([])
    })

    it('CA5 · o documento médico de outra pessoa fica em quarentena, fora do checklist', async () => {
      await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('cnis.pdf', 'cnis', 11)] })
      const doc = (await rita()).documentos.find((d) => d.id === CNIS)!
      expect(doc.situacao).toBe('quarentena')
    })

    it('CA7 e CA9 · o laudo duplicado não sai nem como cópia; o original fica na pasta', async () => {
      await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf('laudo.pdf', 'laudo', 12)] })
      await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf('laudo.pdf', 'laudo', 12)] })
      const docs = comoAIASugeriu((await documentosLidos('maria-exemplo'))!)
      await expect(arquivarDocumentos('maria-exemplo', { conferi: true, documentos: docs, duplicados: 'descartar' })).rejects.toThrow(
        'Documento médico não se descarta',
      )
      expect((await obterFicha('maria-exemplo'))?.arquivos.map((a) => a.nome)).toEqual(['laudo.pdf', 'laudo (2).pdf'])
    })

    it('CA8 e CA10 · ler de novo não duplica, e arquivar o laudo recalcula o checklist', async () => {
      await rita()
      expect((await rita()).documentos.filter((d) => d.tipo === 'laudo')).toHaveLength(1)
      const antes = (await obterChecklist('rita-exemplo-1'))!.checklist.faltam
      expect(antes).toContain('Laudo médico')
      await arquivarDocumentos('rita-exemplo', { conferi: true, documentos: comoAIASugeriu(await rita()), duplicados: 'manter' })
      expect((await obterChecklist('rita-exemplo-1'))!.checklist.faltam).not.toContain('Laudo médico')
    })
  })
})
