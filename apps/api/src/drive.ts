// Drive do escritório (GGVP-107) pela API REST, com o fetch do Node. A conta de serviço assina um JWT (node:crypto) e
// troca por um token de uma hora. Sem a biblioteca googleapis: seis chamadas não pagam uma dependência.
// Só lista, acha, cria pasta e envia arquivo novo. Não há função que mude, mova, apague ou compartilhe (CA4): o portal
// não toca no que o escritório já tem no Drive, e nada fica público.
import { sign } from 'node:crypto'

export type ItemDoDrive = { id: string; nome: string }
export type ArquivoNovo = { nome: string; paiId: string; mime: string; conteudo: Buffer; marca: string }

export type Drive = {
  /** As subpastas de uma pasta, de todas as páginas. */
  pastas(paiId: string): Promise<ItemDoDrive[]>
  /** Os nomes do que está numa pasta, para não repetir nome. */
  nomes(paiId: string): Promise<string[]>
  /** O item que o portal criou com esta marca, ou null: o reprocessamento não duplica (CA3). */
  achar(marca: string): Promise<string | null>
  criarPasta(nome: string, paiId: string, marca: string): Promise<string>
  /** Envio retomável: o simples para em 5 MB, e o documento chega a 25 MB. */
  enviar(arquivo: ArquivoNovo): Promise<string>
  /** Onde o arquivo está agora. Mover no Drive não muda o id (CA2). */
  onde(id: string): Promise<{ nome: string; pais: string[] }>
}

/** Ids das pastas do escritório: "#5. CLIENTES" e "A REVISAR". */
export type PastasDoDrive = { clientes: string; revisar: string }
export type Credenciais = { client_email: string; private_key: string }

const TOKEN = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com'
const PASTA = 'application/vnd.google-apps.folder'
const aspas = (s: string) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

/** O cabeçalho `authorization` da conta de serviço: um token de uma hora, trocado um minuto antes de vencer. */
export function criarToken(credenciais: Credenciais, buscar: typeof fetch = fetch, agora = () => Date.now()) {
  let token: { valor: string; ate: number } | null = null
  return async function autorizacao() {
    if (!token || token.ate - agora() < 60_000) {
      const iat = Math.floor(agora() / 1000)
      const parte = (x: object) => Buffer.from(JSON.stringify(x)).toString('base64url')
      const corpo = `${parte({ alg: 'RS256', typ: 'JWT' })}.${parte({ iss: credenciais.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: TOKEN, iat, exp: iat + 3600 })}`
      const assinatura = sign('RSA-SHA256', Buffer.from(corpo), credenciais.private_key).toString('base64url')
      const r = await buscar(TOKEN, { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corpo}.${assinatura}` }) })
      const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
      if (!r.ok || !j.access_token) throw new Error(`Drive: o Google recusou a conta de serviço (${r.status} ${j.error ?? ''})`.trim())
      token = { valor: j.access_token, ate: agora() + (j.expires_in ?? 3600) * 1000 }
    }
    return `Bearer ${token.valor}`
  }
}

export function criarDrive(credenciais: Credenciais, buscar: typeof fetch = fetch, agora = () => Date.now()): Drive {
  const autorizacao = criarToken(credenciais, buscar, agora)

  async function chamar(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    const r = await buscar(url, { ...init, headers: { ...init.headers, authorization: await autorizacao() } })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } }
      throw new Error(`Drive: ${r.status} ${j.error?.message ?? r.statusText}`.trim())
    }
    return r
  }

  async function listar(q: string): Promise<ItemDoDrive[]> {
    const itens: ItemDoDrive[] = []
    let pagina = ''
    do {
      const url = `${API}/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&pageSize=1000&fields=nextPageToken,files(id,name)&q=${encodeURIComponent(q)}`
      const j = (await (await chamar(pagina ? `${url}&pageToken=${encodeURIComponent(pagina)}` : url)).json()) as { files: { id: string; name: string }[]; nextPageToken?: string }
      itens.push(...j.files.map((f) => ({ id: f.id, nome: f.name })))
      pagina = j.nextPageToken ?? ''
    } while (pagina)
    return itens
  }

  return {
    pastas: (paiId) => listar(`${aspas(paiId)} in parents and mimeType = '${PASTA}' and trashed = false`),
    nomes: async (paiId) => (await listar(`${aspas(paiId)} in parents and trashed = false`)).map((i) => i.nome),
    achar: async (marca) => (await listar(`appProperties has { key='portal' and value=${aspas(marca)} } and trashed = false`))[0]?.id ?? null,
    async criarPasta(nome, paiId, marca) {
      const r = await chamar(`${API}/drive/v3/files?supportsAllDrives=true&fields=id`, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [paiId], appProperties: { portal: marca } }),
      })
      return ((await r.json()) as { id: string }).id
    },
    async enviar({ nome, paiId, mime, conteudo, marca }) {
      const inicio = await chamar(`${API}/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id`, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': mime, 'x-upload-content-length': String(conteudo.length) },
        body: JSON.stringify({ name: nome, parents: [paiId], appProperties: { portal: marca } }),
      })
      const sessao = inicio.headers.get('location')
      if (!sessao) throw new Error('Drive: o envio não começou (o Google não devolveu a sessão).')
      const r = await chamar(sessao, { method: 'PUT', headers: { 'content-type': mime }, body: new Uint8Array(conteudo) })
      return ((await r.json()) as { id: string }).id
    },
    async onde(id) {
      const j = (await (await chamar(`${API}/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=name,parents`)).json()) as { name: string; parents?: string[] }
      return { nome: j.name, pais: j.parents ?? [] }
    },
  }
}

/** O Drive das variáveis de ambiente (`.env.drive` ou Coolify); faltando uma, desligado. */
export function abrirDrive(ambiente: Record<string, string | undefined> = process.env): { drive: Drive; pastas: PastasDoDrive } | null {
  const { GOOGLE_DRIVE_CREDENCIAIS: credenciais, GOOGLE_DRIVE_PASTA_CLIENTES: clientes, GOOGLE_DRIVE_PASTA_REVISAR: revisar } = ambiente
  if (!credenciais || !clientes || !revisar) return null
  return { drive: criarDrive(JSON.parse(Buffer.from(credenciais, 'base64').toString('utf8'))), pastas: { clientes, revisar } }
}
