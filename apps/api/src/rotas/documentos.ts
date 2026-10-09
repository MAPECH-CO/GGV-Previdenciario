// Baixar um documento do caso (GGVP-52 CA3, GGVP-71 CA11): o arquivo do armazenamento privado, com o nome original.
// Dado de saúde só com `dado_saude.ver_detalhe`, e cada leitura fica em `acesso_dado_sensivel` (LGPD); nada do
// conteúdo vai para o log. Peça jurídica só com `peticao.ver` (GGVP-96).
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, documento } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_DOCUMENTO_SENSIVEL = 'Este documento tem dado de saúde: só o Jurídico abre.'
export const MSG_DOCUMENTO_DE_PECA = 'Este documento é peça jurídica: só o Jurídico abre.'

/**
 * Peça jurídica (perfis.md: o Atendimento e a Documentação nunca veem petição nem estratégia): o pacote da petição e as
 * versões da manifestação, da dilação ou da petição. A prova, o comprovante e a carta não são peça.
 */
export const ehPeca = (tipo: string) => tipo === 'pacote_peticao' || tipo.endsWith('_versao')

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ABREM_NO_NAVEGADOR = ['application/pdf', 'image/jpeg', 'image/png']

export function registrarRotasDocumentos(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  app.get<{ Params: { id: string; doc: string } }>('/api/casos/:id/documentos/:doc', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const { id: casoId, doc } = pedido.params
    if (!UUID.test(casoId) || !UUID.test(doc)) return negar(resposta, 404, 'Documento não encontrado.')
    const [d] = await banco
      .select()
      .from(documento)
      .where(and(eq(documento.id, doc), eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
    if (!d) return negar(resposta, 404, 'Documento não encontrado.')
    const quem = pedido.usuario!.id
    if (ehPeca(d.tipo) && !pode(pedido.perfilAtivo, 'peticao.ver')) {
      await historico(quem, 'acesso_negado', pedido, `caso:${casoId}`, { acao: 'peticao.ver', perfil: pedido.perfilAtivo })
      return negar(resposta, 403, MSG_DOCUMENTO_DE_PECA)
    }
    if (d.sensivel) {
      if (!pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')) {
        await historico(quem, 'acesso_negado', pedido, `caso:${casoId}`, { acao: 'dado_saude.ver_detalhe', perfil: pedido.perfilAtivo })
        return negar(resposta, 403, MSG_DOCUMENTO_SENSIVEL)
      }
      await banco.insert(acessoDadoSensivel).values({ usuarioId: quem, perfil: pedido.perfilAtivo!, casoId, recurso: `documento:${d.id}`, quando: agora() })
    }
    let conteudo: Buffer
    try {
      conteudo = await armazenamento.ler(d.chaveArmazenamento)
    } catch {
      return negar(resposta, 404, 'O arquivo deste documento não está no armazenamento.')
    }
    // Só PDF e imagem abrem no navegador; o resto baixa. O navegador não adivinha o tipo nem roda script do arquivo.
    const abre = ABREM_NO_NAVEGADOR.includes(d.mime)
    return resposta
      .header('content-type', abre ? d.mime : 'application/octet-stream')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "sandbox; default-src 'none'")
      .header('content-disposition', `${abre ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.nomeOriginal)}`)
      .send(conteudo)
  })
}
