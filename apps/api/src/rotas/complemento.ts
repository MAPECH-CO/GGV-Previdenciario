// O complemento ao médico do cliente no servidor (GGVP-29, ligado pela GGVP-132). As rotas têm a forma da design.md da
// change ggvp-13 e as regras são as das telas (regras/complemento.ts e o laço da cobrança, G15), com o perfil da sessão. O
// parecer Insuficiente ou Contraditório abre a pendência (rotas/parecer.ts). O Chatwoot continua simulado (GGVP-102): a
// tentativa fica registrada, nada sai para o cliente daqui.
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { DecisaoDoComplemento, TentativaDoComplemento, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { usuario } from '../banco/esquema.ts'
import { MSG_CASO_NAO_ENCONTRADO, criarCasoMedico, type CasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import { motivoParaNaoDecidir } from '../../../web/src/regras/cobranca.ts'
import { complementoNaTela, doProcesso, type Complemento, type ComplementoNaTela } from '../../../web/src/regras/complemento.ts'
import { previaDoComplemento } from '../../../web/src/regras/parecerDoCaso.ts'
import { criarParecerDoCaso } from './parecer.ts'

export const MSG_SEM_COMPLEMENTO = 'Complemento não encontrado.'
export const MSG_COMPLEMENTO_ENCERRADO = 'O complemento já foi encerrado.'
export const MSG_AINDA_NO_LIMITE = 'O complemento ainda não passou do limite.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasComplemento(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { acharCaso, lerParte, gravarParte } = criarCasoMedico(banco, agora)
  const { emDia } = criarParecerDoCaso(banco, agora)

  /** O complemento do caso como a tela do Atendimento recebe: o resultado e o que pedir, sem conteúdo clínico (CA6). */
  async function montar(c: CasoMedico): Promise<{ lista: Complemento[]; tela: ComplementoNaTela } | null> {
    const lista = (await lerParte<Complemento[]>(c.id, 'complemento')) ?? []
    const atual = doProcesso(lista, c.id)
    if (!atual) return null
    const previa = previaDoComplemento((await emDia(c)).p)
    const tela = complementoNaTela(atual, { ficha: c.ficha, processo: c.processo, beneficio: nomeBeneficio(c.processo.beneficio), hoje: hojeEmBrasilia(agora()), ...(previa && { previa }) })
    return { lista, tela }
  }

  async function nomeDe(pedido: FastifyRequest) {
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, pedido.usuario!.id))
    return u?.nome ?? 'Alguém do escritório'
  }

  app.get<{ Params: { id: string } }>('/api/processos/:id/complemento', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const m = await montar(c)
    return m?.tela ?? negar(resposta, 404, MSG_SEM_COMPLEMENTO)
  })

  // CA3 (G15): cada tentativa do Atendimento entra no laço; a segunda sem resposta sobe para a Sênior.
  app.post<{ Params: { id: string } }>('/api/processos/:id/complemento/tentativas', { preHandler: exigir(banco, 'complemento.cobrar', agora) }, async (pedido, resposta) => {
    const entrada = TentativaDoComplemento.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Escolha o canal e o resultado da tentativa.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const m = await montar(c)
    if (!m) return negar(resposta, 404, MSG_SEM_COMPLEMENTO)
    if (m.tela.situacao === 'encerrado') return negar(resposta, 409, MSG_COMPLEMENTO_ENCERRADO)
    if (m.tela.motivoParado) return negar(resposta, 409, m.tela.motivoParado)
    const complemento = m.tela.complemento
    complemento.tentativas = [...(complemento.tentativas ?? []), { dia: hojeEmBrasilia(agora()), ...entrada.data, quem: await nomeDe(pedido) }]
    await gravarParte(c.id, 'complemento', m.lista)
    await historico(pedido.usuario!.id, 'complemento_tentativa_registrada', pedido, `caso:${c.id}`, { tentativa: complemento.tentativas.length, ...entrada.data })
    return resposta.code(201).send((await montar(c))!.tela)
  })

  // CA3 (G15): no limite, só a Sênior decide a nova tentativa, com prazo e justificativa. A dispensa do parecer é outra rota.
  app.post<{ Params: { id: string } }>('/api/processos/:id/complemento/decisoes', { preHandler: exigir(banco, 'complemento.decidir', agora) }, async (pedido, resposta) => {
    const entrada = DecisaoDoComplemento.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Decisão inválida.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const m = await montar(c)
    if (!m) return negar(resposta, 404, MSG_SEM_COMPLEMENTO)
    if (m.tela.situacao === 'encerrado') return negar(resposta, 409, MSG_COMPLEMENTO_ENCERRADO)
    if (m.tela.situacao !== 'na-senior') return negar(resposta, 409, MSG_AINDA_NO_LIMITE)
    const { justificativa, prazo } = entrada.data
    const motivo = motivoParaNaoDecidir({ opcao: 'nova-tentativa', justificativa, prazo }, hojeEmBrasilia(agora()))
    if (motivo) return negar(resposta, 400, motivo)
    const complemento = m.tela.complemento
    complemento.decisoes = [...(complemento.decisoes ?? []), { opcao: 'nova-tentativa', justificativa, prazo, quando: agora().toISOString(), quem: await nomeDe(pedido) }]
    complemento.adiadaPara = prazo
    await gravarParte(c.id, 'complemento', m.lista)
    await historico(pedido.usuario!.id, 'complemento_decidido', pedido, `caso:${c.id}`, { opcao: 'nova-tentativa', prazo })
    return resposta.code(201).send((await montar(c))!.tela)
  })
}
