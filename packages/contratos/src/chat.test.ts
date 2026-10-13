import { describe, expect, it } from 'vitest'
import { BlocoDaResposta, CartaoDeAcao, PerguntaDoChat, RespostaDoChat, TextoDaFala, WidgetDoChat } from './index.ts'

const sugestao = {
  chamadaId: '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6',
  sugestao: true as const,
  texto: 'Antônio Exemplo está na vigília.',
  fontes: [{ tipo: 'caso' as const, referencia: 'antonio-exemplo-1' }],
  modelo: 'simulado',
  geradaEm: '2026-10-08T10:00:00.000Z',
  alerta: null,
}

describe('GGVP-82 · contrato do chat', () => {
  it('a pergunta pede texto ou anexo', () => {
    expect(PerguntaDoChat.parse({ texto: '  o que falta no caso da Maria?  ' })).toEqual({ texto: 'o que falta no caso da Maria?', anexos: [] })
    expect(PerguntaDoChat.safeParse({ texto: ' ' }).success).toBe(false)
    expect(PerguntaDoChat.safeParse({ texto: '', anexos: [{ nome: 'laudo.pdf', tamanho: 10 }] }).success).toBe(true)
  })

  it('a resposta traz a sugestão com fontes; a recusa traz o portão', () => {
    expect(RespostaDoChat.parse({ tipo: 'resposta', sugestao, links: [{ rotulo: 'Abrir o caso', href: '/casos/antonio-exemplo-1' }] }).links).toHaveLength(1)
    expect(RespostaDoChat.safeParse({ tipo: 'recusa', sugestao, links: [], portao: 'G2' }).success).toBe(true)
    expect(RespostaDoChat.safeParse({ tipo: 'recusa', sugestao, links: [], portao: 'sênior' }).success).toBe(false)
    expect(RespostaDoChat.safeParse({ tipo: 'resposta', sugestao: { ...sugestao, sugestao: false }, links: [] }).success).toBe(false)
  })

  it('o cartão tem passos, o que conferir, as travas e o botão de confirmar', () => {
    const cartao = {
      id: 'a1',
      tipo: 'criar-tarefa',
      titulo: 'Antônio Exemplo · Cobrar documento',
      passos: ['Criar a tarefa'],
      conferir: [],
      travas: [],
      responsavel: { nome: 'Jéssica (exemplo)', setor: 'Documentação' },
      rotuloConfirmar: 'Confirmar e criar a tarefa',
    }
    expect(CartaoDeAcao.parse(cartao).responsavel?.nome).toBe('Jéssica (exemplo)')
    expect(CartaoDeAcao.safeParse({ ...cartao, passos: [] }).success).toBe(false)
    expect(CartaoDeAcao.safeParse({ ...cartao, tipo: 'aprovar-peticao' }).success).toBe(false)
  })
})

describe('chat com widgets (12/10)', () => {
  it('aceita os seis widgets e recusa dado fora do formato', () => {
    const bons = [
      { tipo: 'numeros', itens: [{ rotulo: 'Abertas', valor: 12 }, { rotulo: 'Urgentes', valor: 4, tom: 'erro' }] },
      { tipo: 'lista', titulo: 'Tarefas', itens: [{ titulo: 'Ana · Cobrar', href: '/casos/1', selo: { texto: 'hoje', tom: 'acento' } }] },
      { tipo: 'prazos', titulo: 'Prazos', inicio: '2026-10-12', itens: [{ data: '2026-10-13', oQue: 'Manifestar', urgente: true }] },
      { tipo: 'etapas', itens: [{ rotulo: 'INSS', estado: 'feita' }, { rotulo: 'Justiça', estado: 'atual' }] },
      { tipo: 'linha-do-tempo', titulo: 'Últimos', itens: [{ quando: '2026-10-10', texto: 'Juiz pediu perícia' }] },
      { tipo: 'barras', titulo: 'Por cliente', itens: [{ rotulo: 'Ana', valor: 3 }] },
    ]
    for (const w of bons) expect(WidgetDoChat.safeParse(w).success, w.tipo).toBe(true)
    expect(WidgetDoChat.safeParse({ tipo: 'numeros', itens: [{ rotulo: 'x', valor: 1.5 }] }).success).toBe(false)
    expect(WidgetDoChat.safeParse({ tipo: 'numeros', itens: Array(5).fill({ rotulo: 'x', valor: 1 }) }).success).toBe(false)
    expect(WidgetDoChat.safeParse({ tipo: 'lista', titulo: 't', itens: [{ titulo: 'a', href: 'https://fora.com' }] }).success).toBe(false)
    for (const href of ['//fora.com', '/\\fora.com', '/casos\\x'])
      expect(WidgetDoChat.safeParse({ tipo: 'lista', titulo: 't', itens: [{ titulo: 'a', href }] }).success, href).toBe(false)
    expect(WidgetDoChat.safeParse({ tipo: 'prazos', titulo: 't', inicio: '12/10/2026', itens: [] }).success).toBe(false)
    expect(WidgetDoChat.safeParse({ tipo: 'grafico', itens: [] }).success).toBe(false)
  })

  it('a resposta pode vir com blocos de texto e widget; sem blocos continua valendo', () => {
    const blocos = [{ tipo: 'texto', texto: 'Hoje:' }, { tipo: 'widget', widget: { tipo: 'barras', titulo: 'x', itens: [{ rotulo: 'a', valor: 1 }] } }]
    expect(BlocoDaResposta.array().parse(blocos)).toHaveLength(2)
    expect(RespostaDoChat.parse({ tipo: 'resposta', sugestao, links: [], blocos }).blocos).toHaveLength(2)
    expect(RespostaDoChat.parse({ tipo: 'resposta', sugestao, links: [] }).blocos).toBeUndefined()
    expect(RespostaDoChat.safeParse({ tipo: 'resposta', sugestao, links: [], blocos: Array(13).fill(blocos[0]) }).success).toBe(false)
  })

  it('a fala transcrita é só o texto', () => {
    expect(TextoDaFala.parse({ texto: 'o que tem hoje' })).toEqual({ texto: 'o que tem hoje' })
  })
})
