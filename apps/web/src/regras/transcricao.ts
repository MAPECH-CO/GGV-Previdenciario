// As transcrições do caso (GGVP-46): busca sem acento, a situação de cada gravação e a contagem do topo. Regra, não IA.
import type { Gravacao, Trecho } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'

/** Sem acento e minúscula, letra por letra, para marcar o trecho no texto original. */
function letraPorLetra(texto: string): string {
  return Array.from({ length: texto.length }, (_, i) => (texto[i].normalize('NFD')[0] ?? texto[i]).toLowerCase()).join('')
}

/** Os trechos com a palavra, sem acento e sem maiúscula (CA2). Termo vazio: todos. */
export function buscarTrechos(trechos: Trecho[], termo: string): Trecho[] {
  const t = semAcento(termo)
  return t ? trechos.filter((x) => semAcento(x.texto).includes(t)) : trechos
}

/** O texto em pedaços, com a palavra buscada marcada (CA2). */
export function marcarBusca(texto: string, termo: string): { texto: string; marca: boolean }[] {
  const t = letraPorLetra(termo.trim())
  if (!t) return [{ texto, marca: false }]
  const base = letraPorLetra(texto)
  const pedacos: { texto: string; marca: boolean }[] = []
  let de = 0
  for (let i = base.indexOf(t); i !== -1; i = base.indexOf(t, i + t.length)) {
    if (i > de) pedacos.push({ texto: texto.slice(de, i), marca: false })
    pedacos.push({ texto: texto.slice(i, i + t.length), marca: true })
    de = i + t.length
  }
  if (de < texto.length) pedacos.push({ texto: texto.slice(de), marca: false })
  return pedacos
}

/** O selo de cada gravação na lista (CA3, CA4). */
export function situacaoDaGravacao(g: Gravacao): string {
  if (g.estado !== 'encerrada') return 'gravando'
  const situacoes = {
    'aguardando-internet': 'aguardando a internet',
    transcrevendo: 'transcrevendo…',
    falhou: 'transcrição falhou',
    'sem-audio': 'só registro',
    pronta: ['transcrita', ...g.marcas].join(' · '),
  }
  return situacoes[g.transcricao]
}

/** "2 gravações · 1 registro sem áudio" (Figma 1626:2). */
export function contagemDoTopo(gravacoes: Gravacao[]): string {
  const comAudio = gravacoes.filter((g) => g.audio).length
  const semAudio = gravacoes.length - comAudio
  const partes = [comAudio && `${comAudio} ${comAudio === 1 ? 'gravação' : 'gravações'}`, semAudio && `${semAudio} ${semAudio === 1 ? 'registro' : 'registros'} sem áudio`]
  return partes.filter(Boolean).join(' · ') || 'nenhuma conversa ainda'
}
