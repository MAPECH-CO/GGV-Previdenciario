// Formulário com um arquivo (multipart): campos de texto e, se vier, o arquivo. Usado pelo protocolo e pela vigília.
import { createHash, randomUUID } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { Armazenamento } from '../armazenamento.ts'

export type Arquivo = { conteudo: Buffer; mime: string; nome: string }
export const TIPOS_DE_ANEXO = ['application/pdf', 'image/jpeg', 'image/png']

/** `null` quando o envio não é um formulário válido ou passa do limite (25 MB, um arquivo). */
export async function lerFormulario(pedido: FastifyRequest): Promise<{ campos: Record<string, string>; arquivo: Arquivo | null } | null> {
  const campos: Record<string, string> = {}
  let arquivo: Arquivo | null = null
  try {
    for await (const parte of pedido.parts()) {
      if (parte.type === 'file') arquivo = { conteudo: await parte.toBuffer(), mime: parte.mimetype, nome: parte.filename }
      else campos[parte.fieldname] = String(parte.value)
    }
  } catch {
    return null
  }
  return { campos, arquivo }
}

/** Guarda o arquivo fora do banco e devolve os dados da linha de `documento` (chave, tamanho e hash). */
export async function guardarArquivo(armazenamento: Armazenamento, casoId: string, arquivo: Arquivo, rotulo: string) {
  const chave = `casos/${casoId}/${randomUUID()}-${rotulo}`
  await armazenamento.salvar(chave, arquivo.conteudo, arquivo.mime)
  return {
    chaveArmazenamento: chave,
    nomeOriginal: arquivo.nome,
    mime: arquivo.mime,
    tamanho: arquivo.conteudo.length,
    hashSha256: createHash('sha256').update(arquivo.conteudo).digest('hex'),
  }
}
