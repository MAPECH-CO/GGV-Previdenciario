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
    expect(screen.getByText('O caso segue de onde parou: Administrativo · perícia.')).toBeTruthy()
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

describe('Pendência da conversa vira tarefa · tela (GGVP-88)', () => {
  async function comPendencia(id: string) {
    await abrir(id)
    fireEvent.click(botao('Desfazer'))
    fireEvent.click(screen.getByRole('radio', { name: 'Sim — criar a tarefa no card (D5.05)' }))
  }

  it('CA1, CA3 e CA4 · citou o setor: pergunta quem do setor; escolhida a pessoa, a tarefa nasce no card com o combinado e o prazo', async () => {
    const c = await conversaTranscrita()
    await comPendencia(c.id)
    const combinado = screen.getByLabelText('O que ficou combinado *') as HTMLTextAreaElement
    expect(combinado.value).toBe('Documentação: receber e digitalizar o relatório da alta hospitalar.')
    const escolha = screen.getByRole('group', { name: 'Escolha o responsável' })
    expect(within(escolha).getByText('Documentação tem 1 pessoa. Quem fica com esta tarefa?')).toBeTruthy()
    expect(within(escolha).getByText(/responsável: a escolher/)).toBeTruthy()
    expect(screen.getByText('Escolha quem fica com a tarefa.')).toBeTruthy()
    fireEvent.click(within(escolha).getByRole('radio', { name: 'Jéssica (exemplo)' }))
    expect(screen.getByText('Prazo de hoje em diante (dd/mm/aaaa).')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Prazo *'), { target: { value: '10/10/2026' } })
    const confirmar = screen.getByRole('group', { name: 'Ação para confirmar' })
    expect(confirmar.textContent).toContain('Maria Exemplo · Cumprir pendência')
    expect(confirmar.textContent).toContain('vence 10/10 · responsável: Jéssica (exemplo)')
    fireEvent.click(botao('Confirmar'))
    const pendencia = await screen.findByRole('group', { name: 'Pendência da conversa' })
    expect(pendencia.textContent).toContain(
      'Tarefa no card: Jéssica (exemplo) (Documentação · ADM) · Cumprir pendência · Documentação: receber e digitalizar o relatório da alta hospitalar.',
    )
    expect(within(pendencia).getByRole('status').textContent).toBe('Vence 10/10.')
    // Quem conversou não é o responsável: não dá por cumprida.
    expect(within(pendencia).queryByRole('button', { name: 'Marcar como cumprida' })).toBeNull()
  })

  it('CA3 · citou a pessoa, é ela ("Trocar" muda); sem ninguém citado, pergunta quem é, entre todos', async () => {
    const c = await conversaTranscrita()
    await comPendencia(c.id)
    const combinado = screen.getByLabelText('O que ficou combinado *')
    fireEvent.change(combinado, { target: { value: 'A Carla liga para a clínica na sexta.' } })
    const confirmar = screen.getByRole('group', { name: 'Ação para confirmar' })
    expect(confirmar.textContent).toContain('Responsável: Carla (exemplo) · Atendimento')
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Trocar' }))
    expect(within(screen.getByRole('group', { name: 'Escolha o responsável' })).getAllByRole('radio')).toHaveLength(8)
    fireEvent.change(combinado, { target: { value: 'Ligar de novo na sexta.' } })
    const escolha = screen.getByRole('group', { name: 'Escolha o responsável' })
    expect(within(escolha).getByText('Quem fica com esta tarefa?')).toBeTruthy()
    expect(within(escolha).getAllByRole('radio')).toHaveLength(8)
  })

  it('CA2 · não surgiu pendência: nenhuma tarefa nasce', async () => {
    const c = await conversaTranscrita()
    await abrir(c.id)
    fireEvent.click(botao('Desfazer'))
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    fireEvent.click(botao('Confirmar'))
    expect(await screen.findByText('Não surgiu pendência: nenhuma tarefa nasceu.')).toBeTruthy()
  })

  it('o responsável abre a tarefa e dá por cumprida', async () => {
    const c = await conversaTranscrita()
    await comPendencia(c.id)
    fireEvent.click(within(screen.getByRole('group', { name: 'Escolha o responsável' })).getByRole('radio', { name: 'Jéssica (exemplo)' }))
    fireEvent.change(screen.getByLabelText('Prazo *'), { target: { value: '10/10/2026' } })
    fireEvent.click(botao('Confirmar'))
    await screen.findByRole('group', { name: 'Pendência da conversa' })
    cleanup()
    trocarPerfil('documentacao')
    render(<ConferirConversa conversaId={c.id} />)
    const pendencia = await screen.findByRole('group', { name: 'Pendência da conversa' })
    fireEvent.click(within(pendencia).getByRole('button', { name: 'Marcar como cumprida' }))
    expect(await within(pendencia).findByText('✓ Cumprida por Jéssica (exemplo) em 07/10/2026 14:32.')).toBeTruthy()
  })
})

describe('Conferir conversa · quem está falando (GGVP-111)', () => {
  it('CA1 e CA8 · com o familiar, o telefone só muda com o cliente verificado e em contrato novo; o histórico diz como', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'familiar', modo: 'tempo-real' }, BRUNA)
    await gravarConversa(c.id, { avisei: true })
    await finalizarConversa(c.id, { aos: 116 })
    await transcreverConversa(c.id)
    await abrir(c.id)
    expect(screen.getByRole('heading', { name: 'Telefone e e-mail: como você confirmou que é o cliente?' })).toBeTruthy()
    for (const campo of [/endereço/, /telefone de contato/, /data da perícia/]) fireEvent.click(within(linha(campo)).getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(within(linha(/documento citado/)).getByRole('button', { name: 'Desfazer' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    expect(botao('Confirmar').disabled).toBe(true)
    expect(screen.getByText('Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Chamada de vídeo com o cliente' }))
    expect(screen.getByText('A alteração vai em contrato novo: marque que ela vai no contrato novo.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'A alteração vai em contrato novo' }))
    expect(botao('Confirmar').disabled).toBe(false)
    fireEvent.click(botao('Confirmar'))
    await screen.findByRole('heading', { name: '✓ Conversa conferida por Bruna (exemplo)' })
    const ficha = (await obterFicha('maria-exemplo'))!
    expect(ficha.telefone).toBe('11900000044')
    expect(ficha.historico.map((e) => e.oQue)).toContain('Mudança de telefone de contato com o cliente verificado (chamada de vídeo com o cliente; em contrato novo)')
  })

  it('CA1 · sem verificação, desfazer o telefone libera o resto; presencial com o próprio cliente não pergunta', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'familiar', modo: 'tempo-real' }, BRUNA)
    await gravarConversa(c.id, { avisei: true })
    await finalizarConversa(c.id, { aos: 116 })
    await transcreverConversa(c.id)
    await abrir(c.id)
    fireEvent.click(within(linha(/telefone de contato/)).getByRole('button', { name: 'Desfazer' }))
    for (const campo of [/endereço/, /data da perícia/]) fireEvent.click(within(linha(campo)).getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(within(linha(/documento citado/)).getByRole('button', { name: 'Desfazer' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }))
    expect(botao('Confirmar').disabled).toBe(false)
    cleanup()
    zerarExemplo()
    const presencial = await conversaTranscrita()
    await abrir(presencial.id)
    expect(screen.queryByRole('heading', { name: 'Telefone e e-mail: como você confirmou que é o cliente?' })).toBeNull()
  })
})
