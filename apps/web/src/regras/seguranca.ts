// Terceiro não se passa pelo cliente (GGVP-111): o dado protegido, a verificação e o que muda nos dados bancários. Regra,
// não IA.
import { normalizarTelefone } from '../campos.ts'
import type { IdPerfil } from '../dados/perfis.ts'
import type { EdicaoFicha, Ficha } from '../dados/tipos.ts'
import type { CanalDoRegistro, ComQuem } from './conversa.ts'

/** Como o escritório confirma que é o cliente: chamada de vídeo ou o cliente no escritório (Lucas, 07/10). */
export type ComoVerificou = 'video' | 'presencial'

export const COMO_VERIFICOU: Record<ComoVerificou, string> = { video: 'Chamada de vídeo com o cliente', presencial: 'Cliente no escritório' }

/** A verificação, e a alteração em contrato novo (CA1). */
export type Verificacao = { como: ComoVerificou; contratoNovo: true }

/** O dado que ninguém muda se passando pelo cliente (CA1): telefone, e-mail e dados bancários. */
export const DADOS_PROTEGIDOS = ['telefone', 'email', 'dadosBancarios'] as const
export type DadoProtegido = (typeof DADOS_PROTEGIDOS)[number]

export const ehProtegido = (campo: string): campo is DadoProtegido => (DADOS_PROTEGIDOS as readonly string[]).includes(campo)

/** Na conversa presencial com o próprio cliente, ele está no escritório: a verificação já vale (CA1, CA8). */
export function verificacaoDaConversa(c: { canal: CanalDoRegistro; comQuem: ComQuem }): Verificacao | null {
  return c.canal === 'presencial' && c.comQuem === 'cliente' ? { como: 'presencial', contratoNovo: true } : null
}

/** O que falta para mudar um dado protegido (CA1, CA8); o servidor confere de novo. */
export function motivoParaNaoMudar(campo: string, verificacao: Partial<Verificacao> | null | undefined): string | null {
  if (!ehProtegido(campo)) return null
  if (!verificacao?.como || !(verificacao.como in COMO_VERIFICOU)) {
    return 'Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.'
  }
  if (verificacao.contratoNovo !== true) return 'A alteração vai em contrato novo: marque que ela vai no contrato novo.'
  return null
}

/** O roteiro para quem não passou pela verificação e pede informação do caso (CA3). */
export function retornoPeloContato(telefoneCadastrado: string): string {
  return `Sem a verificação, não passe dado do caso. Diga só: "Vou retornar pelo contato cadastrado", e ligue para ${telefoneCadastrado}.`
}

/** O lembrete do chat e da ligação da perícia (CA6, CA7). */
export const LEMBRETE_DA_IDENTIDADE = 'Antes de passar dado do caso, confirme que é o cliente: chamada de vídeo, no escritório ou retornando pelo contato cadastrado.'

/** Os dados para o repasse ao cliente: Pix na conta cadastrada (RPV) ou na ida ao banco (Lucas, 07/10). */
export type DadosBancarios = { banco: string; agencia: string; conta: string; pix?: string }

/** O que está errado nos dados bancários; nada, null. O servidor confere de novo. */
export function erroDosDadosBancarios(d: Partial<DadosBancarios>): string | null {
  if (!d.banco || d.banco.trim().length < 2 || d.banco.trim().length > 60) return 'Escreva o banco.'
  if (!/^\d{4}(-\d)?$/.test(d.agencia ?? '')) return 'Agência com 4 números (e o dígito, se houver): 0001 ou 0001-9.'
  if (!/^\d{3,12}-[\dXx]$/.test(d.conta ?? '')) return 'Conta com os números e o dígito: 12345-6.'
  if ((d.pix ?? '').length > 80) return 'Chave Pix até 80 letras.'
  return null
}

/** Quem dá a segunda confirmação da mudança bancária (CA5): outra pessoa, do Atendimento líder ou do Jurídico. */
export function podeConfirmarSegunda(perfil: IdPerfil | undefined, quem: string, pediu: string): string | null {
  if (quem === pediu) return 'A segunda confirmação é de outra pessoa, não de quem pediu.'
  if (perfil !== 'atendimento-lider' && perfil !== 'advogada' && perfil !== 'senior') {
    return 'A segunda confirmação é do Atendimento líder, da advogada ou da Sênior.'
  }
  return null
}

/** Caso perto da prestação de contas (CA2): ganho na sentença, RPV ou benefício deferido. */
export function pertoDaPrestacao(etapa: string): boolean {
  return /senten[cç]a procedente|\brpv\b|benef[ií]cio deferido|presta[cç][aã]o de contas/i.test(etapa)
}

/** O telefone e o e-mail que a edição muda (CA1). Completar o que estava em branco (a ficha do scanner) não é mudança. */
export function camposProtegidosQueMudam(ficha: Pick<Ficha, 'telefone' | 'email'>, edicao: Pick<EdicaoFicha, 'telefone' | 'email'>): ('telefone' | 'email')[] {
  const antes = { telefone: normalizarTelefone(ficha.telefone ?? ''), email: (ficha.email ?? '').trim().toLowerCase() }
  const mudaTelefone = antes.telefone !== '' && antes.telefone !== normalizarTelefone(edicao.telefone ?? '')
  const mudaEmail = antes.email !== '' && antes.email !== (edicao.email ?? '').trim().toLowerCase()
  return [mudaTelefone && ('telefone' as const), mudaEmail && ('email' as const)].filter((x): x is 'telefone' | 'email' => Boolean(x))
}
