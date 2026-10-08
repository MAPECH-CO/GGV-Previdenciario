// As mensagens ao cliente (GGVP-102): o catálogo de modelos e o que o texto não pode ter. Regra, não IA.
import { problemaG20 } from './parecer.ts'

export type IdDoModelo =
  | 'convite'
  | 'lembrete'
  | 'confirmacao'
  | 'boas-vindas'
  | 'cobranca'
  | 'complemento'
  | 'resultado-favoravel'
  | 'resultado-desfavoravel'
  | 'pericia-orientacao'
  | 'pericia-presenca'
  | 'aviso-de-mudanca'

/**
 * O catálogo único dos modelos (CA1): quem costuma mandar e a trava de cada um. O resultado favorável só depois do OK da
 * advogada na prestação de contas (G8, CA7); o desfavorável, com o texto aprovado pelo Jurídico (CA8). A perícia é do
 * Jurídico administrativo (CA9).
 */
export const MODELOS_DE_MENSAGEM: Record<IdDoModelo, { nome: string; quem: 'Atendimento' | 'Jurídico administrativo'; trava?: 'ok-da-advogada' | 'texto-aprovado' }> = {
  convite: { nome: 'Convite da entrevista', quem: 'Atendimento' },
  lembrete: { nome: 'Lembrete da entrevista', quem: 'Atendimento' },
  confirmacao: { nome: 'Confirmação da entrevista', quem: 'Atendimento' },
  'boas-vindas': { nome: 'Boas-vindas', quem: 'Atendimento' },
  cobranca: { nome: 'Cobrança de documentos', quem: 'Atendimento' },
  complemento: { nome: 'Orientação para o médico (complemento)', quem: 'Atendimento' },
  'resultado-favoravel': { nome: 'Aviso de resultado favorável', quem: 'Atendimento', trava: 'ok-da-advogada' },
  'resultado-desfavoravel': { nome: 'Aviso de resultado desfavorável', quem: 'Atendimento', trava: 'texto-aprovado' },
  'pericia-orientacao': { nome: 'Perícia: data, o que levar e orientação', quem: 'Jurídico administrativo' },
  'pericia-presenca': { nome: 'Perícia: confirmar a presença', quem: 'Jurídico administrativo' },
  // GGVP-111, CA5: o aviso ao contato anterior quando os dados bancários mudam.
  'aviso-de-mudanca': { nome: 'Aviso de mudança dos dados', quem: 'Atendimento' },
}

/** Todo modelo termina dizendo que o escritório nunca pede a senha do gov.br por mensagem (GGVP-111, CA4). */
export const NUNCA_PEDIMOS_A_SENHA = 'O escritório nunca pede a sua senha do gov.br por mensagem.'

/** O texto com a frase da senha no fim, uma vez só. */
export function comAvisoDaSenha(texto: string): string {
  return !texto.trim() || texto.includes(NUNCA_PEDIMOS_A_SENHA) ? texto : `${texto.trim()} ${NUNCA_PEDIMOS_A_SENHA}`
}

/** O termo jurídico e a palavra simples para o cliente (CA3): a operação relatou dificuldade com leitura. */
const TERMOS_JURIDICOS: [RegExp, string][] = [
  [/\bimprocedente\b/i, '"improcedente": diga "o juiz negou o pedido"'],
  [/\bprocedente\b/i, '"procedente": diga "o juiz deu o benefício"'],
  [/\brpv\b/i, '"RPV": diga "pagamento pelo tribunal"'],
  [/tr[aâ]nsit\w* em julgado/i, '"trânsito em julgado": diga "o processo terminou"'],
  [/\bindeferid[oa]\b/i, '"indeferido": diga "negado"'],
  [/\bdeferid[oa]\b/i, '"deferido": diga "aprovado"'],
  [/\b(der|dib|dii)\b/i, 'sigla do INSS: diga a data por extenso'],
  [/\bautos\b/i, '"autos": diga "processo"'],
  [/\bliminar\b/i, '"liminar": diga "decisão de urgência"'],
  [/\bcar[eê]ncia\b/i, '"carência": diga "tempo mínimo de contribuição"'],
]

/** Frase com mais palavras que isto é longa para o cliente (CA3). */
export const PALAVRAS_POR_FRASE = 25

/** Esconder ou mudar a situação real (G11, CA9). */
const G11 = /\b(n[aã]o\s+(conte|fale|diga|mostre|comente)|escond\w*|omit\w*|finj\w*|fing\w*|disfar[cç]\w*|aumente\s+a\s+dor|exager\w*)\b/i
/** Pedir a senha do gov.br por mensagem (G9; GGVP-111, CA4). */
const PEDE_SENHA = /(\b(mande|envie|passe|informe|digite|mand[ae]r|enviar|passar|informar)\b|\bqual\s+[eé]\s)[^.?!]{0,40}\bsenha\b/i

/**
 * O que o texto não pode ter, antes de sair (CA3, CA9): `bloqueia` não deixa enviar (G9, G11, G20); `avisa` é a IA
 * apontando termo jurídico e frase longa, e quem envia decide.
 */
export function problemasDaMensagem(texto: string): { bloqueia: string[]; avisa: string[] } {
  const bloqueia = [
    PEDE_SENHA.test(texto) && 'O escritório nunca pede a senha do gov.br por mensagem (G9).',
    G11.test(texto) && 'Nunca oriente a esconder ou mudar a situação real (G11).',
    problemaG20(texto),
  ].filter((x): x is string => Boolean(x))
  const longas = texto.split(/[.!?]+/).filter((f) => f.trim().split(/\s+/).length > PALAVRAS_POR_FRASE).length
  const avisa = [
    ...TERMOS_JURIDICOS.filter(([termo]) => termo.test(texto)).map(([, simples]) => `Termo jurídico ${simples}.`),
    longas > 0 && `${longas === 1 ? 'Uma frase longa' : `${longas} frases longas`}: divida em frases curtas.`,
  ].filter((x): x is string => Boolean(x))
  return { bloqueia, avisa }
}

/** As conversas do contato no Chatwoot, a de mais mensagens primeiro (CA6; Lucas 06/10, Pedro 07/10). */
export function ordenarConversas<C extends { mensagens: number; id: number }>(conversas: C[]): C[] {
  return [...conversas].sort((a, b) => b.mensagens - a.mensagens || a.id - b.id)
}
