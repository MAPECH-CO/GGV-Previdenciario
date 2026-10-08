// EXEMPLO. Quem está editando a mesma ficha agora (GGVP-43, CA11), entre as abas do mesmo navegador pelo
// BroadcastChannel. Ligar no servidor: trocar pela presença do Supabase (realtime), com o nome de quem está logado.

const CANAL = 'ggv.presenca'

type Mensagem = { tipo: 'abri' | 'estou' | 'sai'; fichaId: string; aba: string; quem: string }

/**
 * Avisa as outras abas que esta está editando a ficha e chama `aoMudar` com quem mais está nela. Devolve a função que
 * sai. Sem BroadcastChannel (navegador antigo), não avisa.
 */
export function entrarNaEdicao(fichaId: string, quem: string, aoMudar: (outros: string[]) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const aba = crypto.randomUUID()
  const canal = new BroadcastChannel(CANAL)
  const outros = new Map<string, string>()
  const enviar = (tipo: Mensagem['tipo']) => canal.postMessage({ tipo, fichaId, aba, quem } satisfies Mensagem)
  canal.onmessage = ({ data }: MessageEvent<Mensagem>) => {
    if (data.fichaId !== fichaId || data.aba === aba) return
    if (data.tipo === 'sai') outros.delete(data.aba)
    else outros.set(data.aba, data.quem)
    // Quem abriu agora precisa saber que esta aba já estava aqui.
    if (data.tipo === 'abri') enviar('estou')
    aoMudar([...outros.values()])
  }
  enviar('abri')
  // Link que recarrega a página não passa pela saída do React: a aba avisa ao sair.
  const sair = () => {
    removeEventListener('pagehide', sair)
    enviar('sai')
    canal.close()
  }
  addEventListener('pagehide', sair)
  return sair
}
