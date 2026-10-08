import { beforeEach, describe, expect, it } from 'vitest'
import { conferirChecklist } from './checklist.ts'
import { adiarCobranca, decidirCobranca, obterCobranca, registrarTentativa, tarefasDeCobrar, tarefasDeDecidirCobranca } from './cobranca.ts'
import { enviarArquivos } from './documentos.ts'
import { arquivarDocumentos, documentosLidos } from './leitura.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const ultimoEvento = async (fichaId: string) => (await obterFicha(fichaId))?.historico.at(-1)?.oQue

describe('Cobrar os documentos pendentes · servidor de exemplo', () => {
  it('CA1 e CA4 · a conferência incompleta abre a cobrança com o que falta, e a primeira tentativa é hoje', async () => {
    expect(await obterCobranca('rita-exemplo-1')).toBeNull()
    await conferirChecklist('rita-exemplo-1')
    const c = await obterCobranca('rita-exemplo-1')
    expect(c).toMatchObject({ situacao: 'aberta', proxima: '2026-10-05', tentativa: 1, urgente: true, motivoParado: null })
    expect(c?.faltam).toHaveLength(8)
    expect(await ultimoEvento('rita-exemplo')).toContain('Abriu a cobrança das pendências do checklist para o Atendimento: Documento pessoal (RG)')
    expect(tarefasDeCobrar().find((t) => t.cliente?.id === 'rita-exemplo')).toMatchObject({
      codigo: 'D1.23',
      acao: 'Cobrar documento',
      detalhe: 'LOAS Deficiente · Documento pessoal (RG), Documento pessoal (CPF) e mais 6 pendentes · 1ª tentativa',
      prazo: 'vence hoje',
      urgente: true,
      href: '/casos/rita-exemplo-1/cobranca',
    })
  })

  it('CA3, CA5 e CA6 · cada tentativa guarda data, canal e resultado; a próxima só depois de 3 dias; a segunda sem resposta vai à sênior', async () => {
    await conferirChecklist('rita-exemplo-1')
    const primeira = await registrarTentativa('rita-exemplo-1', { canal: 'chatwoot', resultado: 'sem-resposta' })
    expect(primeira.cobranca.tentativas).toEqual([{ dia: '2026-10-05', canal: 'chatwoot', resultado: 'sem-resposta', quem: 'Você (Atendimento)' }])
    expect(primeira).toMatchObject({ proxima: '2026-10-08', tentativa: 2, urgente: false, motivoParado: 'A próxima tentativa é em 08/10, 3 dias depois da última.' })
    expect(tarefasDeCobrar().find((t) => t.cliente?.id === 'rita-exemplo')?.prazo).toBe('lembrete 08/10')
    await expect(registrarTentativa('rita-exemplo-1', { canal: 'ligacao', resultado: 'sem-resposta' })).rejects.toThrow('A próxima tentativa é em 08/10')

    agora = new Date(2026, 9, 8, 10, 0)
    expect(tarefasDeCobrar().find((t) => t.cliente?.id === 'rita-exemplo')).toMatchObject({ prazo: 'vence hoje', urgente: true })
    const segunda = await registrarTentativa('rita-exemplo-1', { canal: 'ligacao', resultado: 'sem-resposta' })
    expect(segunda.situacao).toBe('na-senior')
    expect(await ultimoEvento('rita-exemplo')).toBe('A cobrança passou do limite de 2 tentativas: foi para a advogada sênior decidir (G15)')
    // CA7: continua à vista do Atendimento, e a sênior recebe a decisão.
    expect(tarefasDeCobrar().find((t) => t.cliente?.id === 'rita-exemplo')).toMatchObject({ prazo: 'na sênior', urgente: false })
    expect(tarefasDeDecidirCobranca().map((t) => t.cliente?.nome)).toContain('Rita Exemplo')
  })

  it('CA7 e CA12 · a semente do Antônio: prazo do juiz, duas tentativas sem resposta, na sênior', async () => {
    const c = await obterCobranca('antonio-exemplo-1')
    expect(c?.situacao).toBe('na-senior')
    expect(c?.cobranca.prazo).toEqual({ de: 'juiz', data: '2026-10-07' })
    expect(c?.faltam).toEqual(['Notas do produtor rural', 'Certidão'])
    expect(tarefasDeDecidirCobranca()).toEqual([
      expect.objectContaining({
        acao: 'Decidir cobrança',
        cliente: { id: 'antonio-exemplo', nome: 'Antônio Exemplo' },
        detalhe: 'Aposentadoria por Incapacidade Permanente · 2 tentativas sem resposta · limite (G15)',
        href: '/casos/antonio-exemplo-1/cobranca/decidir',
      }),
    ])
  })

  it('CA8 · a decisão exige justificativa; nova tentativa com prazo volta ao Atendimento com mais uma tentativa', async () => {
    await expect(decidirCobranca('antonio-exemplo-1', { opcao: 'nova-tentativa', justificativa: '', prazo: '2026-10-06' })).rejects.toThrow('A justificativa é obrigatória.')
    const c = await decidirCobranca('antonio-exemplo-1', { opcao: 'nova-tentativa', justificativa: 'filha vai levar as notas amanhã', prazo: '2026-10-06' })
    expect(c).toMatchObject({ situacao: 'aberta', proxima: '2026-10-06' })
    expect(await ultimoEvento('antonio-exemplo')).toBe(
      'Decidiu a cobrança: nova tentativa com prazo até 06/10. Justificativa: filha vai levar as notas amanhã. A decisão voltou para o Atendimento',
    )
    expect(tarefasDeDecidirCobranca()).toEqual([])
    expect(tarefasDeCobrar().find((t) => t.cliente?.id === 'antonio-exemplo')?.detalhe).toContain('decisão da sênior: nova tentativa com prazo')
    await expect(decidirCobranca('antonio-exemplo-1', { opcao: 'suspender', justificativa: 'de novo' })).rejects.toThrow('ainda não chegou ao limite')
  })

  it('CA8 · suspender o caso fecha a cobrança', async () => {
    const c = await decidirCobranca('antonio-exemplo-1', { opcao: 'suspender', justificativa: 'cliente desistiu do processo' })
    expect(c.situacao).toBe('encerrada')
    expect(tarefasDeCobrar().some((t) => t.cliente?.id === 'antonio-exemplo')).toBe(false)
  })

  it('CA10 · adiar pede a nova data e não zera o contador', async () => {
    await conferirChecklist('rita-exemplo-1')
    await registrarTentativa('rita-exemplo-1', { canal: 'chatwoot', resultado: 'respondeu' })
    await expect(adiarCobranca('rita-exemplo-1', null)).rejects.toThrow('Informe a nova data')
    const c = await adiarCobranca('rita-exemplo-1', '2026-10-12')
    expect(c).toMatchObject({ proxima: '2026-10-12', tentativa: 2 })
    expect(await ultimoEvento('rita-exemplo')).toBe('Adiou a cobrança para 12/10; a contagem continua em 1 tentativa')
  })

  it('CA2 e CA9 · o documento que chega e é arquivado fecha a pendência; com tudo, a cobrança fecha sozinha', async () => {
    await conferirChecklist('antonio-exemplo-1')
    const pdf = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })
    await enviarArquivos('antonio-exemplo', { origem: 'card', arquivos: [pdf('notas.pdf', 'notas-produtor', 7)] })
    const lidos = await documentosLidos('antonio-exemplo')
    await arquivarDocumentos('antonio-exemplo', { conferi: true, documentos: lidos!.documentos.map(({ id, tipo, data }) => ({ id, tipo, data })) })
    expect((await obterCobranca('antonio-exemplo-1'))?.faltam).toEqual(['Certidão'])
    await enviarArquivos('antonio-exemplo', { origem: 'card', arquivos: [pdf('certidao do sindicato.pdf', 'certidao', 8)] })
    const outra = await documentosLidos('antonio-exemplo')
    await arquivarDocumentos('antonio-exemplo', { conferi: true, documentos: outra!.documentos.map(({ id, tipo, data }) => ({ id, tipo, data })) })
    expect((await obterCobranca('antonio-exemplo-1'))?.situacao).toBe('encerrada')
    expect(await ultimoEvento('antonio-exemplo')).toBe('Chegou tudo o que faltava: a cobrança fechou e os lembretes foram cancelados')
    expect(tarefasDeDecidirCobranca()).toEqual([])
  })
})
