// GGVP-158 P5.10 (ADR-018): o alarme ao suporte técnico, pelo canal da equipe (webhook) e por um chamado no Jira. Cada um
// liga com as suas variáveis; sem elas, o alarme fica no portal e no log. Quem chama manda só o que aconteceu, sem dado de
// cliente nem texto de publicação. O monitor do /saude (parte 9) usa o mesmo.
export type Alarme = { titulo: string; texto: string }
export type Entrega = 'enviado' | 'falhou' | 'desligado'
export type Suporte = (alarme: Alarme) => Promise<{ canal: Entrega; jira: Entrega }>

type Fetch = (url: string, init: RequestInit) => Promise<Response>
const TEMPO_LIMITE_MS = 10_000
const https = (url: string | undefined) => (url?.startsWith('https://') ? (url.endsWith('/') ? url.slice(0, -1) : url) : null)

/** O texto vai cortado: o aviso é curto, e o detalhe fica no portal. */
export const TAMANHO_DO_TEXTO = 300

export function criarSuporte(ambiente: Record<string, string | undefined> = process.env, fetch: Fetch = globalThis.fetch): Suporte {
  const canal = https(ambiente.ALARME_CANAL_URL)
  const jira = https(ambiente.ALARME_JIRA_URL)
  const { ALARME_JIRA_EMAIL: email, ALARME_JIRA_TOKEN: token, ALARME_JIRA_PROJETO: projeto } = ambiente
  const comJira = Boolean(jira && email && token && projeto)

  async function enviar(url: string, init: RequestInit): Promise<Entrega> {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) })
      return r.ok ? 'enviado' : 'falhou'
    } catch {
      return 'falhou'
    }
  }

  return async ({ titulo, texto }) => {
    const corpo = texto.slice(0, TAMANHO_DO_TEXTO)
    const json = { 'content-type': 'application/json' }
    // O JSON `{ text }` serve ao webhook do Google Chat e ao do Slack.
    const noCanal = canal ? enviar(canal, { method: 'POST', headers: json, body: JSON.stringify({ text: `${titulo}\n${corpo}` }) }) : Promise.resolve<Entrega>('desligado')
    // O chamado pela API REST do Jira (v3), com o usuário de serviço; a descrição no formato do Jira (ADF).
    const noJira = comJira
      ? enviar(`${jira}/rest/api/3/issue`, {
          method: 'POST',
          headers: { ...json, authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}` },
          body: JSON.stringify({
            fields: {
              project: { key: projeto },
              issuetype: { name: 'Tarefa' },
              summary: titulo.slice(0, 250),
              description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: corpo }] }] },
            },
          }),
        })
      : Promise.resolve<Entrega>('desligado')
    const [c, j] = await Promise.all([noCanal, noJira])
    return { canal: c, jira: j }
  }
}
