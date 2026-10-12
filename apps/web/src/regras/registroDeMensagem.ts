/** Apresentação do histórico legado: o servidor ainda não informa a origem de cada mensagem (GGVP-159). */
export function canalDoContato(canal: string, simulado: boolean): string {
  return canal.replace(/^(Chatwoot · [^·]+ · )(enviada|entregue|lida)$/, (_, inicio: string) =>
    inicio + (simulado ? 'simulado' : 'envio não confirmado'),
  )
}

export function eventoDaMensagem(texto: string, simulado: boolean): string {
  return texto.replace(/^Enviou pelo Chatwoot a mensagem (.+) \((enviada|entregue|lida)\)$/, (_, modelo: string) =>
    'Registro de mensagem no Chatwoot ' + modelo + ' (' + (simulado ? 'simulado' : 'envio não confirmado') + ')',
  )
}
