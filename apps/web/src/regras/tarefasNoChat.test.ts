import { describe, expect, it } from 'vitest'
import { citaAlguemDaLista, perguntaDasTarefas, quandoVence, respostaDasTarefas, type TarefaDaTela } from './tarefasNoChat.ts'

const HOJE = '2026-10-16'
const tarefa = (quem: string, acao: string, prazo: string | null, urgente = false): TarefaDaTela => ({ quem, acao, detalhe: '', prazo, urgente, href: '/' })

describe('as tarefas no chat (Pedro, 16/10)', () => {
  it('lê o prazo como a linha mostra: hoje, a hora de hoje, até dd/mm; a data de meses atrás é do ano que vem', () => {
    expect(['hoje', 'vence hoje', '15:30', 'até 23/10', 'vence 30/09', 'até 05/01', undefined, 'sem prazo'].map((p) => quandoVence(p, HOJE))).toEqual([
      HOJE,
      HOJE,
      HOJE,
      '2026-10-23',
      '2026-09-30',
      '2027-01-05',
      null,
      null,
    ])
  })

  it('reconhece as perguntas do Pedro sobre as tarefas dele, e não a de criar tarefa nem a do caso', () => {
    for (const p of [
      'qq eu tenho pra fazer hoje ai, esta tudo em dia?',
      'o que tem aí para a gente fazer?',
      'O que está faltando para mim fazer aí?',
      'Com qual demanda eu estou aí?',
      'Tem alguma coisa para mim fazer?',
      'qual é a próxima tarefa da Maria Exemplo?',
    ])
      expect(perguntaDasTarefas(p), p).toBe(true)
    for (const p of ['crie uma tarefa para a Documentação cobrar o CNIS', 'o que falta no caso da Maria?', 'o que estourou o limite?']) expect(perguntaDasTarefas(p), p).toBe(false)
  })

  it('conta pelo código: 6 tarefas, 1 vence hoje; a de hoje vem primeiro e é por onde começar', () => {
    const lista = [
      tarefa('Maria Souza (exemplo)', 'Protocolar no Meu INSS', null),
      tarefa('José Ramos (exemplo)', 'Protocolar no Meu INSS', null),
      tarefa('Lúcia Prado (exemplo)', 'Protocolar no Meu INSS', null),
      tarefa('Maria Souza (exemplo)', 'Marcar perícia médica', null),
      tarefa('Maria Exemplo', 'Marcar perícia', HOJE, true),
      tarefa('Antônio Exemplo', 'Orientar para a perícia', '2026-10-23'),
    ]
    const r = respostaDasTarefas(lista, HOJE)
    expect(r.texto).toBe('Você tem **6 tarefas abertas**. **1 vence hoje**. Comece por Maria Exemplo · Marcar perícia.')
    const widget = r.blocos.find((b) => b.tipo === 'widget')
    expect(widget?.tipo === 'widget' && widget.widget.tipo === 'lista' && widget.widget.itens.map((i) => [i.titulo, i.selo?.texto])).toEqual([
      ['Maria Exemplo · Marcar perícia', 'hoje'],
      ['Antônio Exemplo · Orientar para a perícia', 'até 23/10'],
      ['Maria Souza (exemplo) · Protocolar no Meu INSS', undefined],
      ['José Ramos (exemplo) · Protocolar no Meu INSS', undefined],
      ['Lúcia Prado (exemplo) · Protocolar no Meu INSS', undefined],
      ['Maria Souza (exemplo) · Marcar perícia médica', undefined],
    ])
  })

  it('atrasada conta à parte; sem nada para hoje, diz que está em dia; lista vazia diz que está vazia', () => {
    expect(respostaDasTarefas([tarefa('Ana', 'Ligar', '2026-10-10'), tarefa('Beto Lima', 'Cobrar', HOJE)], HOJE).texto).toBe(
      'Você tem **2 tarefas abertas**. **1 atrasada** e **1 vence hoje**. Comece por Ana · Ligar.',
    )
    expect(respostaDasTarefas([tarefa('Ana Paula', 'Ligar', '2026-10-20')], HOJE).texto).toBe('Você tem **1 tarefa aberta**. Nenhuma atrasada nem vencendo hoje: está em dia.')
    expect(respostaDasTarefas([], HOJE).texto).toBe('Sua lista está vazia: nenhuma tarefa aberta para você agora.')
  })

  it('a pergunta que cita alguém da lista é sobre o cliente: fica com o motor do chat', () => {
    const lista = [tarefa('Maria Souza (exemplo)', 'Protocolar no Meu INSS', null), tarefa('Maria Exemplo', 'Marcar perícia', HOJE)]
    expect(citaAlguemDaLista(lista, 'qual é a próxima tarefa da Maria Exemplo?')).toBe(true)
    expect(citaAlguemDaLista(lista, 'o que a maria souza precisa?')).toBe(true)
    expect(citaAlguemDaLista(lista, 'o que eu tenho pra fazer hoje?')).toBe(false)
  })
})
