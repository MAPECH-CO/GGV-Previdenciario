import { describe, expect, it } from 'vitest'
import { jaEraCliente, mensagemDeBoasVindas } from './boasVindas.ts'

describe('Boas-vindas (GGVP-97)', () => {
  it('CA3 · já era cliente quando tem outro processo, inclusive no processo novo', () => {
    expect(jaEraCliente({ processos: [{ id: 'a', beneficio: 'loas-idoso', etapa: '' }] }, 'a')).toBe(false)
    const duas = { processos: [{ id: 'a', beneficio: 'x', etapa: '' }, { id: 'b', beneficio: 'y', etapa: '' }] }
    expect(jaEraCliente(duas, 'b')).toBe(true)
    expect(jaEraCliente(duas, 'a')).toBe(true)
  })

  it('CA1 e CA5 · o modelo leva as cópias e as pendências do checklist, em linguagem simples', () => {
    expect(mensagemDeBoasVindas({ nome: 'Rita Exemplo', beneficio: 'LOAS Deficiente', copias: ['contrato', 'procuração'], faltam: ['Comprovante de renda', 'Ficha de grupo familiar'] })).toBe(
      'Olá, Rita! Boas-vindas ao escritório GGV. Seu caso de LOAS Deficiente está aberto e a nossa equipe cuida dele daqui em diante. ' +
        'Junto com esta mensagem vão as cópias do contrato e da procuração que você assinou. ' +
        'Para o seu caso andar, ainda precisamos destes documentos: Comprovante de renda e Ficha de grupo familiar. Pode mandar foto por aqui ou trazer ao escritório. ' +
        'Qualquer dúvida, é só responder esta mensagem.',
    )
  })

  it('CA1 · sem pendência e sem cópia, a mensagem diz que já chegou tudo', () => {
    const texto = mensagemDeBoasVindas({ nome: 'Pedro Exemplo', beneficio: 'LOAS Idoso', copias: [], faltam: [] })
    expect(texto).toContain('Todos os documentos de que precisamos já chegaram.')
    expect(texto).not.toContain('cópias')
  })
})
