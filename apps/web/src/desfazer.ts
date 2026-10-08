// Ctrl+Z em todo campo de escrita do portal (GGVP-84, CA9, Pedro 07/10). O navegador já desfaz o texto digitado, mas perde
// o passo nos campos com máscara (telefone, data, CPF), que o React reescreve a cada tecla. Aqui cada campo guarda o valor
// de antes de cada digitação e o devolve no Ctrl+Z, avisando o React como se a pessoa tivesse digitado. Campo de senha
// fica de fora: a senha não fica guardada em lugar nenhum (G9).

type Campo = HTMLInputElement | HTMLTextAreaElement

const pilhas = new WeakMap<Campo, string[]>()

function ehCampo(alvo: EventTarget | null): alvo is Campo {
  if (alvo instanceof HTMLTextAreaElement) return true
  return alvo instanceof HTMLInputElement && ['text', 'search', 'email', 'tel', 'url', 'number'].includes(alvo.type)
}

/** Antes de cada digitação, o valor de agora vai para a pilha do campo. */
function antesDeDigitar(e: Event) {
  if (!ehCampo(e.target)) return
  const pilha = pilhas.get(e.target) ?? []
  if (pilha.at(-1) !== e.target.value) pilha.push(e.target.value)
  pilhas.set(e.target, pilha)
}

function aoTeclar(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z' || !ehCampo(e.target)) return
  const campo = e.target
  const anterior = pilhas.get(campo)?.pop()
  if (anterior === undefined) return
  e.preventDefault()
  // O setter do protótipo, para o React ver a mudança no evento "input" que vem logo depois.
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(campo), 'value')!.set!.call(campo, anterior)
  campo.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Liga o Ctrl+Z no documento todo, uma vez. Devolve como desligar (para o teste). */
export function instalarDesfazer(doc: Document = document): () => void {
  doc.addEventListener('beforeinput', antesDeDigitar, true)
  doc.addEventListener('keydown', aoTeclar, true)
  return () => {
    doc.removeEventListener('beforeinput', antesDeDigitar, true)
    doc.removeEventListener('keydown', aoTeclar, true)
  }
}
