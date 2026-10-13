import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { abrirDrive, conferirDrive, criarDrive, driveDeVerdade, type Drive } from './drive.ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const CONTA = { client_email: 'portal@teste.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
const PASTA = 'application/vnd.google-apps.folder'

type Item = { id: string; name: string; parents: string[]; mimeType: string; appProperties?: Record<string, string>; tamanho?: number; conteudo?: Buffer }
type Mudanca = { fileId: string; removed?: boolean; file?: { name: string; mimeType: string; parents: string[]; trashed?: boolean; appProperties?: Record<string, string> } }

/** O Google de mentira: token, listar, criar pasta, envio retomável, ver e baixar o arquivo e a lista de mudanças. Anota cada chamada. */
function googleFalso({ porPagina = 1000 } = {}) {
  const g = {
    itens: [] as Item[],
    mudancas: [] as Mudanca[],
    driveId: undefined as string | undefined,
    chamadas: [] as string[],
    enderecos: [] as string[],
    falhar: null as { status: number; message: string } | null,
    buscar: null as unknown as typeof fetch,
  }
  const tokens: string[] = []
  const sessoes = new Map<string, Omit<Item, 'id'>>()
  const json = (corpo: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json', ...headers } })
  const novo = (item: Omit<Item, 'id'>) => {
    const id = `id${g.itens.length + 1}`
    g.itens.push({ id, ...item })
    return id
  }
  g.buscar = (async (entrada: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(entrada))
    const metodo = init.method ?? 'GET'
    g.chamadas.push(`${metodo} ${url.pathname}`)
    g.enderecos.push(url.href)
    if (url.href === 'https://oauth2.googleapis.com/token') {
      const [cabecalho, corpo, assinatura] = new URLSearchParams(String(init.body)).get('assertion')!.split('.')
      const claims = JSON.parse(Buffer.from(corpo, 'base64url').toString())
      const valida = verify('RSA-SHA256', Buffer.from(`${cabecalho}.${corpo}`), publicKey, Buffer.from(assinatura, 'base64url'))
      if (!valida || claims.iss !== CONTA.client_email || claims.scope !== 'https://www.googleapis.com/auth/drive') return json({ error: 'invalid_grant' }, 400)
      tokens.push(`tok${tokens.length + 1}`)
      return json({ access_token: tokens.at(-1), expires_in: 3600 })
    }
    if ((init.headers as Record<string, string>).authorization !== `Bearer ${tokens.at(-1)}`) return json({ error: { message: 'Invalid Credentials' } }, 401)
    if (g.falhar) {
      const { status, message } = g.falhar
      g.falhar = null
      return json({ error: { message } }, status)
    }
    if (metodo === 'GET' && url.pathname === '/drive/v3/files') {
      const q = url.searchParams.get('q')!
      const pai = q.match(/^'([^']+)' in parents/)?.[1]
      const marca = q.match(/value='([^']+)'/)?.[1]
      const achados = g.itens.filter((i) => (!pai || i.parents.includes(pai)) && (!q.includes(PASTA) || i.mimeType === PASTA) && (!marca || i.appProperties?.portal === marca))
      const de = Number(url.searchParams.get('pageToken') ?? 0)
      const pagina = achados.slice(de, de + porPagina)
      return json({ files: pagina.map((i) => ({ id: i.id, name: i.name })), ...(de + porPagina < achados.length ? { nextPageToken: String(de + porPagina) } : {}) })
    }
    if (metodo === 'GET' && url.pathname === '/drive/v3/changes/startPageToken') return json({ startPageToken: String(g.mudancas.length) })
    if (metodo === 'GET' && url.pathname === '/drive/v3/changes') {
      const de = Number(url.searchParams.get('pageToken'))
      const ate = Math.min(de + porPagina, g.mudancas.length)
      return json({ changes: g.mudancas.slice(de, ate), ...(ate < g.mudancas.length ? { nextPageToken: String(ate) } : { newStartPageToken: String(ate) }) })
    }
    if (metodo === 'GET' && url.pathname.startsWith('/drive/v3/files/')) {
      const id = decodeURIComponent(url.pathname.split('/').at(-1)!)
      if (url.searchParams.get('fields') === 'driveId') return json(g.driveId ? { driveId: g.driveId } : {})
      const i = g.itens.find((x) => x.id === id)
      if (i && url.searchParams.get('alt') === 'media') return new Response(new Uint8Array(i.conteudo ?? Buffer.alloc(0)))
      return i ? json({ name: i.name, parents: i.parents }) : json({ error: { message: 'File not found' } }, 404)
    }
    if (metodo === 'POST' && url.pathname === '/drive/v3/files') {
      const m = JSON.parse(String(init.body))
      return json({ id: novo({ name: m.name, parents: m.parents, mimeType: m.mimeType, appProperties: m.appProperties }) })
    }
    if (metodo === 'POST' && url.pathname === '/upload/drive/v3/files') {
      const m = JSON.parse(String(init.body))
      const sessao = String(sessoes.size + 1)
      sessoes.set(sessao, { name: m.name, parents: m.parents, mimeType: (init.headers as Record<string, string>)['x-upload-content-type'], appProperties: m.appProperties })
      return json({}, 200, { location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${sessao}` })
    }
    if (metodo === 'PUT' && url.pathname === '/upload/drive/v3/files') {
      const m = sessoes.get(url.searchParams.get('upload_id')!)!
      return json({ id: novo({ ...m, tamanho: (init.body as Uint8Array).length }) })
    }
    return json({ error: { message: 'Not Found' } }, 404)
  }) as typeof fetch
  return g
}

const LIBERADAS = /^(POST \/token|GET \/drive\/v3\/files(\/[^/]+)?|POST \/drive\/v3\/files|POST \/upload\/drive\/v3\/files|PUT \/upload\/drive\/v3\/files)$/
const pdf = (texto: string) => ({ mime: 'application/pdf', conteudo: Buffer.from(texto) })

describe('cliente do Drive (GGVP-107)', () => {
  it('CA4 · cria pasta e envia arquivo com a marca do portal; só lista, cria e envia: nada muda, move, apaga nem compartilha', async () => {
    const g = googleFalso()
    const drive = criarDrive(CONTA, g.buscar)
    const pasta = await drive.criarPasta('Rita Exemplo X A CLASSIFICAR', 'clientes', 'pessoa:1')
    const arquivo = await drive.enviar({ nome: 'Rg - Rita Exemplo - 2026-10-08.pdf', paiId: pasta, ...pdf('%PDF-1.4 rg'), marca: 'documento:1' })

    expect(await drive.pastas('clientes')).toEqual([{ id: pasta, nome: 'Rita Exemplo X A CLASSIFICAR' }])
    expect(await drive.nomes(pasta)).toEqual(['Rg - Rita Exemplo - 2026-10-08.pdf'])
    expect([await drive.achar('documento:1'), await drive.achar('documento:2')]).toEqual([arquivo, null])
    expect(g.itens.find((i) => i.id === arquivo)).toMatchObject({ mimeType: 'application/pdf', tamanho: 11, parents: [pasta], appProperties: { portal: 'documento:1' } })
    expect(g.chamadas.filter((c) => !LIBERADAS.test(c))).toEqual([])
  })

  it('CA2 · o arquivo movido no Drive continua achado pelo mesmo id', async () => {
    const g = googleFalso()
    const drive = criarDrive(CONTA, g.buscar)
    const id = await drive.enviar({ nome: 'Laudo médico - Rita Exemplo - 2026-10-08.pdf', paiId: 'revisar', ...pdf('x'), marca: 'documento:9' })
    g.itens.find((i) => i.id === id)!.parents = ['pasta-da-rita'] // alguém arrastou no Drive
    expect(await drive.onde(id)).toEqual({ nome: 'Laudo médico - Rita Exemplo - 2026-10-08.pdf', pais: ['pasta-da-rita'] })
  })

  it('assina o JWT com a chave da conta e usa o mesmo token até perto de vencer', async () => {
    let agora = Date.UTC(2026, 9, 8, 12)
    const g = googleFalso()
    const drive = criarDrive(CONTA, g.buscar, () => agora)
    await drive.nomes('clientes')
    await drive.nomes('clientes')
    expect(g.chamadas.filter((c) => c === 'POST /token')).toHaveLength(1)
    agora += 59.5 * 60_000 // falta meio minuto: troca antes de vencer
    await drive.nomes('clientes')
    expect(g.chamadas.filter((c) => c === 'POST /token')).toHaveLength(2)
  })

  it('lista todas as páginas', async () => {
    const g = googleFalso({ porPagina: 2 })
    const drive = criarDrive(CONTA, g.buscar)
    for (const n of ['A', 'B', 'C', 'D', 'E']) await drive.criarPasta(`${n} X A CLASSIFICAR`, 'clientes', `pessoa:${n}`)
    expect((await drive.pastas('clientes')).map((p) => p.nome[0])).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('erro do Google vira mensagem curta, sem o token; chave errada é recusada', async () => {
    const g = googleFalso()
    const drive = criarDrive(CONTA, g.buscar)
    g.falhar = { status: 403, message: 'The user does not have sufficient permissions for this file.' }
    const erro = await drive.criarPasta('X', 'clientes', 'pessoa:1').catch((e: Error) => e.message)
    expect(erro).toBe('Drive: 403 The user does not have sufficient permissions for this file.')
    expect(erro).not.toContain('tok')

    const outra = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    await expect(criarDrive({ ...CONTA, private_key: outra }, googleFalso().buscar).nomes('x')).rejects.toThrow('Drive: o Google recusou a conta de serviço (400 invalid_grant)')
  })

  it('abrirDrive: faltando uma variável, desligado; com as três, as pastas', () => {
    const credenciais = Buffer.from(JSON.stringify(CONTA)).toString('base64')
    const base = { GOOGLE_DRIVE_CREDENCIAIS: credenciais, GOOGLE_DRIVE_PASTA_CLIENTES: 'c', GOOGLE_DRIVE_PASTA_REVISAR: 'r' }
    expect(abrirDrive({})).toBeNull()
    expect(abrirDrive({ ...base, GOOGLE_DRIVE_PASTA_REVISAR: '' })).toBeNull()
    expect(abrirDrive(base)?.pastas).toEqual({ clientes: 'c', revisar: 'r' })
    // CA10: só leitura pela variável; sem ela, envia.
    expect(abrirDrive(base)?.soLeitura).toBe(false)
    expect(abrirDrive({ ...base, GOOGLE_DRIVE_SO_LEITURA: 'sim' })?.soLeitura).toBe(true)
  })

  it('CA9 · conferirDrive lê as duas pastas e devolve só as contagens; erro do Google vira o motivo, sem mexer em nada', async () => {
    const chamadas: string[] = []
    const lido = {
      pastas: async (pai: string) => (chamadas.push(`pastas ${pai}`), [{ id: '1', nome: 'A' }, { id: '2', nome: 'B' }]),
      nomes: async (pai: string) => (chamadas.push(`nomes ${pai}`), ['x.pdf']),
    } as unknown as Drive
    expect(await conferirDrive(lido, { clientes: 'c', revisar: 'r' })).toEqual({ ok: true, clientes: 2, revisar: 1 })
    expect(chamadas).toEqual(['pastas c', 'nomes r'])
    const recusado = { pastas: async () => Promise.reject(new Error('Drive: 404 pasta não encontrada')), nomes: async () => [] } as unknown as Drive
    expect(await conferirDrive(recusado, { clientes: 'c', revisar: 'r' })).toEqual({ ok: false, erro: 'Drive: 404 pasta não encontrada' })
  })
})

describe('GGVP-158 P4.3 · as mudanças do Drive e o arquivo baixado, para o scanner', () => {
  it('sem marca, só a marca de agora (o passado não entra); com ela, o que mudou, de todas as páginas, e a marca nova', async () => {
    const g = googleFalso({ porPagina: 2 })
    g.driveId = 'drive-do-escritorio'
    g.mudancas.push({ fileId: 'antigo', file: { name: 'Antigo.pdf', mimeType: 'application/pdf', parents: ['pasta-da-rita'] } })
    const drive = criarDrive(CONTA, g.buscar)
    expect(await drive.mudancas(null, 'clientes')).toEqual({ itens: [], marca: '1' })
    g.mudancas.push(
      { fileId: 'novo', file: { name: 'CNIS - Rita Exemplo - 2026-10-13.pdf', mimeType: 'application/pdf', parents: ['pasta-da-rita'] } },
      { fileId: 'do-portal', file: { name: 'Rg - Rita Exemplo - 2026-10-13.pdf', mimeType: 'application/pdf', parents: ['pasta-da-rita'], appProperties: { portal: 'documento:1' } } },
      { fileId: 'na-lixeira', file: { name: 'Velho.pdf', mimeType: 'application/pdf', parents: ['pasta-da-rita'], trashed: true } },
      { fileId: 'apagado', removed: true },
    )
    const r = await drive.mudancas('1', 'clientes')
    expect(r.marca).toBe('5')
    expect(r.itens.map((i) => [i.id, i.nome, i.pais, i.doPortal, i.fora])).toEqual([
      ['novo', 'CNIS - Rita Exemplo - 2026-10-13.pdf', ['pasta-da-rita'], false, false],
      ['do-portal', 'Rg - Rita Exemplo - 2026-10-13.pdf', ['pasta-da-rita'], true, false],
      ['na-lixeira', 'Velho.pdf', ['pasta-da-rita'], false, true],
      ['apagado', '', [], false, true],
    ])
    // O Drive compartilhado vem da pasta de clientes, uma vez só, e vai em toda chamada da lista.
    expect(g.enderecos.filter((u) => u.includes('fields=driveId'))).toHaveLength(1)
    expect(g.enderecos.filter((u) => u.includes('/changes')).every((u) => u.includes('driveId=drive-do-escritorio'))).toBe(true)
    expect(g.chamadas.filter((c) => !LIBERADAS.test(c) && !c.startsWith('GET /drive/v3/changes'))).toEqual([])
  })

  it('o scanner e a rodada do Drive só rodam com o Drive ligado e sem só leitura (a homologação não traz documento real)', () => {
    const credenciais = Buffer.from(JSON.stringify(CONTA)).toString('base64')
    const base = { GOOGLE_DRIVE_CREDENCIAIS: credenciais, GOOGLE_DRIVE_PASTA_CLIENTES: 'c', GOOGLE_DRIVE_PASTA_REVISAR: 'r' }
    expect(driveDeVerdade(abrirDrive({}))).toBeNull()
    expect(driveDeVerdade(abrirDrive({ ...base, GOOGLE_DRIVE_SO_LEITURA: 'sim' }))).toBeNull()
    expect(driveDeVerdade(abrirDrive(base))?.pastas).toEqual({ clientes: 'c', revisar: 'r' })
  })

  it('baixa o conteúdo do arquivo, só lendo', async () => {
    const g = googleFalso()
    g.itens.push({ id: 'cnis', name: 'CNIS.pdf', parents: ['pasta-da-rita'], mimeType: 'application/pdf', conteudo: Buffer.from('%PDF-1.4 o CNIS') })
    expect((await criarDrive(CONTA, g.buscar).baixar('cnis')).toString()).toBe('%PDF-1.4 o CNIS')
    expect(g.chamadas.at(-1)).toBe('GET /drive/v3/files/cnis')
  })
})
