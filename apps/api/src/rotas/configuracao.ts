// Configuração do escritório (GGVP-104): os limites dos laços, os kits de documentos por benefício (com versão) e as
// mensagens padrão, numa tela só. Quem vê é a gestão; quem muda, a gestão do escritório (`configuracao.editar`).
// Toda mudança vai para o histórico com quem, o antes e o depois (CA3), e nada se apaga: kit e mensagem ganham versão.
import {
  BENEFICIOS,
  ConfiguracaoDoEscritorio,
  PARAMETROS,
  PARAMETROS_DO_ESCRITORIO,
  PublicarKit,
  ROTULO_BENEFICIO,
  SalvarMensagem,
  SalvarParametro,
  pode,
  type Beneficio,
  type Erro,
  type Parametro,
} from '@ggv/contratos'
import { and, asc, desc, eq, inArray, isNull, max } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { configuracao, documento, eventoAuditoria, kitDocumento, modelo, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

type Opcoes = { banco: Banco; agora?: () => Date }
type Detalhe = { chave?: Parametro; antes?: unknown; depois?: unknown; beneficio?: Beneficio; versao?: number; nome?: string; itens?: number; termo?: string }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const UUID = /^[0-9a-f-]{36}$/

/** CA3: o que cada mudança foi, em palavras da equipe. */
function descrever(acao: string, d: Detalhe) {
  if (acao === 'configuracao_alterada' && d.chave) return `${PARAMETROS_DO_ESCRITORIO[d.chave].rotulo}: ${d.antes ?? 'sem valor'} → ${d.depois}`
  if (acao === 'kit_publicado' && d.beneficio) return `Kit de ${ROTULO_BENEFICIO[d.beneficio]}: versão ${d.versao} publicada, com ${d.itens} documento(s)`
  if (acao === 'mensagem_alterada') return `Mensagem "${d.nome}": versão ${d.versao} publicada`
  // GGVP-136: o modelo do Word do kit, na mesma linha do histórico.
  if (acao === 'modelo_publicado') return `Modelo "${d.nome}": versão ${d.versao} publicada`
  // GGVP-143: o glossário do escritório, na mesma linha do histórico.
  if (acao === 'glossario_termo_acrescentado') return `Glossário: "${d.termo}" acrescentado`
  if (acao === 'glossario_termo_tirado') return `Glossário: "${d.termo}" tirado`
  if (acao === 'glossario_termo_corrigido') {
    const novo = (d.depois as { termo?: string } | undefined)?.termo
    return `Glossário: "${d.termo}" corrigido${novo && novo !== d.termo ? ` para "${novo}"` : ''}`
  }
  return acao
}

/** Duas publicações ao mesmo tempo: a segunda bate na unicidade da versão (`kit_unico`, `modelo_versao_unica`). */
export const ehVersaoRepetida = (e: unknown) => [(e as { code?: string }).code, (e as { cause?: { code?: string } }).cause?.code].includes('23505')
export const MSG_PUBLICADO_AGORA = 'Outra pessoa publicou uma versão agora. Recarregue a página e confira.'

export function registrarRotasConfiguracao(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const editar = { preHandler: exigir(banco, 'configuracao.editar', agora) }

  app.get('/api/configuracao', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido) => {
    const linhas = await banco.select().from(configuracao).where(inArray(configuracao.chave, PARAMETROS))
    const vigentes = await banco.select().from(kitDocumento).where(isNull(kitDocumento.revogadoEm)).orderBy(asc(kitDocumento.tipoDocumento))
    const usados = await banco.selectDistinct({ tipo: documento.tipo }).from(documento)
    const mensagens = await banco
      .select({ id: modelo.id, nome: modelo.nome, conteudo: modelo.conteudo })
      .from(modelo)
      .where(and(eq(modelo.tipo, 'mensagem'), eq(modelo.ativo, true)))
      .orderBy(asc(modelo.nome))
    const eventos = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.alvo, 'configuracao')).orderBy(desc(eventoAuditoria.quando)).limit(50)
    const ids = [...new Set(eventos.map((e) => e.quem).filter((q) => UUID.test(q)))]
    const nomes = new Map((ids.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : []).map((u) => [u.id, u.nome]))
    return ConfiguracaoDoEscritorio.parse({
      parametros: PARAMETROS.map((chave) => {
        const v = linhas.find((l) => l.chave === chave)?.valor
        return { chave, ...PARAMETROS_DO_ESCRITORIO[chave], valor: typeof v === 'number' ? v : null }
      }),
      kits: BENEFICIOS.map((beneficio) => {
        const itens = vigentes.filter((k) => k.beneficio === beneficio)
        return {
          beneficio,
          versao: itens[0]?.versao ?? null,
          vigenteDesde: itens[0]?.vigenteDesde.toISOString() ?? null,
          itens: itens.map((i) => ({ tipoDocumento: i.tipoDocumento, obrigatorio: i.obrigatorio })),
        }
      }),
      tiposDeDocumento: [...new Set([...usados.map((u) => u.tipo), ...vigentes.map((k) => k.tipoDocumento)])].sort(),
      mensagens,
      historico: eventos.map((e) => ({ quando: e.quando.toISOString(), quem: nomes.get(e.quem) ?? 'Sem sessão', descricao: descrever(e.acao, e.detalhe as Detalhe) })),
      podeEditar: pode(pedido.perfilAtivo, 'configuracao.editar'),
    })
  })

  // CA3, CA4: cada parâmetro na sua faixa; o horário do cofre começa antes de terminar.
  app.put<{ Params: { chave: string } }>('/api/configuracao/parametros/:chave', editar, async (pedido, resposta) => {
    const chave = pedido.params.chave as Parametro
    if (!PARAMETROS.includes(chave)) return negar(resposta, 404, 'Parâmetro não encontrado.')
    const entrada = SalvarParametro.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Informe um número inteiro')
    const { rotulo, min, max: teto } = PARAMETROS_DO_ESCRITORIO[chave]
    const valor = entrada.data.valor
    if (valor < min || valor > teto) return negar(resposta, 400, `${rotulo}: entre ${min} e ${teto}.`)
    const outro = chave === 'cofre.alerta.hora_inicio' ? 'cofre.alerta.hora_fim' : chave === 'cofre.alerta.hora_fim' ? 'cofre.alerta.hora_inicio' : null
    if (outro) {
      const [o] = await banco.select().from(configuracao).where(eq(configuracao.chave, outro))
      const [inicio, fim] = chave === 'cofre.alerta.hora_inicio' ? [valor, o?.valor] : [o?.valor, valor]
      if (typeof inicio === 'number' && typeof fim === 'number' && inicio >= fim) return negar(resposta, 400, 'O começo do horário sem alerta vem antes do fim.')
    }
    const quem = pedido.usuario!.id
    // A mudança e o registro no histórico entram juntos ou não entram (GGVP-99).
    await banco.transaction(async (tx) => {
      const [atual] = await tx.select().from(configuracao).where(eq(configuracao.chave, chave))
      if (atual) await tx.update(configuracao).set({ valor, alteradoPor: quem, atualizadoEm: agora() }).where(eq(configuracao.chave, chave))
      else await tx.insert(configuracao).values({ chave, valor, alteradoPor: quem })
      await registrarHistorico(tx, agora)(quem, 'configuracao_alterada', pedido, 'configuracao', { chave, antes: atual?.valor ?? null, depois: valor })
    })
    return resposta.code(201).send({ ok: true, valor })
  })

  // CA1, CA3, CA6: publicar o kit revoga a versão vigente e grava a seguinte; o caso aberto fica com o kit da época.
  app.put<{ Params: { beneficio: string } }>('/api/configuracao/kits/:beneficio', editar, async (pedido, resposta) => {
    const beneficio = pedido.params.beneficio as Beneficio
    if (!(BENEFICIOS as readonly string[]).includes(beneficio)) return negar(resposta, 404, 'Benefício fora do catálogo.')
    const entrada = PublicarKit.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o kit.')
    const quem = pedido.usuario!.id
    const momento = agora()
    try {
      // A versão é lida, gravada e registrada no histórico na mesma transação; a unicidade recusa a segunda publicação.
      const versao = await banco.transaction(async (tx) => {
        const [{ ultima }] = await tx.select({ ultima: max(kitDocumento.versao) }).from(kitDocumento).where(eq(kitDocumento.beneficio, beneficio))
        const versao = (ultima ?? 0) + 1
        const antes = await tx
          .select({ tipoDocumento: kitDocumento.tipoDocumento, obrigatorio: kitDocumento.obrigatorio })
          .from(kitDocumento)
          .where(and(eq(kitDocumento.beneficio, beneficio), isNull(kitDocumento.revogadoEm)))
        await tx.update(kitDocumento).set({ revogadoEm: momento }).where(and(eq(kitDocumento.beneficio, beneficio), isNull(kitDocumento.revogadoEm)))
        await tx.insert(kitDocumento).values(entrada.data.itens.map((i) => ({ beneficio, tipoDocumento: i.tipoDocumento, obrigatorio: i.obrigatorio, versao, vigenteDesde: momento })))
        await registrarHistorico(tx, agora)(quem, 'kit_publicado', pedido, 'configuracao', { beneficio, versao, itens: entrada.data.itens.length, antes, depois: entrada.data.itens })
        return versao
      })
      return resposta.code(201).send({ ok: true, versao })
    } catch (e) {
      if (ehVersaoRepetida(e)) return negar(resposta, 409, MSG_PUBLICADO_AGORA)
      throw e
    }
  })

  // CA3: a mensagem padrão ganha versão nova; a anterior fica guardada, desativada.
  app.put<{ Params: { id: string } }>('/api/configuracao/mensagens/:id', editar, async (pedido, resposta) => {
    const entrada = SalvarMensagem.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva a mensagem')
    const [m] = UUID.test(pedido.params.id)
      ? await banco.select().from(modelo).where(and(eq(modelo.id, pedido.params.id), eq(modelo.tipo, 'mensagem'), eq(modelo.ativo, true)))
      : []
    if (!m) return negar(resposta, 404, 'Mensagem não encontrada.')
    const quem = pedido.usuario!.id
    const versao = m.versao + 1
    try {
      await banco.transaction(async (tx) => {
        await tx.update(modelo).set({ ativo: false }).where(eq(modelo.id, m.id))
        await tx.insert(modelo).values({ tipo: 'mensagem', nome: m.nome, versao, conteudo: entrada.data.conteudo })
        await registrarHistorico(tx, agora)(quem, 'mensagem_alterada', pedido, 'configuracao', { nome: m.nome, versao, antes: m.conteudo, depois: entrada.data.conteudo })
      })
    } catch (e) {
      if (ehVersaoRepetida(e)) return negar(resposta, 409, MSG_PUBLICADO_AGORA)
      throw e
    }
    return resposta.code(201).send({ ok: true, versao })
  })
}
