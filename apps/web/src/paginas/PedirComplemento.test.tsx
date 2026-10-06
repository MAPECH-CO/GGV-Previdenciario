import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { registrarTentativaDoComplemento } from '../dados/complemento.ts'
import { enviarArquivos } from '../dados/documentos.ts'
import { obterParecer, registrarParecer } from '../dados/parecer.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { PedirComplemento } from './PedirComplemento.tsx'

let agora = new Date(2026, 9, 6, 15, 10)

beforeEach(() => {
  agora = new Date(2026, 9, 6, 15, 10)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('')
})

async function parecer(decisao: 'suficiente' | 'insuficiente') {
  const p = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!
  const conferidos = Object.fromEntries(p.analise!.itens.map((i) => [i.id, i.situacao]))
  await registrarParecer('rita-exemplo-1', { analise: p.analise!.quando, conferidos, decisao, abordar: p.abordarSugerido }, { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' })
}

async function abrir() {
  render(<PedirComplemento processoId="rita-exemplo-1" />)
  await screen.findByRole('heading', { level: 1, name: /Pedir complemento ao médico/ })
}

describe('Pedir complemento ao médico · tela do Atendimento', () => {
  it('CA1, CA2 e CA6 · o resultado do parecer e a orientação em perguntas, sem o conteúdo clínico', async () => {
    await parecer('insuficiente')
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rita Exemplo · Pedir complemento ao médico')
    expect(screen.getByText('parecer Insuficiente · 1ª tentativa · hoje')).toBeTruthy()
    const resultado = screen.getByRole('heading', { name: 'Resultado do parecer' }).closest('section')!
    expect(resultado.textContent).toContain('INSUFICIENTE confirmado por Dra. Paula (exemplo) em 06/10 (G17).')
    expect(within(screen.getByRole('list', { name: 'Perguntas ao médico' })).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      '1. Qual a previsão de duração do quadro?',
      '2. O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
    ])
    expect(screen.getByLabelText('Orientação completa').textContent).toContain('Orientação para o médico de Rita Exemplo')
    expect(document.body.textContent).not.toContain('Impedimento físico')
    expect(document.body.textContent).not.toContain('Natureza do impedimento')
    expect(screen.getByRole('button', { name: 'Imprimir a orientação' })).toBeTruthy()
  })

  it('CA3 · "Enviar orientação" abre o Chatwoot com a mensagem pronta e conta como tentativa; a próxima espera 3 dias', async () => {
    await parecer('insuficiente')
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar orientação' }))
    const janela = await screen.findByRole('dialog')
    expect(((await within(janela).findByRole('textbox')) as HTMLTextAreaElement).value).toContain('Leve ao seu médico estas perguntas')
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar/ }))
    expect(await screen.findByText('Orientação enviada pelo Chatwoot e registrada como tentativa.')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Tentativas do pedido' }).textContent).toContain('1ª · 06/10 · Chatwoot · sem resposta')
    expect((screen.getByRole('button', { name: 'Enviar orientação' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A próxima tentativa é em 09/10, 3 dias depois da última.')).toBeTruthy()
  })

  it('CA3 · no limite, a sênior decide uma nova tentativa com prazo e justificativa', async () => {
    await parecer('insuficiente')
    await registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'chatwoot', resultado: 'sem-resposta' })
    agora = new Date(2026, 9, 9, 10, 0)
    await registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'ligacao', resultado: 'sem-resposta' })
    iniciarPerfil('?perfil=senior')
    await abrir()
    expect(screen.getByText('Passou do limite: a sênior decide. O pedido continua à vista aqui.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dispensar o parecer (duas sêniores)' }).getAttribute('href')).toBe('/casos/rita-exemplo-1/parecer/dispensa')
    const decidir = screen.getByRole('button', { name: 'Nova tentativa com prazo' }) as HTMLButtonElement
    expect(decidir.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Novo prazo (dd/mm/aaaa)' }), { target: { value: '20/10/2026' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Justificativa *' }), { target: { value: 'cliente está internada' } })
    fireEvent.click(decidir)
    expect(await screen.findByText('Nova tentativa registrada: o pedido volta para o Atendimento.')).toBeTruthy()
    expect(screen.getByText('parecer Insuficiente · 3ª tentativa · lembrete 20/10')).toBeTruthy()
  })

  it('CA4 e CA5 · o relatório anexado vira laudo novo e a prévia diz que responde ao pedido; o Suficiente encerra', async () => {
    await parecer('insuficiente')
    agora = new Date(2026, 9, 7, 9, 0)
    await enviarArquivos('rita-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'relatorio medico.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '4'.padStart(64, '0') }],
    })
    await abrir()
    const previa = screen.getByRole('heading', { name: 'O documento novo chegou · prévia da IA' }).closest('section')!
    expect(previa.textContent).toContain('A IA comparou Laudo médico · 07/10/2026 com o pedido: responde a tudo o que foi pedido. Já está com o Jurídico para conferir.')
  })

  it('CA5 · com o parecer refeito Suficiente, o pedido aparece encerrado', async () => {
    await parecer('insuficiente')
    await enviarArquivos('rita-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'relatorio medico.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '3'.padStart(64, '0') }],
    })
    await parecer('suficiente')
    await abrir()
    expect(screen.getByRole('heading', { name: '✓ Complemento encerrado' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enviar orientação' })).toBeNull()
  })
})
