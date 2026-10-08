// A senha do gov.br nas telas da Recepção (GGVP-146, parte 1): a caixa do cofre da ficha (GGVP-24) e a renovação antes
// da entrevista (GGVP-36) guardam no cofre do servidor (GGVP-103), cifrada. A ficha fica só com a situação, quem e
// quando; o histórico, com quem fez, nunca o valor (G9). Revelar continua só em `inss.ts`, com tarefa e senha do portal.
import { CadastrarSenhaGovbr, RenovacaoDaSenhaGov, type Erro } from '@ggv/contratos'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import type { Cofre } from '../cofre.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import type { Renovacao } from '../../../web/src/dados/tipos.ts'
import { guardarNoCofre } from './cofre.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario } from './recepcao.ts'

type Opcoes = { banco: Banco; cofre: Cofre; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasRecepcaoCofre(app: FastifyInstance, { banco, cofre, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { hoje, evento, nomeDe, fichas, guardar, concluirTarefas, tarefas, acharAgendamento } = criarFichario(banco, agora)
  const cadastrar = { preHandler: exigir(banco, 'cofre.cadastrar', agora) }
  const acharFicha = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  // GGVP-24 CA2, CA8, CA9: a caixa do cofre manda a senha direto ao cofre; a ficha só vê a situação.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/cofre/gov', cadastrar, async (pedido, resposta) => {
    const entrada = CadastrarSenhaGovbr.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Digite a senha do gov.br')
    const ficha = await acharFicha(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const quem = await nomeDe(pedido)
    const trocada = await guardarNoCofre(banco, cofre, ficha.id, entrada.data.senha, pedido.usuario!.id, agora())
    ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: agora().toISOString(), por: quem }
    ficha.historico.push(evento('Guardou a senha do gov.br no cofre', quem))
    await guardar(ficha)
    await historico(pedido.usuario!.id, trocada ? 'cofre_senha_trocada' : 'cofre_senha_cadastrada', pedido, `pessoa:${ficha.id}`, { perfil: pedido.perfilAtivo })
    return { senhaGov: ficha.senhaGov, ficha }
  })

  // GGVP-24 CA3: "Não sei a senha". A ficha segue com o alerta de senha (GGVP-36).
  app.post<{ Params: { id: string } }>('/api/fichas/:id/cofre/gov/nao-sabe', cadastrar, async (pedido, resposta) => {
    const ficha = await acharFicha(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    if (ficha.senhaGov.situacao === 'no-cofre') return negar(resposta, 409, 'A senha do gov.br já está no cofre.')
    ficha.senhaGov = { situacao: 'sem-senha', naoSabe: true }
    ficha.historico.push(evento('Marcou "não sei a senha do gov.br": o caso segue com o alerta de senha', await nomeDe(pedido)))
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'cofre_nao_sabe', pedido, `pessoa:${ficha.id}`)
    return { senhaGov: ficha.senhaGov, ficha }
  })

  // GGVP-36: "Renovou" leva a senha nova ao cofre, com a data em que funcionou (CA2, CA5, CA9, CA11); "Não conseguiu",
  // o motivo e o aviso ao cliente, em "Últimos contatos" (CA3, CA6). A entrevista segue nos dois. O motivo fica na
  // ficha, não no registro de auditoria.
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/renovacao', cadastrar, async (pedido, resposta) => {
    const entrada = RenovacaoDaSenhaGov.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Renovação inválida.')
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, 'Entrevista não encontrada.')
    const { ficha } = achado
    const r = entrada.data
    const quem = await nomeDe(pedido)
    const quando = agora().toISOString()
    let renovacao: Renovacao
    if (r.resultado === 'renovou') {
      const trocada = await guardarNoCofre(banco, cofre, ficha.id, r.senha, pedido.usuario!.id, agora())
      ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: quando, por: quem, funcionouEm: hoje() }
      renovacao = { resultado: 'renovou', quem, quando }
      ficha.historico.push(evento('Renovou a senha do gov.br e guardou no cofre; conferiu que o Meu INSS abre e que o CNIS aparece', quem))
      await historico(pedido.usuario!.id, trocada ? 'cofre_senha_trocada' : 'cofre_senha_cadastrada', pedido, `pessoa:${ficha.id}`, {
        perfil: pedido.perfilAtivo,
        origem: 'renovacao',
      })
    } else {
      renovacao = { resultado: 'nao-conseguiu', motivo: r.motivo, quem, quando }
      ficha.contatos.push({
        data: hoje(),
        canal: 'Aviso',
        texto: 'Avisado de que precisa recuperar a senha do gov.br, se preciso numa agência do INSS. A entrevista segue no horário marcado.',
      })
      ficha.historico.push(evento(`Não conseguiu renovar a senha do gov.br: ${r.motivo}. Avisou o cliente; a entrevista segue`, quem))
      await historico(pedido.usuario!.id, 'cofre_renovacao_falhou', pedido, `pessoa:${ficha.id}`)
    }
    ficha.renovacao = renovacao
    await guardar(ficha)
    await concluirTarefas(ficha.id, 'Renovar senha do gov.br')
    return { senhaGov: ficha.senhaGov, renovacao, ficha, tarefas: await tarefas(ficha.id) }
  })
}
