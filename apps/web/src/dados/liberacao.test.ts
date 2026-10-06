import { beforeEach, describe, expect, it } from 'vitest'
import { conferirChecklist } from './checklist.ts'
import { enviarArquivos } from './documentos.ts'
import { arquivarDocumentos, documentosLidos } from './leitura.ts'
import { liberarAoJuridico, obterLiberacao, tarefasDaFilaDaSenior, tarefasDeLiberar } from './liberacao.ts'
import { obterParecer, registrarParecer } from './parecer.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function arquivarTudo(fichaId: string) {
  const c = await documentosLidos(fichaId)
  const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
  await arquivarDocumentos(fichaId, { conferi: true, documentos, duplicados: 'manter' })
}

/** A advogada confere a análise da IA como veio e registra "Suficiente" (GGVP-20). */
async function parecerSuficiente(processoId: string) {
  const analise = (await obterParecer(processoId, 'juridico'))!.juridico!.analise!
  const conferidos = Object.fromEntries(analise.itens.map((i) => [i.id, i.situacao]))
  await registrarParecer(processoId, { analise: analise.quando, conferidos, decisao: 'suficiente' }, { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' })
}

/** A Rita manda o que faltava (com o relatório médico que completa o laudo), a Documentação arquiva e confere o checklist. */
async function completarRita() {
  await arquivarTudo('rita-exemplo')
  const faltam = ['cpf', 'comprovante-renda', 'cadunico', 'grupo-familiar', 'declaracao-moradia', 'laudo']
  await enviarArquivos('rita-exemplo', {
    origem: 'card',
    arquivos: faltam.map((tipo, i) => ({ nome: `${tipo}.pdf`, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(20 + i).padStart(64, '0') })),
  })
  await arquivarTudo('rita-exemplo')
  return conferirChecklist('rita-exemplo-1')
}

const tudoConferido = { perfil: 'documentacao' as const, conferiChecklist: true, conferiAssinaturas: true }

describe('Liberar o caso ao Jurídico · servidor de exemplo', () => {
  it('CA5 · a semente traz o Sebastião na fila da Documentação, com a idade em dias', async () => {
    expect(tarefasDeLiberar()).toEqual([
      expect.objectContaining({
        codigo: 'D1.24',
        acao: 'Liberar ao Jurídico',
        cliente: { id: 'sebastiao-exemplo', nome: 'Sebastião Exemplo' },
        detalhe: 'Auxílio Acidentário · parecer Suficiente (G17) · conferir a documentação',
        prazo: 'na fila há 2 dias',
        urgente: true,
        href: '/casos/sebastiao-exemplo-1/liberar',
      }),
    ])
  })

  it('CA2 · checklist sem lista ou incompleto não libera e diz o que falta', async () => {
    await expect(liberarAoJuridico('antonio-exemplo-1', tudoConferido)).rejects.toThrow('Aposentadoria por Incapacidade Permanente ainda não tem lista de documentos obrigatórios aprovada')
    // GGVP-47: o Auxílio-Acidente tem lista, mas espera a circunstância do acidente.
    await expect(liberarAoJuridico('sebastiao-exemplo-1', tudoConferido)).rejects.toThrow('Marque a circunstância do acidente')
    await expect(liberarAoJuridico('rita-exemplo-1', tudoConferido)).rejects.toThrow('O checklist está incompleto. Falta: Documento pessoal (RG)')
  })

  it('CA1, CA6 e CA7 · completo, com o parecer Suficiente e as duas conferências: vai à fila da sênior e fica no histórico', async () => {
    expect((await completarRita()).completo).toBe(true)
    // Sem o parecer da advogada, a análise da IA sozinha não libera (G17, GGVP-20).
    await expect(liberarAoJuridico('rita-exemplo-1', tudoConferido)).rejects.toThrow('ainda não foi confirmado por pessoa do Jurídico (G17)')
    await parecerSuficiente('rita-exemplo-1')
    expect(tarefasDeLiberar().map((t) => [t.cliente?.nome, t.prazo])).toEqual([
      ['Rita Exemplo', 'na fila desde hoje'],
      ['Sebastião Exemplo', 'na fila há 2 dias'],
    ])
    await expect(liberarAoJuridico('rita-exemplo-1', { ...tudoConferido, conferiAssinaturas: false })).rejects.toThrow('Marque o checklist e as assinaturas')
    const liberacao = await liberarAoJuridico('rita-exemplo-1', tudoConferido)
    expect(liberacao).toEqual({ processoId: 'rita-exemplo-1', fichaId: 'rita-exemplo', quem: 'Você (Documentação · ADM)', quando: new Date(2026, 9, 5, 14, 32).toISOString() })
    const ficha = await obterFicha('rita-exemplo')
    expect(ficha?.historico.at(-1)).toMatchObject({ quem: 'Você (Documentação · ADM)', oQue: 'Caso liberado ao Jurídico pela Documentação' })
    expect(ficha?.processos[0].etapa).toBe('Jurídico · conferência antes do INSS')
    expect(tarefasDeLiberar().map((t) => t.cliente?.nome)).toEqual(['Sebastião Exemplo'])
    expect(tarefasDaFilaDaSenior()).toEqual([
      expect.objectContaining({ codigo: 'D2.01', acao: 'Conferir antes do INSS', detalhe: 'LOAS Deficiente · liberado pela Documentação hoje às 14:32' }),
    ])
    expect((await obterLiberacao('rita-exemplo-1'))?.liberacao).toEqual(liberacao)
    await expect(liberarAoJuridico('rita-exemplo-1', tudoConferido)).rejects.toThrow('O caso já foi liberado')
  })

  it('CA7 · benefício da matriz de laudos sem parecer Suficiente não libera (G17)', async () => {
    await conferirChecklist('marta-exemplo-1')
    expect((await obterLiberacao('marta-exemplo-1'))).toMatchObject({ precisaParecer: true, parecer: undefined })
  })

  it('CA4 · outro perfil é recusado no servidor e a tentativa fica no histórico', async () => {
    await completarRita()
    await expect(liberarAoJuridico('rita-exemplo-1', { ...tudoConferido, perfil: 'atendimento' })).rejects.toThrow('Só a Documentação · ADM libera o caso ao Jurídico')
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)).toMatchObject({
      quem: 'Você (Atendimento)',
      oQue: 'Tentou liberar o caso ao Jurídico e foi recusado: o perfil Atendimento não libera; só a Documentação · ADM',
    })
    expect((await obterLiberacao('rita-exemplo-1'))?.liberacao).toBeUndefined()
  })
})
