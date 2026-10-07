import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirConversa, finalizarConversa, gravarConversa, transcreverConversa } from '../dados/conversa.ts'
import { iniciarPerfil, trocarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConferirConversa } from './ConferirConversa.tsx'

const BRUNA = { quem: 'Bruna (exemplo)', perfil: 'atendimento' as const }

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  iniciarPerfil('')
})

async function conversaTranscrita() {
  const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }, BRUNA)
  await gravarConversa(c.id, { avisei: true })
  await finalizarConversa(c.id, { aos: 116 })
  await transcreverConversa(c.id)
  return c
}

async function abrir(id: string) {
  render(<ConferirConversa conversaId={id} />)
  await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Conferir conversa' })
}

const linha = (texto: RegExp) => screen.getAllByRole('listitem').find((li) => texto.test(li.textContent ?? ''))!
/** Os botões do rodapé: "Confirmar" e "Desfazer" também existem em cada linha. */
const botao = (nome: string) => within(screen.getByRole('group', { name: 'Concluir a conferência' })).getByRole('button', { name: nome }) as HTMLButtonElement

describe('Conferir conversa · tela do passo (GGVP-84)', () => {
  it('CA4, CA5 e CA8 · campo por campo, com Confirmar, Corrigir e Desfazer; o fato de saúde fica para o Jurídico, sem o conteúdo', async () => {
    const c = await conversaTranscrita()
    await abrir(c.id)
    expect(screen.getByText('D5.04')).toBeTruthy()
    expect(screen.getByText('Auxílio por Incapacidade Temporária · conversa de hoje por presencial (14:32) · o que a IA quer mudar')).toBeTruthy()
    const lista = screen.getByRole('list', { name: 'O que a IA quer mudar' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(5)
    expect(within(linha(/telefone de contato/)).getByRole('group', { name: 'Conferir telefone de contato' })).toBeTruthy()
    const fato = linha(/fato novo de saúde/)
    expect(fato.textContent).toContain('Processo · fato novo de saúde · só o Jurídico vêquem pode: a advogada responsável ou a Sênior')
    expect(within(fato).queryByRole('button')).toBeNull()
    expect(lista.textContent).not.toMatch(/hospital no fim de setembro/)
    expect(botao('Confirmar').disabled).toBe(true)
    expect(screen.getByText('Confirme, corrija ou desfaça: endereço, telefone de contato, data da perícia do INSS, documento citado.')).toBeTruthy()
  })

  it('CA1, CA3, CA6 e CA7 · confirma, corrige pela biblioteca de campos e desfaz; depois de "Surgiu pendência?", a ficha muda e o caso segue de onde parou', async () => {
    const c = await conversaTranscrita()
    await abrir(c.id)
    fireEvent.click(within(linha(/endereço/)).getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(within(linha(/telefone de contato/)).getByRole('button', { name: 'Corrigir' }))
    const correcao = screen.getByLabelText('Corrigir telefone de contato') as HTMLInputElement
    expect(correcao.value).toBe('(11) 90000-0044')
    fireEvent.change(correcao, { target: { value: '(11) 9000' } })
    expect(screen.getByText('Telefone com DDD.')).toBeTruthy()
    fireEvent.change(correcao, { target: { value: '(11) 90000-0055' } })
    fireEvent.click(within(linha(/data da perícia/)).getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(within(linha(/documento citado/)).getByRole('button', { name: 'Desfazer' }))
    expect(screen.getByText('Responda "Surgiu pendência?".')).toBeTruthy()
    // Nada entra na ficha antes de confirmar (G14).
    expect((await obterFicha('maria-exemplo'))!.telefone).toBe('11900000004')
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    fireEvent.click(botao('Confirmar'))
    expect(await screen.findByRole('heading', { name: '✓ Conversa conferida por Bruna (exemplo)' })).toBeTruthy()
    expect(screen.getByText('O caso segue de onde parou: Administrativo · perícia em 02/10 · cobrar o laudo que a perícia pede.')).toBeTruthy()
    const ficha = (await obterFicha('maria-exemplo'))!
    expect([ficha.endereco, ficha.telefone]).toEqual(['Rua Exemplo das Acácias, 45', '11900000055'])
    expect(within(linha(/documento citado/)).getByText('desfeita')).toBeTruthy()
    expect(within(linha(/telefone de contato/)).getByText('corrigida')).toBeTruthy()
  })

  it('"Desfazer" do rodapé desfaz tudo o que o perfil pode; nada muda na ficha', async () => {
    const c = await conversaTranscrita()
    await abrir(c.id)
    fireEvent.click(botao('Desfazer'))
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    fireEvent.click(botao('Confirmar'))
    await screen.findByRole('heading', { name: '✓ Conversa conferida por Bruna (exemplo)' })
    expect((await obterFicha('maria-exemplo'))!.telefone).toBe('11900000004')
  })

  it('CA4 · outra pessoa não confere: quem conversou confere, na hora; não nasce tarefa para outra pessoa', async () => {
    const c = await conversaTranscrita()
    trocarPerfil('atendimento-lider')
    await abrir(c.id)
    expect(screen.getByText('Quem confere é quem fez a conversa: Bruna (exemplo), na hora. Não nasce tarefa para outra pessoa.')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Concluir a conferência' })).toBeNull()
  })

  it('CA8 · depois, a advogada confere o fato novo, que só ela pode, e vê o conteúdo', async () => {
    const c = await conversaTranscrita()
    await abrir(c.id)
    fireEvent.click(botao('Desfazer'))
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    fireEvent.click(botao('Confirmar'))
    await screen.findByRole('heading', { name: /✓ Conversa conferida/ })
    cleanup()
    trocarPerfil('advogada')
    render(<ConferirConversa conversaId={c.id} />)
    const fato = (await screen.findAllByText(/Processo · fato novo: Três dias no hospital/)).at(-1)!.closest('li')!
    fireEvent.click(within(fato).getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(botao('Confirmar'))
    expect(await within(fato).findByText('confirmada')).toBeTruthy()
  })

  it('"Ver o histórico" abre as versões; a Sênior volta uma versão', async () => {
    const c = await conversaTranscrita()
    await abrir(c.id)
    fireEvent.click(within(linha(/telefone de contato/)).getByRole('button', { name: 'Confirmar' }))
    for (const campo of [/endereço/, /data da perícia/, /documento citado/]) fireEvent.click(within(linha(campo)).getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    fireEvent.click(botao('Confirmar'))
    await screen.findByRole('heading', { name: /✓ Conversa conferida/ })
    fireEvent.click(screen.getByRole('button', { name: 'Ver o histórico' }))
    const janela = await screen.findByRole('dialog', { name: /Histórico do processo/ })
    const telefone = await within(janela).findByRole('region', { name: 'Ficha · telefone de contato' })
    expect(within(telefone).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '07/10/2026 14:32 · Bruna (exemplo) · em vigor(11) 90000-0044',
      '07/10/2026 14:32 · Valor de antes da conversa(11) 90000-0004',
    ])
    // Só a Sênior tem "Voltar para esta versão".
    expect(within(janela).queryByRole('button', { name: /Voltar telefone de contato/ })).toBeNull()
  })
})
