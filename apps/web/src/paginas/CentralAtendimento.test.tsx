import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarBoasVindas, obterBoasVindas } from '../dados/boasVindas.ts'
import { conferirChecklist } from '../dados/checklist.ts'
import { arquivarDocumentos, documentosLidos } from '../dados/leitura.ts'
import { enviarArquivos } from '../dados/documentos.ts'
import { iniciarPerfil, trocarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, encaminhar, zerarExemplo } from '../dados/servidor.ts'
import { CentralAtendimento } from './CentralAtendimento.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  iniciarPerfil('')
})

describe('Central do Atendimento', () => {
  it('mostra a fila de 17 tarefas e os totais nas abas', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(17)
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (17)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tarefas do setor (9)' }).getAttribute('aria-selected')).toBe('false')
  })

  it('GGVP-17 CA1, CA3 e CA15 · mostra o "Receber documento" do balcão, com o caso, e o "Completar telefone" da ficha do scanner', async () => {
    const { tarefa } = await encaminhar({ fichaId: 'antonio-exemplo', motivo: 'documento', setor: 'Documentação · ADM' })
    render(<CentralAtendimento />)
    const receber = screen.getByRole('link', { name: 'Antônio Exemplo · Receber documento' })
    expect(receber.getAttribute('href')).toBe(`/balcao/documento/${tarefa.id}`)
    expect(receber.closest('li')?.textContent).toContain('Aposentadoria por Incapacidade Permanente · Judicial · exigência')
    expect(screen.getByRole('link', { name: 'Marta Exemplo · Completar telefone' }).getAttribute('href')).toBe('/clientes/marta-exemplo')
  })

  it('GGVP-81 · a Documentação vê "Conferir documento" da Rita, com a quarentena, no lugar das linhas fixas', () => {
    render(<CentralAtendimento />)
    const conferir = screen.getByRole('link', { name: 'Rita Exemplo · Conferir documento' })
    expect(conferir.getAttribute('href')).toBe('/clientes/rita-exemplo/conferir-documentos')
    expect(conferir.closest('li')?.textContent).toContain('LOAS Deficiente · 5 documentos lidos pela IA · 1 em quarentena · scanner')
    expect(screen.queryByText(/Vários clientes/)).toBeNull()
  })

  it('GGVP-95 CA3 · a leitura que falhou vira "Pedir documento legível" para o Atendimento', async () => {
    await enviarArquivos('maria-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'laudo ilegivel.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '9'.padStart(64, '0') }],
    })
    render(<CentralAtendimento />)
    const pedir = screen.getByRole('link', { name: 'Maria Exemplo · Pedir documento legível' })
    expect(pedir.getAttribute('href')).toBe('/clientes/maria-exemplo')
    expect(pedir.closest('li')?.textContent).toContain('Laudo médico de 05/10 · a leitura falhou: pedir o reenvio legível ao cliente')
  })

  it('GGVP-91 · depois da leitura arquivada, a Documentação vê "Conferir checklist" do caso', async () => {
    const c = await documentosLidos('rita-exemplo')
    const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
    await arquivarDocumentos('rita-exemplo', { conferi: true, documentos, duplicados: 'manter' })
    render(<CentralAtendimento />)
    const checklist = screen.getByRole('link', { name: 'Rita Exemplo · Conferir checklist' })
    expect(checklist.getAttribute('href')).toBe('/casos/rita-exemplo-1/checklist')
    expect(checklist.closest('li')?.textContent).toContain('LOAS Deficiente · 4 de 9 itens recebidos · leitura arquivada')
  })

  it('GGVP-97 CA6 · as boas-vindas que não saíram viram "Reenviar boas-vindas"', async () => {
    await conferirChecklist('marta-exemplo-1')
    await enviarBoasVindas('marta-exemplo-1', { conferi: true, mensagem: (await obterBoasVindas('marta-exemplo-1'))!.mensagem })
    render(<CentralAtendimento />)
    const tarefa = screen.getByRole('link', { name: 'Marta Exemplo · Reenviar boas-vindas' })
    expect(tarefa.getAttribute('href')).toBe('/casos/marta-exemplo-1/checklist')
    expect(tarefa.closest('li')?.textContent).toContain('não saíram pelo Chatwoot: a ficha não tem telefone')
  })

  it('GGVP-101 · a cobrança do Antônio, que passou para a sênior, continua à vista do Atendimento', () => {
    render(<CentralAtendimento />)
    const cobrar = screen.getByRole('link', { name: 'Antônio Exemplo · Cobrar documento' })
    expect(cobrar.getAttribute('href')).toBe('/casos/antonio-exemplo-1/cobranca')
    expect(cobrar.closest('li')?.textContent).toContain('na sênior: decidir (G15) · prazo do juiz 07/10')
  })

  it('GGVP-18 CA5 · o Sebastião espera a liberação ao Jurídico, com a idade na fila', () => {
    render(<CentralAtendimento />)
    const liberar = screen.getByRole('link', { name: 'Sebastião Exemplo · Liberar ao Jurídico' })
    expect(liberar.getAttribute('href')).toBe('/casos/sebastiao-exemplo-1/liberar')
    expect(liberar.closest('li')?.textContent).toContain('na fila há 2 dias')
  })

  it('GGVP-123 CA8 · lembra de confirmar a entrevista que passou sem registro', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('link', { name: 'Natália Exemplo · Confirmar se a entrevista aconteceu' }).getAttribute('href')).toBe('/agenda?ver=lista')
  })

  it('marca o Início como página atual e oferece o novo cliente', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: '+ Novo cliente' })).toBeTruthy()
  })

  it('troca de aba com o clique e com as setas do teclado', () => {
    render(<CentralAtendimento />)
    const setor = screen.getByRole('tab', { name: 'Tarefas do setor (9)' })
    fireEvent.click(setor)
    expect(setor.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Tarefas do setor: tela ainda não construída.')).toBeTruthy()

    fireEvent.keyDown(setor, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (17)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })

  it('a sugestão do chat preenche o campo e não envia', () => {
    render(<CentralAtendimento />)
    fireEvent.click(screen.getByRole('button', { name: 'Documentos que faltam' }))
    const campo = screen.getByLabelText('✦ Pergunte ou peça') as HTMLTextAreaElement
    expect(campo.value).toBe('Documentos que faltam')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('enviar sem servidor avisa e mantém o texto, em vez de fingir que enviou', () => {
    render(<CentralAtendimento />)
    const campo = screen.getByLabelText('✦ Pergunte ou peça') as HTMLTextAreaElement
    fireEvent.change(campo, { target: { value: 'Qual é a próxima tarefa da Josefa?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByRole('status').textContent).toContain('ainda não está ligado')
    expect(campo.value).toBe('Qual é a próxima tarefa da Josefa?')
  })

  it('GGVP-33 CA3 · o chat recusa pular o parecer e diz o portão que falta, sem card', () => {
    render(<CentralAtendimento />)
    const campo = screen.getByRole('textbox', { name: /Pergunte ou peça/ })
    fireEvent.change(campo, { target: { value: 'libera a Rita sem o parecer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByRole('status').textContent).toMatch(/^Não posso pular o parecer médico\..*\(G17\)\. Só duas sêniores dispensam/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('enviar com o campo vazio não faz nada', () => {
    render(<CentralAtendimento />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a busca é um campo de busca com nome acessível', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
  })

  it('mostra a aba "✦ Suporte"', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('button', { name: '✦ Suporte' })).toBeTruthy()
  })

  it('botões ainda não ligados avisam que estão indisponíveis e não prometem janela', () => {
    render(<CentralAtendimento />)
    for (const nome of ['✦ Suporte', 'Gravar áudio']) {
      expect(screen.getByRole('button', { name: nome }).getAttribute('aria-disabled'), nome).toBe('true')
    }
    expect(screen.getByRole('button', { name: '✦ Suporte' }).getAttribute('aria-haspopup')).toBeNull()
  })

  it('GGVP-76 CA8 · "Registrar conversa" da ligação que a Bruna abriu: o nome do cliente e a tarefa; outra pessoa não vê', () => {
    render(<CentralAtendimento />)
    const registrar = screen.getByRole('link', { name: 'Pedro Exemplo · Registrar conversa' })
    expect(registrar.getAttribute('href')).toBe('/conversas/conversa-pedro-ligacao')
    expect(registrar.closest('li')?.textContent).toContain('ligou com informação nova sobre a exigência do INSS · ligou às 09:15 · subir a gravação da ligação')
    expect(within(registrar.closest('li')!).getByRole('link', { name: 'Pedro Exemplo' }).getAttribute('href')).toBe('/clientes/pedro-exemplo')
    cleanup()
    trocarPerfil('documentacao')
    render(<CentralAtendimento />)
    expect(screen.queryByRole('link', { name: 'Pedro Exemplo · Registrar conversa' })).toBeNull()
  })
})
