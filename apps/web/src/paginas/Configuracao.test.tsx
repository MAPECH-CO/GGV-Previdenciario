import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configuracao } from './Configuracao.tsx'

const base = {
  parametros: [{ chave: 'cobranca.limite', rotulo: 'Cobrança de documento: tentativas até subir para a Sênior', valor: 3, min: 1, max: 20 }],
  kits: [
    {
      beneficio: 'bpc_loas_idoso',
      versao: 1,
      vigenteDesde: '2026-09-01T12:00:00.000Z',
      itens: [
        { tipoDocumento: 'cadunico', obrigatorio: true },
        { tipoDocumento: 'declaracao_de_moradia', obrigatorio: false },
      ],
    },
    { beneficio: 'pensao_morte', versao: null, vigenteDesde: null, itens: [] },
  ],
  tiposDeDocumento: ['cadunico', 'ficha_de_grupo_familiar'],
  mensagens: [{ id: '11111111-1111-4111-8111-111111111111', nome: 'Confirmação da ida ao banco', conteudo: 'Olá, {cliente}!' }],
  historico: [{ quando: '2026-10-07T12:00:00.000Z', quem: 'Helena', descricao: 'Cobrança de documento: tentativas até subir para a Sênior: 2 → 3' }],
  podeEditar: true,
}

const LOAS = '22222222-2222-4222-8222-222222222222'
const glossarioBase = {
  termos: [
    { id: LOAS, termo: 'LOAS', tipo: 'sigla', significado: 'Lei Orgânica da Assistência Social' },
    { id: '33333333-3333-4333-8333-333333333333', termo: 'BPC/LOAS Idoso', tipo: 'beneficio', significado: null },
  ],
  podeEditar: true,
}

function servidor(get: object, glossario: object = glossarioBase) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method && init.method !== 'GET'
      ? new Response(JSON.stringify({ ok: true }), { status: 201 })
      : new Response(JSON.stringify(String(url) === '/api/configuracao/glossario' ? glossario : get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const enviados = (fetch: ReturnType<typeof servidor>, metodo: string) =>
  fetch.mock.calls.filter(([, i]) => i?.method === metodo).map(([url, i]) => [String(url), i!.body === undefined ? undefined : JSON.parse(i!.body as string)])
const puts = (fetch: ReturnType<typeof servidor>) => enviados(fetch, 'PUT')
afterEach(() => vi.unstubAllGlobals())

describe('Configuração do escritório (GGVP-104)', () => {
  it('CA4 · o parâmetro aceita só número e salva um por vez', async () => {
    const fetch = servidor(base)
    render(<Configuracao />)
    const campo = (await screen.findByLabelText('Cobrança de documento: tentativas até subir para a Sênior (de 1 a 20)')) as HTMLInputElement
    fireEvent.change(campo, { target: { value: '5a' } })
    expect(campo.value).toBe('5')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar: Cobrança de documento: tentativas até subir para a Sênior' }))
    expect((await screen.findByRole('status')).textContent).toBe('Parâmetro salvo.')
    expect(puts(fetch)).toEqual([['/api/configuracao/parametros/cobranca.limite', { valor: '5' }]])
  })

  it('CA1 · o kit do benefício: acrescenta, marca obrigatório e publica a versão seguinte', async () => {
    const fetch = servidor(base)
    render(<Configuracao />)
    const kit = await screen.findByRole('region', { name: 'Kit de BPC/LOAS Idoso' })
    expect(within(kit).getByText(/Versão 1, desde/).textContent).toContain('Versão 1, desde 01/09/2026. A versão nova vale para os casos novos')
    // GGVP-135 (P16): o nome do documento, não o código do banco.
    expect(within(kit).getByRole('list', { name: 'Documentos do kit' }).textContent).toBe('Cadastro Único (CadÚnico) · obrigatórioTirar Cadastro Único (CadÚnico)Declaração de moradia · condicionalTirar Declaração de moradia')
    fireEvent.change(within(kit).getByLabelText('Acrescentar documento'), { target: { value: 'ficha_de_grupo_familiar' } })
    fireEvent.click(within(kit).getByRole('button', { name: 'Acrescentar' }))
    fireEvent.click(within(kit).getByRole('button', { name: 'Tirar Declaração de moradia' }))
    fireEvent.click(within(kit).getByRole('button', { name: 'Publicar a versão 2' }))
    expect((await screen.findByRole('status')).textContent).toBe('Kit publicado: a versão 2 vale para os casos novos.')
    expect(puts(fetch)).toEqual([
      [
        '/api/configuracao/kits/bpc_loas_idoso',
        {
          itens: [
            { tipoDocumento: 'cadunico', obrigatorio: true },
            { tipoDocumento: 'ficha_de_grupo_familiar', obrigatorio: true },
          ],
        },
      ],
    ])
  })

  it('CA3 · a mensagem padrão publica a versão nova; o histórico da configuração aparece no fim', async () => {
    const fetch = servidor(base)
    render(<Configuracao />)
    fireEvent.change(await screen.findByLabelText('Confirmação da ida ao banco'), { target: { value: 'Olá, {cliente}! Leve o documento.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar a mensagem' }))
    expect((await screen.findByRole('status')).textContent).toBe('Mensagem publicada.')
    expect(puts(fetch)).toEqual([['/api/configuracao/mensagens/11111111-1111-4111-8111-111111111111', { conteudo: 'Olá, {cliente}! Leve o documento.' }]])
    expect(within(screen.getByRole('region', { name: 'Histórico da configuração' })).getByRole('listitem').textContent).toBe(
      '07/10/2026, 09:00 · Helena · Cobrança de documento: tentativas até subir para a Sênior: 2 → 3',
    )
  })

  it('quem só vê não edita: campos desligados e sem botões', async () => {
    servidor({ ...base, podeEditar: false })
    render(<Configuracao />)
    expect(((await screen.findByLabelText(/Cobrança de documento/)) as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /^Salvar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Publicar/ })).toBeNull()
  })
})

describe('Glossário do escritório (GGVP-143)', () => {
  it('CA1 · a Sênior vê os termos por tipo e acrescenta um termo novo', async () => {
    const fetch = servidor(base)
    render(<Configuracao />)
    const g = await screen.findByRole('region', { name: 'Glossário do escritório' })
    expect(within(g).getByRole('list', { name: 'Glossário: Sigla' }).textContent).toContain('LOAS · Lei Orgânica da Assistência Social')
    expect(within(g).getByRole('list', { name: 'Glossário: Benefício' }).textContent).toContain('BPC/LOAS Idoso')
    const novo = within(g).getByRole('group', { name: 'Acrescentar ao glossário' })
    fireEvent.change(within(novo).getByLabelText('Termo'), { target: { value: '2ª Vara Federal de Santo Amaro' } })
    fireEvent.change(within(novo).getByLabelText('Tipo'), { target: { value: 'juizo' } })
    fireEvent.click(within(novo).getByRole('button', { name: 'Acrescentar ao glossário' }))
    expect((await screen.findByRole('status')).textContent).toBe('Termo acrescentado ao glossário.')
    expect(enviados(fetch, 'POST')).toEqual([['/api/configuracao/glossario', { termo: '2ª Vara Federal de Santo Amaro', tipo: 'juizo', significado: '' }]])
  })

  it('CA1 · corrige e tira um termo; o termo vazio não sai da tela', async () => {
    const fetch = servidor(base)
    render(<Configuracao />)
    const g = await screen.findByRole('region', { name: 'Glossário do escritório' })
    fireEvent.click(within(g).getByRole('button', { name: 'Corrigir LOAS' }))
    const correcao = within(g).getByRole('group', { name: 'Salvar a correção' })
    fireEvent.change(within(correcao).getByLabelText('Termo'), { target: { value: ' ' } })
    fireEvent.click(within(correcao).getByRole('button', { name: 'Salvar a correção' }))
    expect(within(correcao).getByText('Escreva o termo')).toBeTruthy()
    fireEvent.change(within(correcao).getByLabelText('Termo'), { target: { value: 'LOAS (Lei 8.742/1993)' } })
    fireEvent.click(within(correcao).getByRole('button', { name: 'Salvar a correção' }))
    expect((await screen.findByRole('status')).textContent).toBe('Termo corrigido.')
    expect(puts(fetch)).toEqual([[`/api/configuracao/glossario/${LOAS}`, { termo: 'LOAS (Lei 8.742/1993)', tipo: 'sigla', significado: 'Lei Orgânica da Assistência Social' }]])

    fireEvent.click(await within(g).findByRole('button', { name: 'Tirar LOAS' }))
    // O aviso de antes ("Termo corrigido.") ainda está na tela: espera o novo, não o primeiro que achar.
    expect((await screen.findByText('Termo tirado do glossário.')).getAttribute('role')).toBe('status')
    expect(enviados(fetch, 'DELETE')).toEqual([[`/api/configuracao/glossario/${LOAS}`, undefined]])
  })

  it('quem não é a Sênior vê o glossário sem botões', async () => {
    servidor({ ...base, podeEditar: true }, { ...glossarioBase, podeEditar: false })
    render(<Configuracao />)
    const g = await screen.findByRole('region', { name: 'Glossário do escritório' })
    expect(g.textContent).toContain('Quem muda é a Sênior.')
    expect(within(g).queryByRole('button')).toBeNull()
    expect(within(g).queryByRole('group')).toBeNull()
  })
})
