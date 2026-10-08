// A entrevista gravada (GGVP-40): relógio, áudio, partes e a senha que não pode ficar no texto (G9). Regra, não IA.
import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Ficha, InformacaoExtraida, Trecho } from '../dados/tipos.ts'

const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** 462 → "00:07:42". */
export function relogio(segundos: number): string {
  return [Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60].map(doisDigitos).join(':')
}

/** 2292 → "38 min"; menos de um minuto conta como 1. */
export function minutos(segundos: number): string {
  return `${Math.max(1, Math.round(segundos / 60))} min`
}

/** O roteiro do Overlay · Entrevista (Figma 1581:348): a IA marca o que for respondido (CA11). */
export function roteiroDaEntrevista(ficha: Ficha): string[] {
  const acidentario = ficha.analise ? (ficha.analise.acidentario ? 'sim' : 'não') : 'a decidir'
  const senha = ficha.senhaGov.situacao === 'no-cofre' ? 'senha no cofre' : 'sem senha no cofre'
  const roteiro = [
    'Desde quando não consegue trabalhar (DII) e qual foi o último dia trabalhado?',
    `Acidentário já decidido antes da entrevista (D1.07): ${acidentario} · ${senha} (G9)`,
    'Tratamento em curso, previsão de melhora e limitações no dia a dia',
    'O que o INSS disse no último pedido?',
    'Laudos e exames: datas, o que dizem (sem sugerir ao médico o que escrever, G20)',
  ]
  if (ficha.beneficioInteresse?.startsWith('loas-')) roteiro.push('Quem mora na casa e a renda de cada um')
  return roteiro
}

/** Extensões de áudio aceitas, além de qualquer tipo "audio/..." (CA9). */
export const FORMATOS_DE_AUDIO = ['mp3', 'ogg', 'oga', 'opus', 'm4a', 'wav', 'webm', 'weba', 'aac', 'amr', 'wma', 'flac', '3gp']

/** Qualquer formato de áudio: pelo tipo do arquivo ou pela extensão (CA9). */
export function ehAudio(arquivo: { nome: string; tipo: string }): boolean {
  const extensao = arquivo.nome.toLowerCase().split('.').at(-1) ?? ''
  return arquivo.tipo.startsWith('audio/') || FORMATOS_DE_AUDIO.includes(extensao)
}

/** A transcrição recebe partes de até 24 MB (limite da OpenAI com folga). Para quem usa, não há limite (CA10). */
export const PARTE_MAXIMA = 24 * 1024 * 1024

export function partesDoAudio(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / PARTE_MAXIMA))
}

/** Junta o texto das partes na ordem, com o tempo corrido do áudio inteiro (CA10). */
export function juntarPartes(partes: { inicio: number; trechos: Trecho[] }[]): Trecho[] {
  return partes.flatMap((p) => p.trechos.map((t) => ({ ...t, aos: p.inicio + t.aos })))
}

export const SENHA_RETIRADA = '[senha retirada: vai ao cofre]'

const SENHA = /\bsenha\b/i
/** "a senha é girassol", "senha do gov.br: abc": a palavra que vem depois, seja qual for. */
const SENHA_DITA = /(\bsenha\b(?:\s+(?:do|da|de|no)\s+(?:gov(?:\.br)?|meu\s+inss|inss))?\s*(?:é|:|=)\s*)([^\s,.;!?]+)/gi

/** Parece senha: sem espaço, 4 ou mais caracteres, e letra com número, um símbolo de senha, maiúscula no meio ou 6+ números. */
function pareceSenha(palavra: string): boolean {
  const p = palavra.replace(/^[«"'(]+|[»"'),.;:!?]+$/g, '')
  if (p.length < 4) return false
  const letra = /\p{L}/u.test(p)
  const numero = /\d/.test(p)
  return (letra && numero) || /[#@$%&*_+=!]/.test(p.slice(1)) || /\p{Ll}\p{Lu}/u.test(p) || /^\d{6,}$/.test(p)
}

function limpar(texto: string): string {
  return texto
    .replace(SENHA_DITA, (_, antes: string) => `${antes}${SENHA_RETIRADA}`)
    .split(/(\s+)/)
    .map((palavra) => (pareceSenha(palavra) ? SENHA_RETIRADA : palavra))
    .join('')
}

/**
 * Tira do texto a senha dita (CA3, CA7, G9): na fala que cita "senha" e na resposta logo depois. A proteção principal é
 * pausar a gravação no cofre (CA6); esta pega o que escapou.
 */
export function tirarSenhas(trechos: Trecho[]): Trecho[] {
  return trechos.map((t, i) => {
    const perto = SENHA.test(t.texto) || (i > 0 && SENHA.test(trechos[i - 1].texto))
    return perto ? { ...t, texto: limpar(t.texto) } : t
  })
}

/** Como a IA marca cada informação na tela da entrevista (Figma 73:560). */
export function situacaoDaInformacao(info: InformacaoExtraida, ficha: Ficha): 'confirmado' | 'detectado' | 'pedir' | 'cofre' {
  if (info.destino === 'documentacao') return 'pedir'
  if (info.destino === 'cofre') return 'cofre'
  return info.campo && (ficha[info.campo] ?? '') === info.valor ? 'confirmado' : 'detectado'
}

/** "Pendências que a IA apontou" (Figma 73:560): o que pedir, o que perguntar e o que confirmar. */
export function pendenciasDaEntrevista(ficha: Ficha, extraidas: InformacaoExtraida[]): string[] {
  const pedir = extraidas.filter((e) => e.destino === 'documentacao').map((e) => e.valor)
  const pendencias = pedir.length ? [`Pedir ${pedir.join(' e ')} (kit, G1).`] : []
  if (!ficha.analise) pendencias.push('Perguntar se houve acidente de trabalho (muda o benefício).')
  const falta = [!ficha.cep && 'o CEP', !ficha.contatoApoio && !extraidas.some((e) => e.campo === 'contatoApoio') && 'o contato de apoio'].filter(Boolean)
  if (falta.length) pendencias.push(`Confirmar ${falta.join(' e ')}.`)
  return pendencias
}

/** Documentos que a IA lista para o cliente trazer (GGVP-46, CA7): os de sempre que a pasta não tem e os citados. */
export function documentosDaEntrevista(ficha: Ficha, extraidas: InformacaoExtraida[]): string[] {
  const naPasta = new Set(ficha.documentos.map((d) => d.nome.toLowerCase()))
  const deSempre = ['RG', 'CPF', 'Comprovante de residência', 'CNIS'].filter((d) => !naPasta.has(d.toLowerCase()))
  const citados = extraidas.filter((e) => e.destino === 'documentacao').map((e) => e.valor.charAt(0).toUpperCase() + e.valor.slice(1))
  return [...deSempre, ...citados]
}

/** O resumo que a IA faria da entrevista (simulado): junta o que foi dito, sem concluir o benefício (G3). */
export function resumoDaEntrevista(ficha: Ficha, extraidas: InformacaoExtraida[]): string {
  const valor = (id: string) => extraidas.find((e) => e.id === id)?.valor
  const partes = [
    valor('desde') && `sem trabalhar desde ${valor('desde')}`,
    valor('vinculo') && `último vínculo: ${valor('vinculo')}`,
    valor('pedido') && `pedido anterior: ${valor('pedido')}`,
    valor('laudos') && `citou ${valor('laudos')}`,
    valor('estado-civil') && `estado civil: ${valor('estado-civil')}`,
  ].filter(Boolean)
  const beneficio = ficha.beneficioInteresse && ficha.beneficioInteresse !== 'nao-sei' ? ` Procura ${nomeBeneficio(ficha.beneficioInteresse)}.` : ''
  const dito = partes.length ? `${partes.join('; ')}.` : 'a gravação foi curta: pouco a resumir.'
  return `${ficha.nome}: ${dito}${beneficio} O benefício é a advogada que define (D1.12, G3).`
}
