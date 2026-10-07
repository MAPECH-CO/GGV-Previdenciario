// Arquivos do cliente e do caso (LGPD): ficam fora do banco. Com SUPABASE_URL e a chave de serviço, no bucket
// privado "documentos" do Supabase Storage; sem elas (máquina do dev), na pasta apps/api/.arquivos-local.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Armazenamento = {
  salvar(chave: string, conteudo: Buffer, mime: string): Promise<void>
  ler(chave: string): Promise<Buffer>
}

export const pastaArquivosLocal = fileURLToPath(new URL('../.arquivos-local', import.meta.url))

export function armazenamentoLocal(pasta = pastaArquivosLocal): Armazenamento {
  // A chave é gerada pela API (uuid/nome), nunca pelo cliente; mesmo assim, nada sai da pasta.
  const caminho = (chave: string) => {
    if (chave.includes('..')) throw new Error('Chave de arquivo inválida.')
    return join(pasta, chave)
  }
  return {
    async salvar(chave, conteudo) {
      await mkdir(dirname(caminho(chave)), { recursive: true })
      await writeFile(caminho(chave), conteudo, { flag: 'wx' })
    },
    ler: (chave) => readFile(caminho(chave)),
  }
}

export function armazenamentoSupabase(url: string, chaveServico: string, bucket = 'documentos'): Armazenamento {
  const endereco = (chave: string) => `${url}/storage/v1/object/${bucket}/${chave.split('/').map(encodeURIComponent).join('/')}`
  const cabecalho = { Authorization: `Bearer ${chaveServico}`, apikey: chaveServico }
  return {
    async salvar(chave, conteudo, mime) {
      const r = await fetch(endereco(chave), { method: 'POST', headers: { ...cabecalho, 'content-type': mime, 'x-upsert': 'false' }, body: new Uint8Array(conteudo) })
      if (!r.ok) throw new Error(`Falha ao guardar o arquivo (${r.status}).`)
    },
    async ler(chave) {
      const r = await fetch(endereco(chave), { headers: cabecalho })
      if (!r.ok) throw new Error(`Falha ao ler o arquivo (${r.status}).`)
      return Buffer.from(await r.arrayBuffer())
    },
  }
}

export function abrirArmazenamento(ambiente = process.env): Armazenamento {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = ambiente
  return SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? armazenamentoSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : armazenamentoLocal()
}
