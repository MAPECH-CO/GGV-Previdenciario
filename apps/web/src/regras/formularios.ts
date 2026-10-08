// Validação dos formulários da ficha (GGVP-16, CA3, CA12 e CA15), toda pela biblioteca campos.
// A tela mostra a mensagem; o servidor de exemplo valida de novo com as mesmas funções.
import {
  dataParaIso,
  normalizarCep,
  normalizarCpf,
  normalizarData,
  normalizarInteiro,
  normalizarNome,
  normalizarTelefone,
  somenteDigitos,
  validarCep,
  validarCpf,
  validarEmail,
  validarNome,
  validarTelefone,
} from '../campos.ts'
import type { EdicaoFicha, NovoCliente } from '../dados/tipos.ts'

export const IDADE_MAXIMA = 130

export const MENSAGEM = {
  nome: 'Escreva o nome completo, só com letras.',
  cpf: 'CPF inválido: confira os 11 números.',
  idade: `Idade em anos, só números, até ${IDADE_MAXIMA}.`,
  telefone: 'Telefone com DDD: 10 ou 11 números.',
  email: 'E-mail inválido.',
  data: 'Data em dd/mm/aaaa, sem letra e que não seja futura.',
  dataDoCompromisso: 'Data em dd/mm/aaaa, de hoje em diante.',
  cep: 'CEP com 8 números.',
  pretende: 'Escreva em poucas palavras o que a pessoa pretende.',
  indicadoPor: 'Escreva o nome de quem indicou, só com letras.',
} as const

/** CPF, telefone, idade e CEP: letra não entra; ficam número e a pontuação da máscara. */
export function soNumeroEMascara(valor: string): string {
  return valor.replace(/[^\d.\-/() ]+/g, '')
}

export function erroNome(valor: string): string | undefined {
  return validarNome(valor) ? undefined : MENSAGEM.nome
}

export function erroCpf(valor: string, obrigatorio: boolean): string | undefined {
  if (somenteDigitos(valor) === '') return obrigatorio ? MENSAGEM.cpf : undefined
  return validarCpf(valor) ? undefined : MENSAGEM.cpf
}

export function erroIdade(valor: string): string | undefined {
  const idade = normalizarInteiro(valor)
  return idade !== null && idade >= 0 && idade <= IDADE_MAXIMA ? undefined : MENSAGEM.idade
}

/** DDD obrigatório: o portal não adivinha. */
export function erroTelefone(valor: string): string | undefined {
  return validarTelefone(valor) ? undefined : MENSAGEM.telefone
}

export function erroEmail(valor: string): string | undefined {
  return valor.trim() === '' || validarEmail(valor) ? undefined : MENSAGEM.email
}

/** dd/mm/aaaa que existe e não é depois de hoje. Vazio passa: a data não é obrigatória. */
export function erroData(valor: string, hoje: string): string | undefined {
  if (valor.trim() === '') return undefined
  const iso = dataParaIso(normalizarData(valor))
  return iso !== null && iso <= hoje ? undefined : MENSAGEM.data
}

/** Compromisso da agenda: dd/mm/aaaa que existe, de hoje em diante (GGVP-123). */
export function erroDataDoCompromisso(valor: string, hoje: string): string | undefined {
  const iso = dataParaIso(normalizarData(valor))
  return iso !== null && iso >= hoje ? undefined : MENSAGEM.dataDoCompromisso
}

export function erroCep(valor: string): string | undefined {
  return valor.trim() === '' || validarCep(valor) ? undefined : MENSAGEM.cep
}

export function erroPretende(valor: string): string | undefined {
  return valor.trim().length >= 3 ? undefined : MENSAGEM.pretende
}

/** Indicação pede o nome de quem indicou (CA12). */
export function erroIndicadoPor(valor: string, comoChegou: string): string | undefined {
  if (comoChegou !== 'indicacao') return undefined
  return validarNome(valor) ? undefined : MENSAGEM.indicadoPor
}

const opcional = (valor: string) => (valor.trim() === '' ? undefined : valor.trim())

export type ValoresNovoCliente = {
  nome: string
  cpf: string
  idade: string
  telefone: string
  email: string
  pretende: string
  comoChegou: string
  indicadoPor: string
  cidadeUf: string
  beneficioInteresse: string
  observacao: string
}

export type DadosNovoCliente = Omit<NovoCliente, 'outraPessoa' | 'pasta'>

export function validarNovoCliente(v: ValoresNovoCliente): {
  erros: Partial<Record<keyof ValoresNovoCliente, string>>
  dados?: DadosNovoCliente
} {
  const erros: Partial<Record<keyof ValoresNovoCliente, string>> = {
    nome: erroNome(v.nome),
    cpf: erroCpf(v.cpf, false),
    idade: erroIdade(v.idade),
    telefone: erroTelefone(v.telefone),
    email: erroEmail(v.email),
    pretende: erroPretende(v.pretende),
    indicadoPor: erroIndicadoPor(v.indicadoPor, v.comoChegou),
  }
  for (const campo of Object.keys(erros) as (keyof ValoresNovoCliente)[]) if (!erros[campo]) delete erros[campo]
  if (Object.keys(erros).length > 0) return { erros }
  return {
    erros,
    dados: {
      nome: normalizarNome(v.nome),
      cpf: opcional(normalizarCpf(v.cpf)),
      idade: normalizarInteiro(v.idade)!,
      telefone: normalizarTelefone(v.telefone),
      email: opcional(v.email),
      pretende: v.pretende.trim(),
      comoChegou: opcional(v.comoChegou),
      indicadoPor: v.comoChegou === 'indicacao' ? normalizarNome(v.indicadoPor) : undefined,
      cidadeUf: opcional(v.cidadeUf),
      beneficioInteresse: v.beneficioInteresse || 'nao-sei',
      observacao: opcional(v.observacao),
    },
  }
}

export type ValoresFicha = {
  nome: string
  cpf: string
  nascimento: string
  telefone: string
  email: string
  estadoCivil: string
  endereco: string
  cidadeUf: string
  cep: string
  profissao: string
  comoChegou: string
  contatoPreferido: string
  contatoApoio: string
  observacoes: string
}

/** CPF é obrigatório para cliente; para lead ainda é opcional (o cadastro completo vem depois da entrevista). */
export function validarEdicao(
  v: ValoresFicha,
  opcoes: { cpfObrigatorio: boolean; hoje: string },
): { erros: Partial<Record<keyof ValoresFicha, string>>; dados?: EdicaoFicha } {
  const erros: Partial<Record<keyof ValoresFicha, string>> = {
    nome: erroNome(v.nome),
    cpf: erroCpf(v.cpf, opcoes.cpfObrigatorio),
    nascimento: erroData(v.nascimento, opcoes.hoje),
    telefone: erroTelefone(v.telefone),
    email: erroEmail(v.email),
    cep: erroCep(v.cep),
  }
  for (const campo of Object.keys(erros) as (keyof ValoresFicha)[]) if (!erros[campo]) delete erros[campo]
  if (Object.keys(erros).length > 0) return { erros }
  return {
    erros,
    dados: {
      nome: normalizarNome(v.nome),
      cpf: opcional(normalizarCpf(v.cpf)),
      nascimento: v.nascimento.trim() === '' ? undefined : (dataParaIso(normalizarData(v.nascimento)) ?? undefined),
      telefone: normalizarTelefone(v.telefone),
      email: opcional(v.email),
      estadoCivil: opcional(v.estadoCivil),
      endereco: opcional(v.endereco),
      cidadeUf: opcional(v.cidadeUf),
      cep: opcional(normalizarCep(v.cep)),
      profissao: opcional(v.profissao),
      comoChegou: opcional(v.comoChegou),
      contatoPreferido: opcional(v.contatoPreferido),
      contatoApoio: opcional(v.contatoApoio),
      observacoes: opcional(v.observacoes),
    },
  }
}
