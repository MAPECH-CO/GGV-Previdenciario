// O checklist do caso da Recepção no servidor (GGVP-91; GGVP-125, bloco 5c). As regras são as das telas; a lista vem do kit
// que o escritório configura (GGVP-104), o vigente quando o caso abriu, o mesmo da liberação (G1). A conferência grava a
// situação calculada, nunca a marcada à mão (CA5), e a incompleta abre a cobrança (GGVP-101, CA1).
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { boasVindas, caso, cobrancaDocumento, conferenciaChecklist, contratoRecepcao, documentacaoMedica, kitDocumento, tarefa } from '../banco/esquema.ts'
import { MSG_CASO_NAO_ENCONTRADO } from '../fluxo/documentacao-medica.ts'
import { exigir } from '../sessao/rotas.ts'
import { UUID, criarFichario, type ContratoGuardado } from './recepcao.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Ficha, Processo } from '../../../web/src/dados/tipos.ts'
import type { DadosDoAcidente } from '../../../web/src/regras/acidente.ts'
import { boasVindasDoCaso, type BoasVindas, type RegistroDasBoasVindas } from '../../../web/src/regras/boasVindas.ts'
import {
  complementaresDoCaso,
  contratoAssinadoDo,
  documentosDoCaso,
  juntar,
  listaDoKit,
  montarChecklist,
  type ChecklistDoCaso,
  type ChecklistNaCopia,
  type ConferenciaDoChecklist,
} from '../../../web/src/regras/checklist.ts'
import type { Cobranca } from '../../../web/src/regras/cobranca.ts'
import { menorDe16, type DadosDaCrianca } from '../../../web/src/regras/infantil.ts'
import type { DocumentoLido } from '../../../web/src/regras/leitura.ts'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const ehRepetido = (e: unknown) => [(e as { code?: string }).code, (e as { cause?: { code?: string } }).cause?.code].includes('23505')

export const MSG_BOAS_VINDAS_JA_ENVIADAS = 'As boas-vindas já foram enviadas.'
/** "Liberar ao Jurídico" (D1.24): nasce com o checklist conferido completo (bloco 5d) e fecha na liberação (GGVP-127). */
export const PASSO_LIBERAR = 'D1.24'
const RECUSA_DAS_BOAS_VINDAS: Partial<Record<BoasVindas['situacao'], string>> = {
  enviada: MSG_BOAS_VINDAS_JA_ENVIADAS,
  'ja-era-cliente': 'Já era cliente: as boas-vindas não vão.',
  'aguardando-checklist': 'Confira o checklist antes das boas-vindas.',
}

export function criarChecklist(banco: Banco, agora: () => Date) {
  const fichario = criarFichario(banco, agora)

  /** O que o cálculo lê do banco, de uma vez, para os casos pedidos. O kit é pequeno: vem inteiro. */
  async function carregar(casoIds: string[]) {
    const [casos, kits, partes, conferencias, contratos] = await Promise.all([
      banco.select({ id: caso.id, beneficio: caso.beneficio, abertoEm: caso.criadoEm }).from(caso).where(inArray(caso.id, casoIds)),
      banco.select().from(kitDocumento),
      banco
        .select({ casoId: documentacaoMedica.casoId, parte: documentacaoMedica.parte, documento: documentacaoMedica.documento })
        .from(documentacaoMedica)
        .where(and(inArray(documentacaoMedica.casoId, casoIds), inArray(documentacaoMedica.parte, ['acidente', 'crianca']))),
      banco.select().from(conferenciaChecklist).where(inArray(conferenciaChecklist.casoId, casoIds)).orderBy(asc(conferenciaChecklist.criadoEm)),
      banco.select().from(contratoRecepcao).where(inArray(contratoRecepcao.casoId, casoIds)),
    ])
    return { casos, kits, partes, conferencias, contratos }
  }

  function calcular(ficha: Ficha, processo: Processo, d: Awaited<ReturnType<typeof carregar>>, leituras: DocumentoLido[], hoje: string): ChecklistNaCopia | null {
    const c = d.casos.find((x) => x.id === processo.id)
    if (!c) return null
    // GGVP-104 CA1, CA6: o caso fica com o kit vigente quando foi aberto, como na liberação.
    const kit = d.kits.filter((k) => k.beneficio === c.beneficio && k.vigenteDesde <= c.abertoEm && (!k.revogadoEm || k.revogadoEm > c.abertoEm))
    const parte = (nome: string) => d.partes.find((x) => x.casoId === processo.id && x.parte === nome)?.documento
    const contrato = d.contratos.find((x) => x.casoId === processo.id)
    const checklist = montarChecklist({
      lista: listaDoKit(kit),
      // A lista da entrevista (GGVP-46) fica para a história dela.
      condicoes: [],
      daEntrevista: [],
      documentos: documentosDoCaso(ficha, leituras.filter((l) => l.fichaId === ficha.id), processo.id),
      contratoAssinado: contratoAssinadoDo(contrato && (contrato.dados as ContratoGuardado).contrato, processo.etapa),
      ...complementaresDoCaso({
        beneficio: processo.beneficio,
        infantil: processo.beneficio === 'loas-deficiente' && menorDe16(ficha.nascimento, hoje),
        acidente: parte('acidente') as DadosDoAcidente | undefined,
        crianca: parte('crianca') as DadosDaCrianca | undefined,
      }),
    })
    const conferencia = d.conferencias
      .filter((x) => x.casoId === processo.id)
      .map((x) => x.dados as ConferenciaDoChecklist)
      .at(-1)
    return { processoId: processo.id, beneficio: nomeBeneficio(processo.beneficio), checklist, condicoes: [], ...(conferencia && { conferencia }) }
  }

  /** Os checklists dos casos do servidor destas fichas, para a cópia das telas (GET /api/recepcao). */
  async function dasFichas(fichas: Ficha[]): Promise<ChecklistNaCopia[]> {
    // ponytail: calcula o checklist de todo caso a cada sincronização; filtrar pela etapa se pesar.
    const pares = fichas.flatMap((f) => f.processos.filter((p) => UUID.test(p.id)).map((p) => [f, p] as const))
    if (!pares.length) return []
    const d = await carregar(pares.map(([, p]) => p.id))
    const leituras = await fichario.leiturasDe()
    const hoje = fichario.hoje()
    return pares.flatMap(([f, p]) => calcular(f, p, d, leituras, hoje) ?? [])
  }

  /** O checklist de um caso, com a ficha e o processo, como a tela pede. Caso que não é da Recepção: nulo. */
  async function doCaso(casoId: string): Promise<ChecklistDoCaso | null> {
    if (!UUID.test(casoId)) return null
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, casoId))
    const [ficha] = c ? await fichario.fichas([c.pessoaId]) : []
    const processo = ficha?.processos.find((p) => p.id === casoId)
    if (!ficha || !processo) return null
    const calculado = calcular(ficha, processo, await carregar([casoId]), await fichario.leiturasDe(ficha.id), fichario.hoje())
    if (!calculado) return null
    const { processoId: _, ...resto } = calculado
    return { ficha, processo, ...resto }
  }

  return { doCaso, dasFichas }
}

/** A situação da conferência no histórico, como nas telas. */
function situacaoDa(c: ChecklistDoCaso['checklist']): string {
  if (!c.temLista) return 'sem lista de documentos aprovada para o benefício'
  if (c.bloqueio) return `travado: ${c.bloqueio}`
  return c.completo ? 'completo' : `incompleto; falta: ${juntar(c.faltam)}`
}

export function registrarRotasRecepcaoChecklist(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { doCaso } = criarChecklist(banco, agora)
  const { hoje, evento, nomeDe, guardar, fichas } = criarFichario(banco, agora)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  const mandar = { preHandler: exigir(banco, 'mensagem.enviar', agora) }

  /** As boas-vindas do caso (GGVP-97), pela regra das telas, com os registros do banco. As cópias vão com o contrato assinado. */
  async function boasVindasDe({ ficha, processo, beneficio, checklist, conferencia }: ChecklistDoCaso): Promise<BoasVindas> {
    const linhas = await banco.select({ dados: boasVindas.dados }).from(boasVindas).where(eq(boasVindas.pessoaId, ficha.id))
    const assinado = checklist.itens.some((i) => i.tipo === 'contrato' && i.situacao === 'recebido')
    return boasVindasDoCaso({
      ficha,
      processoId: processo.id,
      beneficio,
      copias: assinado ? ['contrato', 'procuração'] : [],
      faltam: checklist.faltam,
      conferido: Boolean(conferencia),
      registros: linhas.map((l) => l.dados as RegistroDasBoasVindas),
    })
  }

  app.get<{ Params: { id: string } }>('/api/processos/:id/checklist', ver, async (pedido, resposta) => {
    return (await doCaso(pedido.params.id)) ?? negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
  })

  app.post<{ Params: { id: string } }>('/api/processos/:id/checklist/conferencia', editar, async (pedido, resposta) => {
    const achado = await doCaso(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const { ficha, processo, beneficio, checklist } = achado
    const quem = await nomeDe(pedido)
    const conferencia: ConferenciaDoChecklist = { processoId: processo.id, quando: agora().toISOString(), completo: checklist.completo, faltam: checklist.faltam }
    const abriu = await banco.transaction(async (tx) => {
      await tx.insert(conferenciaChecklist).values({ casoId: processo.id, dados: conferencia })
      // Uma cobrança aberta por caso e uma "Liberar ao Jurídico" por caso: a trava do caso segura outra conferência ao mesmo tempo.
      await tx.select({ id: caso.id }).from(caso).where(eq(caso.id, processo.id)).for('update')
      if (conferencia.faltam.length === 0) {
        // Bloco 5d: completo, "Liberar ao Jurídico" (D1.24) nasce no servidor para a Documentação; a liberação fecha.
        const [ja] = await tx.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, processo.id), eq(tarefa.passo, PASSO_LIBERAR))).limit(1)
        if (!ja) await tx.insert(tarefa).values({ casoId: processo.id, passo: PASSO_LIBERAR, titulo: 'Liberar ao Jurídico', perfilDono: 'documentacao' })
        return false
      }
      const doCasoAgora = await tx.select({ dados: cobrancaDocumento.dados }).from(cobrancaDocumento).where(eq(cobrancaDocumento.casoId, processo.id))
      if (doCasoAgora.some((c) => !(c.dados as Cobranca).encerrada)) return false
      const cobranca: Cobranca = { processoId: processo.id, fichaId: ficha.id, conferenciaEm: conferencia.quando, abertaEm: hoje(), tentativas: [], decisoes: [] }
      await tx.insert(cobrancaDocumento).values({ casoId: processo.id, dados: cobranca })
      return true
    })
    ficha.historico.push(evento(`Conferiu o checklist do ${beneficio}: ${situacaoDa(checklist)}`, quem))
    if (abriu) ficha.historico.push(evento(`Abriu a cobrança das pendências do checklist para o Atendimento: ${juntar(conferencia.faltam)}`, quem))
    await guardar(ficha)
    const linhas = await banco.select({ dados: cobrancaDocumento.dados }).from(cobrancaDocumento).where(eq(cobrancaDocumento.casoId, processo.id))
    const cobrancas = linhas.map((c) => c.dados as Cobranca)
    const [atual] = await fichas([ficha.id])
    return { conferencia, ficha: atual, checklists: [{ processoId: processo.id, beneficio, checklist, condicoes: [], conferencia }], cobrancas }
  })

  app.get<{ Params: { id: string } }>('/api/processos/:id/boas-vindas', ver, async (pedido, resposta) => {
    const achado = await doCaso(pedido.params.id)
    return achado ? await boasVindasDe(achado) : negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
  })

  // Por enquanto o portal não manda as boas-vindas (decisão do Mateus, 09/10): a Atendimento manda por fora e marca "Já
  // enviei". Uma vez por cliente novo, depois do checklist conferido (CA1, CA3, CA4); o banco recusa a segunda.
  app.post<{ Params: { id: string } }>('/api/processos/:id/boas-vindas', mandar, async (pedido, resposta) => {
    const achado = await doCaso(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const atual = await boasVindasDe(achado)
    const recusa = RECUSA_DAS_BOAS_VINDAS[atual.situacao]
    if (recusa) return negar(resposta, 409, recusa)
    const { ficha, processo } = achado
    const registro: RegistroDasBoasVindas = { fichaId: ficha.id, processoId: processo.id, quando: agora().toISOString(), situacao: 'enviada', mensagem: atual.mensagem }
    try {
      await banco.insert(boasVindas).values({ casoId: processo.id, pessoaId: ficha.id, dados: registro })
    } catch (e) {
      if (ehRepetido(e)) return negar(resposta, 409, MSG_BOAS_VINDAS_JA_ENVIADAS)
      throw e
    }
    const n = atual.faltam.length
    const pendencias = n === 0 ? 'sem pendências' : `${n === 1 ? '1 pendência' : `${n} pendências`} do checklist`
    ficha.historico.push(evento(`Mandou as boas-vindas por fora do portal (o portal ainda não envia), com as cópias do kit e ${pendencias}`, await nomeDe(pedido)))
    ficha.contatos.push({ data: hoje(), canal: 'Chatwoot', texto: 'Boas-vindas, com as cópias do kit e o que falta (mandadas por fora do portal).' })
    await guardar(ficha)
    const [atualizada] = await fichas([ficha.id])
    return { boasVindas: { ...atual, situacao: 'enviada', registro }, ficha: atualizada }
  })
}
