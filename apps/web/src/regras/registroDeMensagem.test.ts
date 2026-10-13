import { describe, expect, it } from 'vitest'
import { canalDoContato, eventoDaMensagem } from './registroDeMensagem.ts'

describe('Rótulos do histórico de mensagens', () => {
  it.each(['enviada', 'entregue', 'lida'])('mensagem %s de exemplo aparece como simulado; legado do servidor não comprova envio', (status) => {
    const canal = 'Chatwoot · 14:32 · ' + status
    const evento = 'Enviou pelo Chatwoot a mensagem «Boas-vindas» (' + status + ')'
    expect(canalDoContato(canal, true)).toBe('Chatwoot · 14:32 · simulado')
    expect(eventoDaMensagem(evento, true)).toBe('Registro de mensagem no Chatwoot «Boas-vindas» (simulado)')
    expect(canalDoContato(canal, false)).toBe('Chatwoot · 14:32 · envio não confirmado')
    expect(eventoDaMensagem(evento, false)).toBe('Registro de mensagem no Chatwoot «Boas-vindas» (envio não confirmado)')
  })

  it.each([true, false])('preserva falhas e registros de outros canais (simulado: %s)', (simulado) => {
    expect(canalDoContato('Chatwoot · 14:32 · não saiu', simulado)).toBe('Chatwoot · 14:32 · não saiu')
    expect(canalDoContato('Ligação', simulado)).toBe('Ligação')
    const falha = 'A mensagem «Boas-vindas» não saiu pelo Chatwoot: serviço indisponível.'
    expect(eventoDaMensagem(falha, simulado)).toBe(falha)
    expect(eventoDaMensagem('Cliente confirmou que recebeu o documento.', simulado)).toBe('Cliente confirmou que recebeu o documento.')
  })
})
