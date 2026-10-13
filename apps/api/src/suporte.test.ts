// GGVP-158 P5.10 (ADR-018): o aviso ao suporte, com o fetch de mentira; nenhum teste chama o canal nem o Jira de verdade.
import { describe, expect, it } from 'vitest'
import { TAMANHO_DO_TEXTO, criarSuporte } from './suporte.ts'

type Chamada = { url: string; init: RequestInit }
function falso(resposta: (url: string) => Response | Error) {
  const chamadas: Chamada[] = []
  const fetch = async (url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    const r = resposta(url)
    if (r instanceof Error) throw r
    return r
  }
  return { chamadas, fetch }
}

const LIGADO = {
  ALARME_CANAL_URL: 'https://chat.exemplo/webhook/',
  ALARME_JIRA_URL: 'https://exemplo.atlassian.net',
  ALARME_JIRA_EMAIL: 'suporte@exemplo.ggv',
  ALARME_JIRA_TOKEN: 'token-de-teste',
  ALARME_JIRA_PROJETO: 'GGVP',
}
const ALARME = { titulo: 'Vigília das publicações: DJEN', texto: 'a rodada das 08:00 não trouxe as publicações. Motivo: api: HTTP 503' }

describe('GGVP-158 P5.10 · o aviso ao suporte técnico', () => {
  it('sem as variáveis, nada sai: fica no portal e no log', async () => {
    const { chamadas, fetch } = falso(() => new Response('{}'))
    expect(await criarSuporte({}, fetch)(ALARME)).toEqual({ canal: 'desligado', jira: 'desligado' })
    expect(chamadas).toEqual([])
  })

  it('o canal recebe o título e o texto; o Jira, o chamado do projeto, com o usuário de serviço', async () => {
    const { chamadas, fetch } = falso(() => new Response('{}', { status: 201 }))
    expect(await criarSuporte(LIGADO, fetch)(ALARME)).toEqual({ canal: 'enviado', jira: 'enviado' })
    const [canal, jira] = chamadas
    expect([canal.url, JSON.parse(String(canal.init.body))]).toEqual(['https://chat.exemplo/webhook', { text: `${ALARME.titulo}\n${ALARME.texto}` }])
    expect(jira.url).toBe('https://exemplo.atlassian.net/rest/api/3/issue')
    expect((jira.init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from('suporte@exemplo.ggv:token-de-teste').toString('base64')}`)
    const { fields } = JSON.parse(String(jira.init.body))
    expect([fields.project.key, fields.issuetype.name, fields.summary, fields.description.content[0].content[0].text]).toEqual(['GGVP', 'Tarefa', ALARME.titulo, ALARME.texto])
  })

  it('a falha de um não derruba o outro nem quem avisou; o texto vai cortado', async () => {
    const { chamadas, fetch } = falso((url) => (url.includes('atlassian') ? new Response('não', { status: 400 }) : new Error('rede caiu')))
    const longo = { ...ALARME, texto: 'x'.repeat(1000) }
    expect(await criarSuporte(LIGADO, fetch)(longo)).toEqual({ canal: 'falhou', jira: 'falhou' })
    expect(JSON.parse(String(chamadas[1].init.body)).fields.description.content[0].content[0].text).toHaveLength(TAMANHO_DO_TEXTO)
  })

  it('endereço sem https não recebe nada', async () => {
    const { chamadas, fetch } = falso(() => new Response('{}'))
    expect(await criarSuporte({ ...LIGADO, ALARME_CANAL_URL: 'http://chat.exemplo', ALARME_JIRA_URL: 'http://exemplo' }, fetch)(ALARME)).toEqual({ canal: 'desligado', jira: 'desligado' })
    expect(chamadas).toEqual([])
  })
})
