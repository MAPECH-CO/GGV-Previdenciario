// Toda chamada da tela ao servidor passa por aqui. Sessão expirada (401) leva ao login e guarda a tela de volta (GGVP-117, CA3).

const MARCA_ENTROU = 'ggv.entrou' // só diz "já entrou neste navegador", para o login falar em sessão expirada; nada sensível

export type Resposta<T> = { ok: true; dados: T } | { ok: false; status: number; erro: string }

export async function chamarApi<T>(caminho: string, init: { method?: string; corpo?: unknown } = {}): Promise<Resposta<T>> {
  // FormData (envio com arquivo) vai como está: o navegador põe o content-type com a fronteira.
  const formulario = init.corpo instanceof FormData
  const resposta = await fetch(`/api${caminho}`, {
    method: init.method ?? 'GET',
    headers: init.corpo === undefined || formulario ? undefined : { 'content-type': 'application/json' },
    body: init.corpo === undefined ? undefined : formulario ? (init.corpo as FormData) : JSON.stringify(init.corpo),
    credentials: 'same-origin',
  })
  const tentativaDeEntrar = caminho === '/sessao' && init.method === 'POST' // 401 ali é senha errada, não sessão vencida
  if (resposta.status === 401 && !tentativaDeEntrar) irParaEntrar()
  if (resposta.status === 204) return { ok: true, dados: undefined as T }
  const corpo = await resposta.json().catch(() => ({}))
  return resposta.ok ? { ok: true, dados: corpo as T } : { ok: false, status: resposta.status, erro: corpo.erro ?? 'Algo deu errado.' }
}

export type Baixado = { ok: true; blob: Blob; nome: string } | { ok: false; status: number; erro: string }

/** Baixa um arquivo da API (o kit para imprimir). Sessão expirada (401) leva ao login, como em `chamarApi`. */
export async function baixarApi(caminho: string): Promise<Baixado> {
  const resposta = await fetch(`/api${caminho}`, { credentials: 'same-origin' })
  if (resposta.status === 401) irParaEntrar()
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}))
    return { ok: false, status: resposta.status, erro: corpo.erro ?? 'Algo deu errado.' }
  }
  const nome = /filename\*=UTF-8''([^;]+)/i.exec(resposta.headers.get('content-disposition') ?? '')?.[1]
  return { ok: true, blob: await resposta.blob(), nome: nome ? decodeURIComponent(nome) : 'Kit do contrato' }
}

/** Depois do "Sair", um 401 de busca que ainda estava no caminho não deve mandar ao login com "volta". */
let saindo = false

export function irParaEntrar() {
  if (saindo) return
  const volta = window.location.pathname + window.location.search
  const params = new URLSearchParams({ volta })
  if (lerMarca()) params.set('expirou', '1')
  window.location.assign(`/entrar?${params}`)
}

// Barra invertida e caracteres de controle (tab, quebra de linha): o navegador os ignora ou troca por "/",
// e "/\site.com" vira outro site. Recusados antes de tudo.
const PERIGOSO = /[\\\u0000-\u001f]/

/**
 * Só caminho deste site: nunca `//site`, `/\site` nem `https://...` (sem redirecionar para fora).
 * Resolve contra a origem atual e compara: é o navegador quem diz para onde o endereço vai.
 */
export function voltaSegura(volta: string | null): string {
  if (!volta || !volta.startsWith('/') || PERIGOSO.test(volta)) return '/'
  try {
    const destino = new URL(volta, window.location.origin)
    if (destino.origin !== window.location.origin || destino.pathname.startsWith('/entrar')) return '/'
    return destino.pathname + destino.search + destino.hash
  } catch {
    return '/'
  }
}

export function marcarEntrou(entrou: boolean) {
  try {
    if (entrou) window.localStorage.setItem(MARCA_ENTROU, '1')
    else window.localStorage.removeItem(MARCA_ENTROU)
  } catch {
    // sem armazenamento: o login só não fala em "sessão expirada"
  }
}

function lerMarca() {
  try {
    return window.localStorage.getItem(MARCA_ENTROU) === '1'
  } catch {
    return false
  }
}

export async function sair() {
  saindo = true
  await chamarApi('/sessao', { method: 'DELETE' })
  marcarEntrou(false)
  window.location.assign('/entrar')
}
