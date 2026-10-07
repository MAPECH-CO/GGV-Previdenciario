import { describe, expect, it } from 'vitest'
import { MODELOS_DE_MENSAGEM, ordenarConversas, problemasDaMensagem } from './mensagens.ts'

describe('Mensagens ao cliente (GGVP-102)', () => {
  it('CA1, CA7, CA8 e CA9 · o catálogo único dos modelos, com as travas do resultado e a perícia do Jurídico administrativo', () => {
    expect(Object.values(MODELOS_DE_MENSAGEM).map((m) => m.nome)).toEqual([
      'Convite da entrevista',
      'Lembrete da entrevista',
      'Confirmação da entrevista',
      'Boas-vindas',
      'Cobrança de documentos',
      'Orientação para o médico (complemento)',
      'Aviso de resultado favorável',
      'Aviso de resultado desfavorável',
      'Perícia: data, o que levar e orientação',
      'Perícia: confirmar a presença',
    ])
    expect(MODELOS_DE_MENSAGEM['resultado-favoravel'].trava).toBe('ok-da-advogada')
    expect(MODELOS_DE_MENSAGEM['resultado-desfavoravel'].trava).toBe('texto-aprovado')
    expect(MODELOS_DE_MENSAGEM['pericia-orientacao'].quem).toBe('Jurídico administrativo')
  })

  it('CA3 · aponta termo jurídico e frase longa, com a palavra simples; texto simples passa limpo', () => {
    expect(problemasDaMensagem('Olá, Lúcia! O juiz deu a pensão para você. Vamos te avisar a data.')).toEqual({ bloqueia: [], avisa: [] })
    const { avisa, bloqueia } = problemasDaMensagem('A sentença foi procedente e a RPV foi expedida após o trânsito em julgado.')
    expect(bloqueia).toEqual([])
    expect(avisa).toEqual([
      'Termo jurídico "procedente": diga "o juiz deu o benefício".',
      'Termo jurídico "RPV": diga "pagamento pelo tribunal".',
      'Termo jurídico "trânsito em julgado": diga "o processo terminou".',
    ])
    expect(problemasDaMensagem('O pedido foi improcedente.').avisa).toEqual(['Termo jurídico "improcedente": diga "o juiz negou o pedido".'])
    expect(problemasDaMensagem(`${'palavra '.repeat(26)}.`).avisa).toEqual(['Uma frase longa: divida em frases curtas.'])
  })

  it('CA9 · na perícia, nunca orientar a esconder a situação (G11) nem sugerir diagnóstico ou CID (G20)', () => {
    expect(problemasDaMensagem('Não conte ao perito que você voltou a trabalhar.').bloqueia).toEqual(['Nunca oriente a esconder ou mudar a situação real (G11).'])
    expect(problemasDaMensagem('Exagere a dor na hora da perícia.').bloqueia).toEqual(['Nunca oriente a esconder ou mudar a situação real (G11).'])
    expect(problemasDaMensagem('Diga ao perito que tem M54.5.').bloqueia).toEqual(['Tire o código de doença (CID): a orientação não sugere diagnóstico (G20).'])
    expect(problemasDaMensagem('Fale do seu diagnóstico.').bloqueia).toEqual(['Não sugira diagnóstico: a orientação diz só o que o documento deve abordar (G20).'])
    expect(problemasDaMensagem('Conte ao perito, com a verdade, o que você sente no dia a dia.').bloqueia).toEqual([])
  })

  it('G9 · a mensagem nunca pede a senha do gov.br; dizer que nunca pede, pode', () => {
    expect(problemasDaMensagem('Mande a sua senha do gov.br por aqui.').bloqueia).toEqual(['O escritório nunca pede a senha do gov.br por mensagem (G9).'])
    expect(problemasDaMensagem('Qual é a senha do gov.br?').bloqueia).toHaveLength(1)
    expect(problemasDaMensagem('O escritório nunca pede a sua senha do gov.br por mensagem.').bloqueia).toEqual([])
  })

  it('CA6 · as conversas do Chatwoot, a de mais mensagens primeiro', () => {
    const conversas = [
      { id: 3, mensagens: 2 },
      { id: 1, mensagens: 12 },
      { id: 2, mensagens: 12 },
    ]
    expect(ordenarConversas(conversas).map((c) => c.id)).toEqual([1, 2, 3])
  })
})
