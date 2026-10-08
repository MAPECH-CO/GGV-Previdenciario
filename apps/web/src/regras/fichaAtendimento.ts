// A ficha de atendimento (GGVP-24): o que é obrigatório, o que ficou em branco e o que vai para o servidor. Validação
// toda pela biblioteca campos; o servidor de exemplo valida de novo com as mesmas funções.
import { dataParaIso, normalizarCpf, normalizarData, normalizarInteiro, normalizarNome, normalizarTelefone } from '../campos.ts'
import type { EnvioDaFicha, ModeloDaFicha, SenhaGov } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from './datas.ts'
import { erroCpf, erroData, erroNome, erroTelefone } from './formularios.ts'

/** Quantas pessoas moram na casa: de 1 a 30. */
export const PESSOAS_NA_CASA = { minimo: 1, maximo: 30 }

export const LIMITES = { endereco: 200, ultimaAtividade: 200, semTrabalharDesde: 40, pedidosAoInss: 300 }

/** O que a tela guarda enquanto a pessoa preenche: tudo texto. */
export type ValoresDaFicha = {
  nome: string
  cpf: string
  nascimento: string
  telefone: string
  endereco: string
  pessoasNaCasa: string
  beneficioInteresse: string
  ultimaAtividade: string
  semTrabalharDesde: string
  pedidosAoInss: string
}

export type CampoDaFicha = keyof ValoresDaFicha

/** Os rótulos do Figma 10:54 ("Antes de concluir" › Campos), na ordem da ficha. */
export const ROTULOS_DA_FICHA: Record<CampoDaFicha, string> = {
  nome: 'Nome completo',
  cpf: 'CPF',
  nascimento: 'Data de nascimento',
  telefone: 'Telefone / WhatsApp',
  endereco: 'Endereço',
  pessoasNaCasa: 'Quantas pessoas moram na casa',
  beneficioInteresse: 'Benefício procurado',
  ultimaAtividade: 'Última atividade',
  semTrabalharDesde: 'Desde quando está sem trabalhar',
  pedidosAoInss: 'O que já pediu ao INSS',
}

/** "Salvar ficha" só habilita com estes (CA5). */
export const OBRIGATORIOS: CampoDaFicha[] = ['nome', 'cpf', 'nascimento', 'telefone']

/** Podem ficar em branco; o Jurídico vê quais ficaram (CA6, CA11). */
const OPCIONAIS = ['endereco', 'pessoasNaCasa', 'ultimaAtividade', 'semTrabalharDesde', 'pedidosAoInss'] as const satisfies CampoDaFicha[]

export const MENSAGEM_PESSOAS = `Só números, de ${PESSOAS_NA_CASA.minimo} a ${PESSOAS_NA_CASA.maximo}.`

export function erroPessoasNaCasa(valor: string): string | undefined {
  if (valor.trim() === '') return undefined
  const n = normalizarInteiro(valor)
  return n !== null && n >= PESSOAS_NA_CASA.minimo && n <= PESSOAS_NA_CASA.maximo ? undefined : MENSAGEM_PESSOAS
}

/** Data de nascimento obrigatória: sem letra e não futura (CA12). */
export function erroNascimento(valor: string, hoje: string): string | undefined {
  return erroData(valor.trim() === '' ? '-' : valor, hoje)
}

/** O erro de cada campo, para a tela mostrar ao sair do campo e ao salvar. */
export function errosDaFicha(v: ValoresDaFicha, hoje: string): Partial<Record<CampoDaFicha, string>> {
  const erros: Partial<Record<CampoDaFicha, string>> = {
    nome: erroNome(v.nome),
    cpf: erroCpf(v.cpf, true),
    nascimento: erroNascimento(v.nascimento, hoje),
    telefone: erroTelefone(v.telefone),
    pessoasNaCasa: erroPessoasNaCasa(v.pessoasNaCasa),
  }
  return Object.fromEntries(Object.entries(erros).filter(([, erro]) => erro !== undefined))
}

/** Os obrigatórios que faltam ou estão errados, pelo rótulo: "CPF e Data de nascimento" (CA5). */
export function oQueFalta(v: ValoresDaFicha, hoje: string): string[] {
  const erros = errosDaFicha(v, hoje)
  return [...OBRIGATORIOS, 'pessoasNaCasa' as const].filter((c) => erros[c]).map((c) => ROTULOS_DA_FICHA[c])
}

/** Os opcionais em branco, pelo rótulo (CA6). */
export function camposEmBranco(v: Pick<ValoresDaFicha, (typeof OPCIONAIS)[number]>): string[] {
  return OPCIONAIS.filter((c) => (v[c] ?? '').trim() === '').map((c) => ROTULOS_DA_FICHA[c])
}

const opcional = (valor: string) => (valor.trim() === '' ? undefined : valor.trim())

/** Da tela para o servidor, já normalizado. */
export function paraEnvio(v: ValoresDaFicha, origem: 'papel' | 'tablet', modelo?: ModeloDaFicha): EnvioDaFicha {
  return {
    nome: normalizarNome(v.nome),
    cpf: normalizarCpf(v.cpf),
    nascimento: normalizarData(v.nascimento),
    telefone: normalizarTelefone(v.telefone),
    endereco: opcional(v.endereco),
    pessoasNaCasa: v.pessoasNaCasa.trim() === '' ? undefined : (normalizarInteiro(v.pessoasNaCasa) ?? undefined),
    beneficioInteresse: v.beneficioInteresse || 'nao-sei',
    ultimaAtividade: opcional(v.ultimaAtividade),
    semTrabalharDesde: opcional(v.semTrabalharDesde),
    pedidosAoInss: opcional(v.pedidosAoInss),
    origem,
    modelo,
  }
}

/** O servidor confere de novo, com as mesmas funções. */
export function envioValido(e: EnvioDaFicha, hoje: string): boolean {
  const iso = dataParaIso(normalizarData(e.nascimento))
  return (
    erroNome(e.nome) === undefined &&
    erroCpf(e.cpf, true) === undefined &&
    iso !== null &&
    iso <= hoje &&
    erroTelefone(e.telefone) === undefined &&
    (e.pessoasNaCasa === undefined || erroPessoasNaCasa(String(e.pessoasNaCasa)) === undefined) &&
    (e.endereco ?? '').length <= LIMITES.endereco &&
    (e.ultimaAtividade ?? '').length <= LIMITES.ultimaAtividade &&
    (e.semTrabalharDesde ?? '').length <= LIMITES.semTrabalharDesde &&
    (e.pedidosAoInss ?? '').length <= LIMITES.pedidosAoInss &&
    (e.origem === 'papel' || e.origem === 'tablet')
  )
}

/** "senha no cofre · atualizada em 05/10 por Você (Atendimento)": a única coisa que a tela mostra da senha (CA2, G9). */
export function situacaoDaSenha(s: SenhaGov, hoje: string): string {
  if (s.situacao === 'no-cofre') {
    const quando = s.atualizadaEm ? ` · atualizada em ${dataCurta(hojeIso(new Date(s.atualizadaEm)), hoje)}` : ''
    return `senha no cofre${quando}${s.por ? ` por ${s.por}` : ''}${s.conferir ? ' · conferir com o papel' : ''}`
  }
  if (s.situacao === 'escritorio-tem') return 'o escritório tem a senha, mas ainda não está no cofre'
  return s.naoSabe ? 'não sabe a senha: o caso segue com o alerta de senha' : 'sem senha'
}
