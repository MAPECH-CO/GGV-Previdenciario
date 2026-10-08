// A linha do tempo da deficiência na Aposentadoria PCD no servidor (GGVP-42, ligada pela GGVP-132). As rotas têm a forma
// da design.md da change ggvp-13 e as regras (períodos, enquadramento, cenários; G19) são as das telas. É dado de saúde:
// só o Jurídico vê e registra, e cada leitura fica registrada. ponytail: o CNIS ainda não está no servidor (bloco 3 da
// Recepção); sem ele a linha mostra os dados e as provas, sem os períodos.
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { DadosDaDeficiencia, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, documento, documentoMedico } from '../banco/esquema.ts'
import { MSG_CASO_NAO_ENCONTRADO, criarCasoMedico, type CasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { isoParaData } from '../../../web/src/campos.ts'
import { nomeBeneficio, nomeTipo } from '../../../web/src/dados/catalogos.ts'
import { TIPOS_DE_PROVA, linhaDoTempo, motivoParaNaoSalvar, type DeficienciaDoCaso, type Prova } from '../../../web/src/regras/deficiencia.ts'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const NA_TELA: Record<string, string> = { relatorio: 'relatorio-medico' }

export function registrarRotasDeficiencia(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { acharCaso, anotar, nomeDe, lerParte, gravarParte } = criarCasoMedico(banco, agora)

  /** As provas da época (CA3): os documentos do caso e os pessoais que são laudo, atestado, ASO, contratação por cota... */
  async function provasDo(c: CasoMedico): Promise<Prova[]> {
    const linhas = await banco
      .select({ tipo: documento.tipo, criadoEm: documento.criadoEm, medico: documentoMedico.tipo, data: documentoMedico.dataEmissao, emitente: documentoMedico.profissional })
      .from(documento)
      .leftJoin(documentoMedico, eq(documentoMedico.documentoId, documento.id))
      .where(and(isNull(documento.excluidoEm), ne(documento.situacao, 'recusado'), or(eq(documento.casoId, c.id), and(isNull(documento.casoId), eq(documento.pessoaId, c.pessoaId)))))
      .orderBy(asc(documento.criadoEm))
    return linhas
      .map((l) => ({ ...l, tipo: l.medico ? (NA_TELA[l.medico] ?? l.medico) : l.tipo }))
      .filter((l) => TIPOS_DE_PROVA.includes(l.tipo))
      .map((l) => ({ tipo: l.tipo, data: l.data ?? hojeEmBrasilia(l.criadoEm), descricao: [nomeTipo(l.tipo), l.emitente].filter(Boolean).join(' · ') }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }

  async function montar(c: CasoMedico) {
    const dados = await lerParte<DeficienciaDoCaso>(c.id, 'deficiencia')
    return linhaDoTempo({ ficha: c.ficha, processo: c.processo, beneficio: nomeBeneficio(c.processo.beneficio), ...(dados && { dados }), provas: await provasDo(c) })
  }

  // GGVP-96 CA12, CA13: o grau e as provas são dado de saúde. Quem não é do Jurídico abre a tela e vê só de quem é o caso;
  // a leitura do Jurídico fica registrada.
  app.get<{ Params: { id: string } }>('/api/processos/:id/deficiencia', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    if (!pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')) return linhaDoTempo({ ficha: c.ficha, processo: c.processo, beneficio: nomeBeneficio(c.processo.beneficio), provas: [] })
    await banco.insert(acessoDadoSensivel).values({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, casoId: c.id, recurso: `deficiencia:${c.id}`, quando: agora() })
    return montar(c)
  })

  // CA1, CA2: só a advogada ou a Sênior registram; o servidor confere de novo com a regra da tela.
  app.put<{ Params: { id: string } }>('/api/processos/:id/deficiencia', { preHandler: exigir(banco, 'dado_saude.registrar', agora) }, async (pedido, resposta) => {
    const entrada = DadosDaDeficiencia.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Dados da deficiência inválidos.')
    const d = entrada.data
    const motivo = motivoParaNaoSalvar(
      { inicio: isoParaData(d.inicio) ?? '', grau: d.grau, sexo: d.sexo, agravamentos: d.agravamentos.map((g) => ({ data: isoParaData(g.data) ?? '', grau: g.grau })) },
      hojeEmBrasilia(agora()),
    )
    if (motivo) return negar(resposta, 400, motivo)
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const registro: DeficienciaDoCaso = { ...d, processoId: c.id, quem: await nomeDe(pedido), quando: agora().toISOString() }
    await gravarParte(c.id, 'deficiencia', registro)
    // Dado de saúde fica fora do histórico: só o que aconteceu.
    await anotar(c, `Atualizou os dados da deficiência na linha do tempo (${nomeBeneficio(c.processo.beneficio)})`, pedido)
    await historico(pedido.usuario!.id, 'deficiencia_registrada', pedido, `caso:${c.id}`)
    return montar(c)
  })
}
