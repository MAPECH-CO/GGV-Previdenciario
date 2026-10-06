import { beforeEach, describe, expect, it } from 'vitest'
import { obterChecklist } from './checklist.ts'
import { enviarArquivos } from './documentos.ts'
import { obterCrianca, salvarCrianca } from './infantil.ts'
import { arquivarDocumentos, documentosLidos } from './leitura.ts'
import { obterParecer } from './parecer.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
})

const PAULA = { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' }

describe('BPC/LOAS de menor de 16 anos · servidor de exemplo', () => {
  it('CA1 · o Davi, de 7 anos, tem a análise com o roteiro infantil; a Rita, adulta, com o do adulto', async () => {
    const davi = (await obterParecer('davi-exemplo-1', 'juridico'))!.juridico!.analise!
    expect(davi.roteiro).toEqual({ id: 'loas-infantil', nome: 'BPC/LOAS Deficiente · menor de 16 anos', versao: 1 })
    expect(davi.itens.filter((i) => i.tipo === 'obrigatorio').map((i) => [i.id, i.situacao])).toEqual([
      ['natureza', 'presente'],
      ['inicio', 'presente'],
      ['prognostico', 'presente'],
      ['participacao', 'ausente'],
      ['cuidados', 'ausente'],
    ])
    expect(davi.sugestao).toBe('insuficiente')

    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [{ nome: 'laudo.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '8'.padStart(64, '0') }] })
    expect((await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!.analise!.roteiro?.id).toBe('loas-deficiente')
  })

  it('CA2 · sem a condição marcada, o checklist pede o relatório escolar e espera a advogada', async () => {
    const c = (await obterChecklist('davi-exemplo-1'))!.checklist
    expect(c.itens.filter((i) => i.de === 'complementar').map((i) => [i.nome, i.exigencia, i.situacao])).toEqual([['Relatório escolar', 'obrigatorio', 'pendente']])
    expect(c.bloqueio).toBe('A advogada marca a condição da criança no parecer: os relatórios que o caso pede dependem dela.')
  })

  it('CA2 · a advogada marca a condição e as terapias: o checklist pede os relatórios por condição; o histórico não leva a condição', async () => {
    const tela = await salvarCrianca('davi-exemplo-1', { condicoes: ['neurologica'], terapias: ['fono', 'to'] }, PAULA)
    expect(tela.relatorios).toEqual(['Relatório escolar', 'Relatório da neurologia', 'Relatório de fonoaudiologia', 'Relatório de terapia ocupacional'])
    const c = (await obterChecklist('davi-exemplo-1'))!.checklist
    expect(c.itens.filter((i) => i.de === 'complementar').map((i) => i.nome)).toEqual(tela.relatorios)
    expect(c.bloqueio).toBeUndefined()
    expect(c.faltam).toContain('Relatório da neurologia')
    expect((await obterFicha('davi-exemplo'))?.historico.at(-1)).toMatchObject({ quem: 'Dra. Paula (exemplo)', oQue: 'Marcou a condição e as terapias da criança (roteiro infantil)' })
  })

  it('CA2 · o relatório que chega pelo card e é arquivado conta no checklist', async () => {
    await salvarCrianca('davi-exemplo-1', { condicoes: ['saude-mental'], terapias: [] }, PAULA)
    await enviarArquivos('davi-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'relatorio CAPS infantil.pdf', formato: 'pdf', tamanho: 1000, tipo: 'relatorio-caps', hash: '9'.padStart(64, '0') }],
    })
    const lidos = await documentosLidos('davi-exemplo')
    await arquivarDocumentos('davi-exemplo', {
      conferi: true,
      documentos: lidos!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data })),
      duplicados: 'manter',
    })
    const caps = (await obterChecklist('davi-exemplo-1'))!.checklist.itens.find((i) => i.tipo === 'relatorio-caps')
    expect(caps?.situacao).toBe('recebido')
  })

  it('dado de saúde · só o Jurídico marca e vê a condição; os outros veem só os relatórios', async () => {
    await expect(salvarCrianca('davi-exemplo-1', { condicoes: ['saude-mental'], terapias: [] }, { perfil: 'documentacao', nome: 'Jéssica' })).rejects.toThrow('Só o Jurídico')
    await salvarCrianca('davi-exemplo-1', { condicoes: ['saude-mental'], terapias: [] }, PAULA)
    expect(await obterCrianca('davi-exemplo-1', 'documentacao')).toEqual({ infantil: true, idade: 7, relatorios: ['Relatório escolar', 'Relatório do CAPS'] })
    expect((await obterCrianca('davi-exemplo-1', 'advogada'))?.dados?.condicoes).toEqual(['saude-mental'])
  })

  it('o servidor confere de novo: a lista e o caso de menor de 16 anos', async () => {
    await expect(salvarCrianca('rita-exemplo-1', { condicoes: [], terapias: [] }, PAULA)).rejects.toThrow('menor de 16 anos')
    await expect(salvarCrianca('davi-exemplo-1', { condicoes: ['outra' as 'neurologica'], terapias: [] }, PAULA)).rejects.toThrow('fora da lista')
    expect(ler().criancas).toBeUndefined()
    expect(await obterCrianca('rita-exemplo-1', 'advogada')).toEqual({ infantil: false, relatorios: [] })
  })
})
