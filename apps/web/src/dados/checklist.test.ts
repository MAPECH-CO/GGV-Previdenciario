import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configurarListas, conferirChecklist, obterChecklist, tarefasDeConferirChecklist } from './checklist.ts'
import { enviarArquivos } from './documentos.ts'
import { arquivarDocumentos, documentosLidos } from './leitura.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

afterEach(() => configurarListas())

/** Arquiva tudo o que a IA leu da ficha, como sugeriu, mantendo os duplicados. */
async function arquivarTudo(fichaId: string) {
  const c = await documentosLidos(fichaId)
  const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
  return arquivarDocumentos(fichaId, { conferi: true, documentos, duplicados: 'manter' })
}

const pdf = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })

const situacoes = async (processoId: string) => (await obterChecklist(processoId))?.checklist.itens.map((i) => [i.nome, i.situacao])

describe('Checklist do benefício · servidor de exemplo', () => {
  it('CA1 e CA7 · o LOAS da Rita: contrato, a lista do LOAS, a declaração de moradia que o caso pede e o laudo da entrevista', async () => {
    const caso = await obterChecklist('rita-exemplo-1')
    expect(caso?.beneficio).toBe('LOAS Deficiente')
    expect(caso?.checklist.temLista).toBe(true)
    expect(caso?.checklist.itens.map((i) => [i.nome, i.situacao, i.de])).toEqual([
      ['Contrato assinado (kit)', 'recebido', 'contrato'],
      ['Documento pessoal (RG)', 'pendente', 'beneficio'],
      ['Documento pessoal (CPF)', 'pendente', 'beneficio'],
      ['Comprovante de residência', 'pendente', 'beneficio'],
      ['Comprovante de renda', 'pendente', 'beneficio'],
      ['Cadastro Único (CadÚnico)', 'pendente', 'beneficio'],
      ['Ficha de grupo familiar', 'pendente', 'beneficio'],
      ['Declaração de moradia', 'pendente', 'condicao'],
      ['Laudo médico', 'pendente', 'entrevista'],
    ])
    expect(await obterChecklist('nenhum')).toBeNull()
  })

  it('CA5 e GGVP-81 CA14 · arquivou, o checklist recalcula com o que entrou; a quarentena não conta', async () => {
    await arquivarTudo('rita-exemplo')
    const caso = await obterChecklist('rita-exemplo-1')
    expect(caso?.checklist.completo).toBe(false)
    expect(caso?.checklist.faltam).toEqual([
      'Documento pessoal (CPF)',
      'Comprovante de renda',
      'Cadastro Único (CadÚnico)',
      'Ficha de grupo familiar',
      'Declaração de moradia',
    ])
  })

  it('a Central mostra "Conferir checklist" depois da leitura arquivada, e a conferência fica no histórico', async () => {
    expect(tarefasDeConferirChecklist()).toEqual([])
    await arquivarTudo('rita-exemplo')
    expect(tarefasDeConferirChecklist()).toEqual([
      expect.objectContaining({
        codigo: 'D1.21',
        acao: 'Conferir checklist',
        cliente: { id: 'rita-exemplo', nome: 'Rita Exemplo' },
        detalhe: 'LOAS Deficiente · 4 de 9 itens recebidos · leitura arquivada',
        href: '/casos/rita-exemplo-1/checklist',
      }),
    ])
    const conferencia = await conferirChecklist('rita-exemplo-1')
    expect(conferencia).toMatchObject({ processoId: 'rita-exemplo-1', completo: false })
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Conferiu o checklist do LOAS Deficiente: incompleto; falta: Documento pessoal (CPF), Comprovante de renda, Cadastro Único (CadÚnico), Ficha de grupo familiar e Declaração de moradia',
    )
    expect(tarefasDeConferirChecklist()).toEqual([])
    expect((await obterChecklist('rita-exemplo-1'))?.conferencia).toEqual(conferencia)
  })

  it('CA2 · a ficha de grupo familiar sem assinatura fica pendente (G1); chegou assinada, vale', async () => {
    await arquivarTudo('rita-exemplo')
    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('grupo familiar sem assinatura.pdf', 'grupo-familiar', 1)] })
    await arquivarTudo('rita-exemplo')
    const item = (await obterChecklist('rita-exemplo-1'))?.checklist.itens.find((i) => i.tipo === 'grupo-familiar')
    expect(item).toMatchObject({ situacao: 'pendente', motivo: 'chegou sem assinatura (G1)' })
    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('grupo familiar.pdf', 'grupo-familiar', 2)] })
    await arquivarTudo('rita-exemplo')
    expect((await obterChecklist('rita-exemplo-1'))?.checklist.itens.find((i) => i.tipo === 'grupo-familiar')?.situacao).toBe('recebido')
  })

  it('CA6 · Auxílio Acidentário sem lista aprovada: o checklist não fica completo e a conferência registra o porquê', async () => {
    const caso = await obterChecklist('sebastiao-exemplo-1')
    expect(caso?.checklist).toMatchObject({ temLista: false, completo: false })
    await conferirChecklist('sebastiao-exemplo-1')
    expect((await obterFicha('sebastiao-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Conferiu o checklist do Auxílio Acidentário: sem lista de documentos aprovada para o benefício',
    )
  })

  it('CA8 · o que a entrevista pediu ao Antônio entra no checklist, mesmo sem a lista do benefício', async () => {
    expect(await situacoes('antonio-exemplo-1')).toEqual([
      ['Contrato assinado (kit)', 'recebido'],
      ['Notas do produtor rural', 'pendente'],
      ['Certidão', 'pendente'],
    ])
  })

  it('CA9 e CA10 · com a lista que o escritório montou, o RG que já está na pasta conta no outro processo; o laudo do outro processo não', async () => {
    configurarListas({ 'aposentadoria-especial': { obrigatorios: ['rg', 'laudo'], condicionais: [] } })
    await enviarArquivos('cleide-exemplo', { origem: 'card', arquivos: [pdf('rg.pdf', 'rg', 3), pdf('laudo.pdf', 'laudo', 4)] })
    await arquivarTudo('cleide-exemplo')
    expect(await situacoes('cleide-exemplo-2')).toEqual([
      ['Contrato assinado (kit)', 'recebido'],
      ['Documento pessoal (RG)', 'recebido'],
      ['Laudo médico', 'pendente'],
    ])
    // A Cleide do primeiro processo ainda não assinou o contrato (etapa do contrato).
    expect((await situacoes('cleide-exemplo-1'))?.[0]).toEqual(['Contrato assinado (kit)', 'pendente'])
  })
})
