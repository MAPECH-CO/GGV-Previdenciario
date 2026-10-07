// A conversa com o lead ou o cliente (fluxo D5, GGVP-12): canal, com quem, modo e quem pode. Regra, não IA.
import { formatarTelefone, isoParaData, normalizarTelefone } from '../campos.ts'
import type { IdPerfil } from '../dados/perfis.ts'

/** O canal da decisão "Canal da conversa" do Miro. WhatsApp e vídeo saem (Lucas, 06/10). */
export type CanalDoRegistro = 'ligacao' | 'presencial'
/** "Com quem falou" (Figma 2144:2). */
export type ComQuem = 'cliente' | 'familiar' | 'medico'
/** Gravar agora, anexar a ligação já feita ou só escrever (GGVP-76, CA4 e CA9). */
export type ModoDoRegistro = 'tempo-real' | 'arquivo' | 'escrito'
/** Quem conduz a conversa: o Atendimento ou o Jurídico (Lucas, 06/10). */
export type PapelNaConversa = 'atendimento' | 'juridico'
/** O que a conversa muda na ficha do cliente: contato, endereço, grupo familiar (D5.03). */
export type CampoDaFicha = 'telefone' | 'endereco' | 'contatoApoio' | 'estadoCivil' | 'email'
/** O que a conversa muda nos campos do processo: datas, fatos novos, documentos citados (D5.03). */
export type CampoDoProcesso = 'pericia' | 'fato' | 'documento'
/** Uma coisa dita na conversa, como a IA extrai: onde vai, o campo e o valor; `saude`, dado sensível. */
export type Dito =
  | { onde: 'ficha'; campo: CampoDaFicha; valor: string; saude?: undefined }
  | { onde: 'processo'; campo: CampoDoProcesso; valor: string; saude?: true }

export const CANAIS_DO_REGISTRO: Record<CanalDoRegistro, { rotulo: string; passo: string }> = {
  ligacao: { rotulo: 'Ligação', passo: 'Telefone — subir a gravação da ligação' },
  presencial: { rotulo: 'Presencial', passo: 'Presencial — conversar e gravar' },
}

export const COM_QUEM: Record<ComQuem, string> = { cliente: 'Cliente', familiar: 'Familiar ou contato de apoio', medico: 'Médico ou clínica' }

export const MODOS_DO_REGISTRO: Record<ModoDoRegistro, { rotulo: string; detalhe: string }> = {
  'tempo-real': { rotulo: 'Transcrição em tempo real', detalhe: 'avise o cliente antes de gravar (G10)' },
  arquivo: { rotulo: 'Anexar arquivo', detalhe: 'o áudio de uma ligação já feita' },
  escrito: { rotulo: 'Sem áudio', detalhe: 'só o registro escrito' },
}

/** O tamanho do registro escrito, como o da conversa sem áudio da GGVP-46. */
export const TAMANHO_DO_REGISTRO = { minimo: 3, maximo: 4000 }

/** O canal sugere o modo: a ligação já aconteceu e sobe gravada; no escritório, grava agora. Os três valem nos dois. */
export function modoDoCanal(canal: CanalDoRegistro): ModoDoRegistro {
  return canal === 'ligacao' ? 'arquivo' : 'tempo-real'
}

/** Quem pode conduzir e gravar a conversa: o Atendimento e o Jurídico. Os outros perfis, ninguém. */
export function papelDoPerfil(id: IdPerfil | undefined): PapelNaConversa | null {
  if (id === 'atendimento' || id === 'atendimento-lider') return 'atendimento'
  if (id === 'advogada' || id === 'senior' || id === 'senior-2') return 'juridico'
  return null
}

export type PedidoDeConversa = { canal?: CanalDoRegistro; comQuem?: ComQuem; modo?: ModoDoRegistro; processoId?: string; registro?: string }

/** O que falta para abrir a conversa (CA3, CA4). A tela mostra; o servidor de exemplo confere de novo. */
export function motivoParaNaoAbrir(p: PedidoDeConversa, papel: PapelNaConversa | null, processos: string[]): string | null {
  if (!papel) return 'A conversa com o cliente é do Atendimento e do Jurídico.'
  if (!p.canal || !(p.canal in CANAIS_DO_REGISTRO)) return 'Escolha o canal: ligação ou presencial.'
  if (!p.comQuem || !(p.comQuem in COM_QUEM)) return 'Marque com quem você falou.'
  if (!p.modo || !(p.modo in MODOS_DO_REGISTRO)) return 'Escolha a gravação.'
  if (p.processoId !== undefined && !processos.includes(p.processoId)) return 'Processo não encontrado.'
  if (p.processoId === undefined && processos.length > 1) return 'Escolha o processo da conversa.'
  const texto = p.registro?.trim() ?? ''
  if (p.modo === 'escrito' && texto.length < TAMANHO_DO_REGISTRO.minimo) return 'Escreva o resumo da conversa.'
  if (texto.length > TAMANHO_DO_REGISTRO.maximo) return `O resumo vai até ${TAMANHO_DO_REGISTRO.maximo} letras.`
  return null
}

// GGVP-80 · Transcrever e identificar o que mudou.

/** Os campos que a conversa pode mudar, com o nome que a pessoa lê e onde ficam (CA5). */
export const CAMPOS_DA_CONVERSA: Record<CampoDaFicha | CampoDoProcesso, string> = {
  telefone: 'telefone de contato',
  endereco: 'endereço',
  contatoApoio: 'contato de apoio',
  estadoCivil: 'estado civil',
  email: 'e-mail',
  pericia: 'data da perícia do INSS',
  fato: 'fato novo',
  documento: 'documento citado',
}

export const ONDE: Record<Dito['onde'], string> = { ficha: 'Ficha do cliente', processo: 'Campos do processo' }

/** Uma mudança que a conversa traz: o valor de antes (vazio: dado novo), o dito, e o trecho de onde saiu (CA5). */
export type Mudanca = {
  id: string
  onde: Dito['onde']
  campo: CampoDaFicha | CampoDoProcesso
  rotulo: string
  antes: string
  depois: string
  /** Segundos desde o início do áudio. */
  aos: number
  trecho: string
  saude?: true
}

/** O valor como a pessoa lê: telefone com máscara, data dd/mm/aaaa. */
export function valorLido(campo: Mudanca['campo'], valor: string): string {
  if (!valor) return '—'
  if (campo === 'telefone') return formatarTelefone(valor)
  if (campo === 'pericia') return isoParaData(valor) ?? valor
  return valor
}

const igual = (campo: Mudanca['campo'], a: string, b: string) =>
  campo === 'telefone' ? normalizarTelefone(a) === normalizarTelefone(b) : a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * O que mudou (CA2, CA5): cada coisa dita, comparada com a ficha e com os campos do processo. O que é igual ao guardado
 * não entra. Fato novo e documento citado sempre entram: somam ao caso. Sem processo, o que é do processo fica de fora.
 */
export function oQueMudou(
  ditos: (Dito & { aos: number; trecho: string })[],
  ficha: Partial<Record<CampoDaFicha, string>>,
  processo: Partial<Record<CampoDoProcesso, string>> | null,
): Mudanca[] {
  return ditos.flatMap((d, i) => {
    if (d.onde === 'processo' && !processo) return []
    const antes = d.onde === 'ficha' ? (ficha[d.campo] ?? '') : d.campo === 'pericia' ? (processo![d.campo] ?? '') : ''
    if (antes && igual(d.campo, antes, d.valor)) return []
    return [{ id: `${d.onde}-${d.campo}-${i}`, onde: d.onde, campo: d.campo, rotulo: CAMPOS_DA_CONVERSA[d.campo], antes, depois: d.valor, aos: d.aos, trecho: d.trecho, ...(d.saude && { saude: true as const }) }]
  })
}

/** A decisão ◯ "O que precisa atualizar?" do Miro: a ficha, o processo ou os dois. */
export function oQuePrecisaAtualizar(mudancas: Mudanca[]): Dito['onde'][] {
  return (['ficha', 'processo'] as const).filter((onde) => mudancas.some((m) => m.onde === onde))
}
