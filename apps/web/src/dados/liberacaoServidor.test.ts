import { beforeEach, describe, expect, it, vi } from 'vitest'

// GGVP-125, bloco 6: o caso do servidor libera pela rota do servidor. O caso da Rita passa a "ser do servidor" só na hora
// de liberar, para o resto do caminho (checklist e parecer) seguir no exemplo, como no teste da liberação.
const servidor = vi.hoisted(() => ({ ligado: false, aceita: true, chamadas: [] as { caminho: string; corpo: unknown }[] }))
vi.mock('./servidor.ts', async (original) => ({
  ...(await original<typeof import('./servidor.ts')>()),
  doServidor: (id: string) => servidor.ligado && id === 'rita-exemplo-1',
  noBanco: async (caminho: string, init?: { corpo?: unknown }) => {
    servidor.chamadas.push({ caminho, corpo: init?.corpo })
    if (!servidor.aceita) throw new Error('Não dá para liberar ao Jurídico: o parecer médico ainda não foi confirmado (G17).')
    return { ok: true }
  },
}))

const { conferirChecklist } = await import('./checklist.ts')
const { enviarArquivos } = await import('./documentos.ts')
const { arquivarDocumentos, documentosLidos } = await import('./leitura.ts')
const { liberarAoJuridico, obterLiberacao, tarefasDaFilaDaSenior } = await import('./liberacao.ts')
const { obterParecer, registrarParecer } = await import('./parecer.ts')
const { configurarExemplo, zerarExemplo } = await import('./servidor.ts')

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  Object.assign(servidor, { ligado: false, aceita: true, chamadas: [] })
})

async function arquivarTudo(fichaId: string) {
  const c = await documentosLidos(fichaId)
  const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
  await arquivarDocumentos(fichaId, { conferi: true, documentos, duplicados: 'manter' })
}

/** A Rita completa o checklist e a advogada registra "Suficiente", como no teste da liberação. */
async function ritaProntaParaLiberar() {
  await arquivarTudo('rita-exemplo')
  const faltam = ['cpf', 'comprovante-renda', 'cadunico', 'grupo-familiar', 'declaracao-moradia', 'laudo']
  await enviarArquivos('rita-exemplo', {
    origem: 'card',
    arquivos: faltam.map((tipo, i) => ({ nome: `${tipo}.pdf`, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(20 + i).padStart(64, '0') })),
  })
  await arquivarTudo('rita-exemplo')
  await conferirChecklist('rita-exemplo-1')
  const analise = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!.analise!
  await registrarParecer('rita-exemplo-1', { analise: analise.quando, conferidos: Object.fromEntries(analise.itens.map((i) => [i.id, i.situacao])), decisao: 'suficiente' }, { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' })
}

const tudoConferido = { perfil: 'documentacao' as const, conferiChecklist: true, conferiAssinaturas: true }

describe('GGVP-125 · bloco 6: a primeira liberação ao Jurídico no servidor', () => {
  it('o caso do servidor libera pela rota do servidor, e a fila da Sênior daqui não o repete', async () => {
    await ritaProntaParaLiberar()
    servidor.ligado = true
    await liberarAoJuridico('rita-exemplo-1', tudoConferido)
    expect(servidor.chamadas).toEqual([{ caminho: '/casos/rita-exemplo-1/liberacao', corpo: { conferiChecklist: true, conferiAssinaturas: true } }])
    expect(tarefasDaFilaDaSenior()).toEqual([])
  })

  it('o servidor recusa: a tela recebe o motivo, e nada fica liberado aqui', async () => {
    await ritaProntaParaLiberar()
    Object.assign(servidor, { ligado: true, aceita: false })
    await expect(liberarAoJuridico('rita-exemplo-1', tudoConferido)).rejects.toThrow('o parecer médico ainda não foi confirmado (G17)')
    servidor.ligado = false
    expect((await obterLiberacao('rita-exemplo-1'))?.liberacao).toBeUndefined()
  })
})
