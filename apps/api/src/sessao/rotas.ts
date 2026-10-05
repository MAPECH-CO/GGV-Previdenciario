// Login, sessão e a trava de toda rota /api (GGVP-117).
import { createHash, randomBytes } from 'node:crypto'
import fastifyCookie from '@fastify/cookie'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { Entrar, TrocarSenha, UsuarioDaSessao, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { eventoAuditoria, sessao, usuario } from '../banco/esquema.ts'
import { TRAVA_MINUTOS, aposErro, estaTravado, expiraEm } from './regras.ts'

export const COOKIE = 'ggv_sessao'
export const MSG_INVALIDO = 'E-mail ou senha inválidos.'
export const MSG_TRAVADO = `Conta travada por ${TRAVA_MINUTOS} minutos depois de várias tentativas erradas. Tente mais tarde ou fale com a gestão.`
export const MSG_EXPIRADA = 'Sua sessão expirou. Entre de novo.'
export const MSG_TROCAR = 'Troque a senha provisória antes de continuar.'
export const MSG_SEM_PERFIL = 'Sem perfil, fale com a gestão.'

type Usuario = typeof usuario.$inferSelect

declare module 'fastify' {
  interface FastifyRequest {
    usuario: Usuario | null
    sessaoId: string | null
  }
}

type Opcoes = { banco: Banco; agora?: () => Date; cookieSeguro?: boolean }

const hashDoToken = (token: string) => createHash('sha256').update(token).digest('hex')
// Comparar com um hash qualquer quando o e-mail não existe: a resposta demora igual e não entrega quem tem conta.
const HASH_FALSO = bcrypt.hashSync('nenhuma-senha', 10)

// A decisão usa a rota que o Fastify casou (routeOptions.url), não o endereço cru: `/%61pi/...` cai na mesma rota
// que `/api/...` e não pode escapar da trava. Sem rota casada, vale o endereço (só chega a 404 ou à tela, nunca a dado).
const rota = (r: FastifyRequest) => r.routeOptions.url ?? r.url
const protegida = (r: FastifyRequest) => rota(r).startsWith('/api/') || rota(r) === '/api'
/** Rotas que dispensam sessão, ou que quem tem senha provisória ou está sem perfil ainda pode usar. */
const livre = (r: FastifyRequest) => r.method === 'POST' && r.routeOptions.url === '/api/sessao'
const daPropriaSessao = (r: FastifyRequest) => r.routeOptions.url === '/api/sessao' || r.routeOptions.url === '/api/sessao/senha'

/** Registra na raiz (sem encapsular), para a trava valer também para rota /api que não existe. */
export function registrarSessao(app: FastifyInstance, { banco, agora = () => new Date(), cookieSeguro = false }: Opcoes) {
  app.register(fastifyCookie)
  app.decorateRequest('usuario', null)
  app.decorateRequest('sessaoId', null)

  const historico = (quem: string, acao: string, pedido: FastifyRequest) =>
    banco.insert(eventoAuditoria).values({ quem, acao, alvo: 'sessao', quando: agora(), detalhe: { ip: pedido.ip } })

  const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

  // CA5: a proteção é do servidor. Toda rota /api, existente ou não, passa por aqui antes de qualquer dado.
  app.addHook('onRequest', async (pedido, resposta) => {
    if (!protegida(pedido)) return
    if (livre(pedido)) return
    const token = pedido.cookies[COOKIE]
    const [achado] = token
      ? await banco
          .select({ usuario, sessaoId: sessao.id })
          .from(sessao)
          .innerJoin(usuario, eq(sessao.usuarioId, usuario.id))
          .where(and(eq(sessao.tokenHash, hashDoToken(token)), gt(sessao.expiraEm, agora())))
      : []
    if (!achado) return negar(resposta, 401, MSG_EXPIRADA)
    pedido.usuario = achado.usuario
    pedido.sessaoId = achado.sessaoId
    if (daPropriaSessao(pedido)) return
    if (achado.usuario.trocarSenha) return negar(resposta, 403, MSG_TROCAR)
    if (!achado.usuario.perfil) return negar(resposta, 403, MSG_SEM_PERFIL)
  })

  const paraTela = (u: Usuario): UsuarioDaSessao => UsuarioDaSessao.parse(u)

  app.post('/api/sessao', async (pedido, resposta) => {
    const entrada = Entrar.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 401, MSG_INVALIDO)
    const { email, senha } = entrada.data
    const [u] = await banco.select().from(usuario).where(eq(usuario.email, email))

    if (!u) {
      await bcrypt.compare(senha, HASH_FALSO)
      await historico('anonimo', 'login_recusado', pedido)
      return negar(resposta, 401, MSG_INVALIDO)
    }
    if (estaTravado(u.travadoAte, agora())) {
      await historico(u.id, 'login_travado', pedido)
      return negar(resposta, 423, MSG_TRAVADO)
    }
    if (!(await bcrypt.compare(senha, u.senhaHash))) {
      const depois = aposErro(u.tentativasErradas, agora())
      await banco.update(usuario).set(depois).where(eq(usuario.id, u.id))
      await historico(u.id, 'login_recusado', pedido)
      return depois.travadoAte ? negar(resposta, 423, MSG_TRAVADO) : negar(resposta, 401, MSG_INVALIDO)
    }

    await banco.update(usuario).set({ tentativasErradas: 0, travadoAte: null }).where(eq(usuario.id, u.id))
    const token = randomBytes(32).toString('base64url')
    const expira = expiraEm(agora())
    await banco.insert(sessao).values({ usuarioId: u.id, tokenHash: hashDoToken(token), expiraEm: expira })
    await historico(u.id, 'login', pedido)
    resposta.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: cookieSeguro, path: '/', expires: expira })
    return paraTela(u)
  })

  app.get('/api/sessao', async (pedido) => paraTela(pedido.usuario!))

  app.delete('/api/sessao', async (pedido, resposta) => {
    await banco.delete(sessao).where(eq(sessao.id, pedido.sessaoId!))
    await historico(pedido.usuario!.id, 'logout', pedido)
    resposta.clearCookie(COOKIE, { path: '/' })
    return resposta.code(204).send()
  })

  app.post('/api/sessao/senha', async (pedido, resposta) => {
    const entrada = TrocarSenha.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Senha inválida')
    const senhaHash = await bcrypt.hash(entrada.data.senhaNova, 10)
    const [u] = await banco
      .update(usuario)
      .set({ senhaHash, trocarSenha: false })
      .where(eq(usuario.id, pedido.usuario!.id))
      .returning()
    await historico(u.id, 'troca_de_senha', pedido)
    return paraTela(u)
  })
}
