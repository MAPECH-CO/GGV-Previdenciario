import { describe, expect, it } from 'vitest'
import { CartaoDeAcao, PerguntaDoChat, RespostaDoChat } from './index.ts'

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
