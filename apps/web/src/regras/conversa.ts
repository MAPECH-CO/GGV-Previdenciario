// A conversa com o lead ou o cliente (fluxo D5, GGVP-12): canal, com quem, modo e quem pode. Regra, não IA.
import { dataParaIso, formatarTelefone, isoParaData, normalizarData, normalizarTelefone, validarData, validarEmail, validarTelefone } from '../campos.ts'
import type { IdPerfil } from '../dados/perfis.ts'
import type { Setor } from '../dados/tipos.ts'
import { somarDias } from './agenda.ts'
import { semAcento } from './busca.ts'
import { DIAS_ENTRE_COBRANCAS } from './cobranca.ts'

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

// GGVP-84 · Atualizar ficha e processo com desfazer.

/** O fato novo pode ser dado de saúde: só o Jurídico confirma. O resto, quem conversou (Atendimento ou Jurídico). */
export function podeConfirmar(campo: Mudanca['campo'], papel: PapelNaConversa | null): boolean {
  if (!papel) return false
  return campo !== 'fato' || papel === 'juridico'
}

/** Quem pode, para a mudança que o perfil não pode confirmar (CA8). */
export const QUEM_PODE = 'a advogada responsável ou a Sênior'

export type DecisaoDaMudanca = { id: string; decisao: 'confirmada' | 'corrigida' | 'desfeita'; valor?: string }

/** O tamanho dos campos de texto da conversa ao corrigir. */
export const TAMANHO_DO_VALOR = { minimo: 2, maximo: 200 }

/** O erro do valor corrigido, pela biblioteca de campos (o servidor confere de novo com a mesma). */
export function erroDoValor(campo: Mudanca['campo'], valor: string): string | undefined {
  if (campo === 'telefone') return validarTelefone(valor) ? undefined : 'Telefone com DDD.'
  if (campo === 'email') return validarEmail(valor) ? undefined : 'E-mail inválido.'
  if (campo === 'pericia') return validarData(valor) ? undefined : 'Data no formato dd/mm/aaaa.'
  const t = valor.trim().length
  return t >= TAMANHO_DO_VALOR.minimo && t <= TAMANHO_DO_VALOR.maximo ? undefined : `De ${TAMANHO_DO_VALOR.minimo} a ${TAMANHO_DO_VALOR.maximo} letras.`
}

/** O valor corrigido como fica guardado: telefone só com números, data aaaa-mm-dd. */
export function valorGuardado(campo: Mudanca['campo'], valor: string): string {
  if (campo === 'telefone') return normalizarTelefone(valor)
  if (campo === 'pericia') return dataParaIso(normalizarData(valor)) ?? valor
  return valor.trim()
}

/**
 * O que falta para conferir (CA4, CA5, CA8): cada mudança que o perfil pode confirmar tem decisão; corrigida, com valor
 * válido; a que o perfil não pode, fica sem decisão. `decididas`: as que já foram conferidas antes.
 */
export function motivoParaNaoConferir(mudancas: Mudanca[], decisoes: DecisaoDaMudanca[], papel: PapelNaConversa | null, decididas: string[] = []): string | null {
  const porId = new Map(decisoes.map((d) => [d.id, d]))
  for (const d of decisoes) {
    const m = mudancas.find((x) => x.id === d.id)
    if (!m || decididas.includes(d.id)) return 'Essa mudança não está na conversa.'
    if (!podeConfirmar(m.campo, papel)) return `A mudança de ${m.rotulo} é de ${QUEM_PODE}.`
    if (d.decisao === 'corrigida' && erroDoValor(m.campo, d.valor ?? '')) return `Corrija ${m.rotulo}: ${erroDoValor(m.campo, d.valor ?? '')}`
  }
  const falta = mudancas.filter((m) => !decididas.includes(m.id) && podeConfirmar(m.campo, papel) && !porId.has(m.id))
  return falta.length ? `Confirme, corrija ou desfaça: ${falta.map((m) => m.rotulo).join(', ')}.` : null
}

/** Uma versão de um campo mudado pela conversa (CA2, G14): o valor de antes, cada mudança e cada volta. */
export type VersaoDoCampo = {
  fichaId: string
  processoId?: string
  onde: Dito['onde']
  campo: Mudanca['campo']
  valor: string
  quem: string
  /** Data e hora ISO. */
  quando: string
  origem: 'antes' | 'conversa' | 'volta'
  conversaId?: string
}

/** Só a Sênior volta uma versão (Pedro, 07/10). */
export function podeVoltarVersao(id: IdPerfil | undefined): boolean {
  return id === 'senior' || id === 'senior-2'
}

// GGVP-88 · Pendência da conversa vira tarefa.

/** Uma pessoa do escritório que pode ficar com a tarefa: o nome e o setor. */
export type Pessoa = { nome: string; setor: Setor }

/** Como o setor aparece no que a pessoa escreve ("a Documentação recebe", "a advogada liga"). */
const SETORES_FALADOS: [RegExp, Setor][] = [
  [/\bdocumentacao\b/, 'Documentação · ADM'],
  [/\batendimento\b/, 'Atendimento'],
  [/\b(juridico|advogad[ao]|senior)\b/, 'Jurídico'],
  [/\bfinanceiro\b/, 'Financeiro'],
]

/** O primeiro nome, sem "Dra." e sem "(exemplo)": como a pessoa cita a colega. */
const primeiroNome = (nome: string) => semAcento(nome.replace(/^(dra?\.)\s+/i, '').split(' ')[0])

export type Responsavel =
  | { tipo: 'pessoa'; pessoa: Pessoa }
  | { tipo: 'setor'; setor: Setor; opcoes: Pessoa[] }
  | { tipo: 'perguntar'; opcoes: Pessoa[] }

/**
 * A regra do chat de 30/09 (CA3): citou a pessoa, é ela; citou só o setor, pergunta quem do setor; não citou ninguém,
 * pergunta quem é. O responsável nunca é presumido: com duas pessoas citadas, pergunta entre elas.
 */
export function responsavelDaPendencia(texto: string, pessoas: Pessoa[]): Responsavel {
  const dito = semAcento(texto)
  const citadas = pessoas.filter((p) => new RegExp(`\\b${primeiroNome(p.nome)}\\b`).test(dito))
  if (citadas.length === 1) return { tipo: 'pessoa', pessoa: citadas[0] }
  if (citadas.length > 1) return { tipo: 'perguntar', opcoes: citadas }
  const setor = SETORES_FALADOS.find(([padrao]) => padrao.test(dito))?.[1]
  if (setor) return { tipo: 'setor', setor, opcoes: pessoas.filter((p) => p.setor === setor) }
  return { tipo: 'perguntar', opcoes: pessoas }
}

/** O tamanho do que ficou combinado. */
export const TAMANHO_DO_COMBINADO = { minimo: 5, maximo: 500 }

/** O que falta para criar a tarefa da pendência (CA1, CA3): o combinado, o responsável escolhido e o prazo de hoje em diante. */
export function motivoParaNaoCriarPendencia(p: { texto: string; responsavel?: string; prazo: string }, pessoas: Pessoa[], hoje: string): string | null {
  const t = p.texto.trim().length
  if (t < TAMANHO_DO_COMBINADO.minimo || t > TAMANHO_DO_COMBINADO.maximo) return `Escreva o que ficou combinado (de ${TAMANHO_DO_COMBINADO.minimo} a ${TAMANHO_DO_COMBINADO.maximo} letras).`
  if (!p.responsavel || !pessoas.some((x) => x.nome === p.responsavel)) return 'Escolha quem fica com a tarefa.'
  const prazo = dataParaIso(normalizarData(p.prazo))
  if (!prazo || prazo < hoje) return 'Prazo de hoje em diante (dd/mm/aaaa).'
  return null
}

/**
 * O laço da pendência (CA5). A régua geral é da GGVP-94; até ela, vale o laço da cobrança: vencido o prazo, o lembrete e a
 * tarefa urgente; passados os dias entre cobranças, sobe para a Sênior.
 */
export function situacaoDaPendencia(prazo: string, hoje: string, cumprida: boolean): 'cumprida' | 'no-prazo' | 'lembrete' | 'na-senior' {
  if (cumprida) return 'cumprida'
  if (prazo >= hoje) return 'no-prazo'
  return somarDias(prazo, DIAS_ENTRE_COBRANCAS) <= hoje ? 'na-senior' : 'lembrete'
}
