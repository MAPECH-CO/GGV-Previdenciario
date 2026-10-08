// Cofre do gov.br (GGVP-103): cadastrar ou trocar a senha só pelo cofre (CA4, CA11) e o relatório de usos (CA6).
// Revelar continua em `inss.ts` (GGVP-27), agora com a tarefa de gov.br (CA5) e o alerta (CA7).
import { CadastrarSenhaGovbr, UsoDoCofre, type Erro } from '@ggv/contratos'
import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { credencialGovbr, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import type { Cofre } from '../cofre.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

type Opcoes = { banco: Banco; cofre: Cofre; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const LEITURAS = ['cofre_senha_lida']
const CADASTROS = ['cofre_senha_cadastrada', 'cofre_senha_trocada']
const RECUSAS = ['cofre_negado', 'cofre_uso_recusado']

export function registrarRotasCofre(app: FastifyInstance, { banco, cofre, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  // CA4, CA11: a senha entra e muda só por aqui, cifrada; o histórico guarda quem fez, nunca o valor (CA6, CA8).
  app.post<{ Params: { id: string } }>('/api/pessoas/:id/cofre', { preHandler: exigir(banco, 'cofre.cadastrar', agora) }, async (pedido, resposta) => {
    const entrada = CadastrarSenhaGovbr.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Digite a senha do gov.br')
    const pessoaId = pedido.params.id
    const [p] = await banco.select({ id: pessoa.id }).from(pessoa).where(eq(pessoa.id, pessoaId))
    if (!p) return negar(resposta, 404, 'Cliente não encontrado.')
    const quem = pedido.usuario!.id
    const cifrada = cofre.cifrar(entrada.data.senha)
    const [existia] = await banco.select({ id: credencialGovbr.id }).from(credencialGovbr).where(eq(credencialGovbr.pessoaId, pessoaId))
    if (existia) await banco.update(credencialGovbr).set({ ...cifrada, atualizadaPor: quem, atualizadoEm: agora() }).where(eq(credencialGovbr.id, existia.id))
    else await banco.insert(credencialGovbr).values({ pessoaId, ...cifrada, atualizadaPor: quem })
    await historico(quem, existia ? 'cofre_senha_trocada' : 'cofre_senha_cadastrada', pedido, `pessoa:${pessoaId}`, { perfil: pedido.perfilAtivo })
    return resposta.code(201).send({ ok: true, trocada: Boolean(existia) })
  })

  // CA6: os usos por pessoa, para a gestão, sem o valor.
  app.get('/api/gestao/cofre', { preHandler: exigir(banco, 'gestao.ver', agora) }, async () => {
    const eventos = await banco
      .select({ quem: eventoAuditoria.quem, acao: eventoAuditoria.acao, quando: eventoAuditoria.quando })
      .from(eventoAuditoria)
      .where(inArray(eventoAuditoria.acao, [...LEITURAS, ...CADASTROS, ...RECUSAS]))
    const porPessoa = new Map<string, { leituras: number; cadastros: number; recusas: number; ultimoUso: Date | null }>()
    for (const e of eventos) {
      const p = porPessoa.get(e.quem) ?? { leituras: 0, cadastros: 0, recusas: 0, ultimoUso: null }
      if (LEITURAS.includes(e.acao)) p.leituras++
      else if (CADASTROS.includes(e.acao)) p.cadastros++
      else p.recusas++
      if (!p.ultimoUso || e.quando > p.ultimoUso) p.ultimoUso = e.quando
      porPessoa.set(e.quem, p)
    }
    const ids = [...porPessoa.keys()].filter((q) => /^[0-9a-f-]{36}$/.test(q))
    const nomes = new Map((ids.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : []).map((u) => [u.id, u.nome]))
    return UsoDoCofre.parse({
      pessoas: [...porPessoa.entries()]
        .map(([quem, p]) => ({ quem: nomes.get(quem) ?? 'Sem sessão', leituras: p.leituras, cadastros: p.cadastros, recusas: p.recusas, ultimoUso: p.ultimoUso?.toISOString() ?? null }))
        .sort((a, b) => (b.ultimoUso ?? '').localeCompare(a.ultimoUso ?? '')),
    })
  })
}
