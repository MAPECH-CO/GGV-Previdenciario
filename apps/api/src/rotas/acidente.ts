// A prova do acidente no Auxílio-Acidente no servidor (GGVP-47, ligada pela GGVP-132). As rotas têm a forma da design.md
// da change ggvp-13 e a regra é a das telas; a tela começa da sugestão da segunda ficha (GGVP-28), da ficha da Recepção.
import type { FastifyInstance, FastifyReply } from 'fastify'
import { DadosDoAcidente, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { MSG_CASO_NAO_ENCONTRADO, criarCasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { isoParaData } from '../../../web/src/campos.ts'
import { CATEGORIAS, CIRCUNSTANCIAS, especie, motivoParaNaoSalvar, sugestaoDaSegundaFicha, type AcidenteDoCaso, type AcidenteNaTela } from '../../../web/src/regras/acidente.ts'

export const MSG_SO_AUXILIO_ACIDENTE = 'A circunstância do acidente é do Auxílio-Acidente.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasAcidente(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { acharCaso, anotar, nomeDe, lerParte, gravarParte } = criarCasoMedico(banco, agora)

  app.get<{ Params: { id: string } }>('/api/processos/:id/acidente', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta): Promise<AcidenteNaTela | Erro> => {
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const dados = await lerParte<AcidenteDoCaso>(c.id, 'acidente')
    const sugestao = sugestaoDaSegundaFicha(c.ficha)
    return { ...(dados && { dados }), ...(sugestao && { sugestao }) }
  })

  // A Documentação ou o Jurídico marcam; o servidor confere de novo, e só no Auxílio-Acidente.
  app.put<{ Params: { id: string } }>('/api/processos/:id/acidente', { preHandler: exigir(banco, 'acidente.registrar', agora) }, async (pedido, resposta) => {
    const entrada = DadosDoAcidente.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Circunstância ou categoria fora da lista.')
    const d = entrada.data
    const motivo = motivoParaNaoSalvar({ ...d, acidenteEm: isoParaData(d.acidenteEm) ?? '' }, hojeEmBrasilia(agora()))
    if (motivo) return negar(resposta, 400, motivo)
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    if (c.processo.beneficio !== 'auxilio-acidente') return negar(resposta, 409, MSG_SO_AUXILIO_ACIDENTE)
    const registro: AcidenteDoCaso = { ...d, recusados: [...new Set(d.recusados)], processoId: c.id, quem: await nomeDe(pedido), quando: agora().toISOString() }
    await gravarParte(c.id, 'acidente', registro)
    // O auxílio anterior é dado de saúde: fica fora do histórico.
    await anotar(c, `Marcou a circunstância do acidente: ${CIRCUNSTANCIAS[d.circunstancia]} · ${CATEGORIAS[d.categoria]} · ${especie(d.circunstancia)}`, pedido)
    await historico(pedido.usuario!.id, 'acidente_registrado', pedido, `caso:${c.id}`, { circunstancia: d.circunstancia, categoria: d.categoria })
    return registro
  })
}
