// Baixar um documento do caso (GGVP-52 CA3, GGVP-71 CA11) ou da pasta do cliente (GGVP-81 CA17): o arquivo do armazenamento
// privado, ou do Drive quando veio do scanner, com o nome original.
// Dado de saúde só com `dado_saude.ver_detalhe`, e cada leitura fica em `acesso_dado_sensivel` (LGPD); nada do
// conteúdo vai para o log. Peça jurídica só com `peticao.ver` (GGVP-96).
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, documento } from '../banco/esquema.ts'
import type { Drive } from '../drive.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_DOCUMENTO_SENSIVEL = 'Este documento tem dado de saúde: só o Jurídico abre.'
export const MSG_DOCUMENTO_DE_PECA = 'Este documento é peça jurídica: só o Jurídico abre.'
export const MSG_FORA_DO_ARMAZENAMENTO = 'O arquivo deste documento não está no armazenamento.'
export const MSG_DRIVE_DESLIGADO = 'O arquivo deste documento está no Drive, e o Drive não está ligado aqui.'
export const MSG_DRIVE_FORA = 'Não deu para trazer o arquivo do Drive agora. Tente de novo.'

/**
 * Peça jurídica (perfis.md: o Atendimento e a Documentação nunca veem petição nem estratégia): o pacote da petição e as
 * versões da manifestação, da dilação ou da petição. A prova, o comprovante e a carta não são peça.
 */
export const ehPeca = (tipo: string) => tipo === 'pacote_peticao' || tipo.endsWith('_versao')

/** O documento que veio do scanner fica no Drive, sem cópia no portal (GGVP-125): a chave é `drive:<id do arquivo>`. */
const NO_DRIVE = 'drive:'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date; drive?: Drive | null }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256 = /^[0-9a-f]{64}$/i
const ABREM_NO_NAVEGADOR = ['application/pdf', 'image/jpeg', 'image/png']

export function registrarRotasDocumentos(app: FastifyInstance, { banco, armazenamento, agora = () => new Date(), drive = null }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  /** Serve o arquivo com as travas da peça e da saúde (GGVP-81 CA17: as mesmas para o caso e para a pasta do cliente). */
  async function servir(d: typeof documento.$inferSelect, pedido: FastifyRequest, resposta: FastifyReply) {
    const quem = pedido.usuario!.id
    const alvo = d.casoId ? `caso:${d.casoId}` : `pessoa:${d.pessoaId}`
    if (ehPeca(d.tipo) && !pode(pedido.perfilAtivo, 'peticao.ver')) {
      await historico(quem, 'acesso_negado', pedido, alvo, { acao: 'peticao.ver', perfil: pedido.perfilAtivo })
      return negar(resposta, 403, MSG_DOCUMENTO_DE_PECA)
    }
    if (d.sensivel) {
      if (!pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')) {
        await historico(quem, 'acesso_negado', pedido, alvo, { acao: 'dado_saude.ver_detalhe', perfil: pedido.perfilAtivo })
        return negar(resposta, 403, MSG_DOCUMENTO_SENSIVEL)
      }
      await banco.insert(acessoDadoSensivel).values({ usuarioId: quem, perfil: pedido.perfilAtivo!, casoId: d.casoId, recurso: `documento:${d.id}`, quando: agora() })
    }
    let conteudo: Buffer
    if (d.chaveArmazenamento.startsWith(NO_DRIVE)) {
      // GGVP-81 CA17: o do scanner é lido no Drive, também com o Drive só de leitura (ler não grava nada lá).
      if (!drive) return negar(resposta, 404, MSG_DRIVE_DESLIGADO)
      try {
        conteudo = await drive.baixar(d.driveArquivoId ?? d.chaveArmazenamento.slice(NO_DRIVE.length))
      } catch {
        return negar(resposta, 502, MSG_DRIVE_FORA)
      }
    } else {
      try {
        conteudo = await armazenamento.ler(d.chaveArmazenamento)
      } catch {
        return negar(resposta, 404, MSG_FORA_DO_ARMAZENAMENTO)
      }
    }
    // Só PDF e imagem abrem no navegador; o resto baixa. O navegador não adivinha o tipo nem roda script do arquivo.
    const abre = ABREM_NO_NAVEGADOR.includes(d.mime)
    return resposta
      .header('content-type', abre ? d.mime : 'application/octet-stream')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "sandbox; default-src 'none'")
      .header('content-disposition', `${abre ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.nomeOriginal)}`)
      .send(conteudo)
  }

  app.get<{ Params: { id: string; doc: string } }>('/api/casos/:id/documentos/:doc', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const { id: casoId, doc } = pedido.params
    if (!UUID.test(casoId) || !UUID.test(doc)) return negar(resposta, 404, 'Documento não encontrado.')
    const [d] = await banco
      .select()
      .from(documento)
      .where(and(eq(documento.id, doc), eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
    if (!d) return negar(resposta, 404, 'Documento não encontrado.')
    return servir(d, pedido, resposta)
  })

  // GGVP-81 CA17: o arquivo da pasta do cliente pelo conteúdo. A ficha guarda o SHA-256 de cada arquivo, e o registro do
  // documento também; o mesmo conteúdo pode estar em mais de um registro, e vale a trava mais forte entre eles.
  app.get<{ Params: { id: string; hash: string } }>('/api/pessoas/:id/documentos/:hash', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const { id: pessoaId, hash } = pedido.params
    if (!UUID.test(pessoaId) || !SHA256.test(hash)) return negar(resposta, 404, 'Documento não encontrado.')
    const iguais = await banco
      .select()
      .from(documento)
      .where(and(eq(documento.pessoaId, pessoaId), eq(documento.hashSha256, hash.toLowerCase()), isNull(documento.excluidoEm)))
    if (!iguais.length) return negar(resposta, 404, 'Documento não encontrado.')
    const d = iguais.find((i) => !i.chaveArmazenamento.startsWith(NO_DRIVE)) ?? iguais[0]
    const peca = iguais.find((i) => ehPeca(i.tipo))
    return servir({ ...d, tipo: peca?.tipo ?? d.tipo, sensivel: iguais.some((i) => i.sensivel) }, pedido, resposta)
  })
}
