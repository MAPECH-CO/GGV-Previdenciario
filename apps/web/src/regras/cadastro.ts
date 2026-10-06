// O cadastro do lead (GGVP-43): os campos do modelo do contrato, de onde vem cada valor e a mescla de quem salvou
// ao mesmo tempo. Regra com teste, sobre a biblioteca campos; o servidor de exemplo valida de novo com as mesmas.
import {
  dataParaIso,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  isoParaData,
  normalizarCep,
  normalizarCpf,
  normalizarData,
  normalizarNome,
  normalizarTelefone,
  validarCpf,
  validarNome,
} from '../campos.ts'
import { PROFISSOES } from '../dados/catalogos.ts'
import type { Cadastro, Ficha, InformacaoExtraida, Representante } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'
import { MENSAGEM, erroCep, erroCpf, erroData, erroNome, erroTelefone } from './formularios.ts'

/** Escolha única (CA3). */
export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)']

export const PARENTESCOS = ['Mãe', 'Pai', 'Tutor(a)', 'Curador(a)', 'Outro']

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

export const ROTULOS_DO_CADASTRO: Record<keyof Cadastro, string> = {
  nome: 'Nome completo',
  cpf: 'CPF',
  rg: 'RG',
  nascimento: 'Data de nascimento',
  estadoCivil: 'Estado civil',
  profissao: 'Profissão',
  telefone: 'Telefone',
  cep: 'CEP',
  rua: 'Rua e número',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
}

export const ROTULOS_DO_REPRESENTANTE: Record<keyof Representante, string> = {
  nome: 'Nome completo',
  cpf: 'CPF',
  rg: 'RG',
  parentesco: 'Parentesco',
  estadoCivil: 'Estado civil',
  profissao: 'Profissão',
}

export const MENSAGEM_RG = 'RG: de 5 a 14 letras e números.'

/** "12.345.678-x" → "12345678X". */
export const normalizarRg = (valor: string) => valor.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

export const erroRg = (valor: string) => (/^[0-9A-Z]{5,14}$/.test(normalizarRg(valor)) ? undefined : MENSAGEM_RG)

/** "Casado", "casada", "VIÚVA" → o item da lista; o que não bate fica vazio para escolher. */
export function estadoCivilDaLista(valor: string | undefined): string {
  const v = semAcento(valor ?? '')
  const prefixos: [string, string][] = [
    ['solteir', 'Solteiro(a)'],
    ['casad', 'Casado(a)'],
    ['uniao', 'União estável'],
    ['divorc', 'Divorciado(a)'],
    ['viuv', 'Viúvo(a)'],
  ]
  return prefixos.find(([p]) => v.startsWith(p))?.[1] ?? ''
}

const naLista = (lista: string[], valor: string) => (lista.includes(valor) ? undefined : 'Escolha na lista.')
const minimo = (valor: string, n: number, mensagem: string) => (valor.trim().length >= n ? undefined : mensagem)

function soErros<T extends string>(erros: Record<T, string | undefined>): Partial<Record<T, string>> {
  return Object.fromEntries(Object.entries(erros).filter(([, e]) => e)) as Partial<Record<T, string>>
}

/** Os campos do modelo do contrato (CA3, CA5): obrigatórios, menos a data de nascimento. */
export function errosDoCadastro(v: Cadastro, hoje: string): Partial<Record<keyof Cadastro, string>> {
  return soErros<keyof Cadastro>({
    nome: erroNome(v.nome),
    cpf: erroCpf(v.cpf, true),
    rg: erroRg(v.rg),
    nascimento: erroData(v.nascimento, hoje),
    estadoCivil: naLista(ESTADOS_CIVIS, v.estadoCivil),
    profissao: naLista(PROFISSOES.map((p) => p.nome), v.profissao),
    telefone: erroTelefone(v.telefone),
    cep: v.cep.trim() === '' ? MENSAGEM.cep : erroCep(v.cep),
    rua: minimo(v.rua, 3, 'Escreva a rua e o número.'),
    bairro: minimo(v.bairro, 2, 'Escreva o bairro.'),
    cidade: minimo(v.cidade, 2, 'Escreva a cidade.'),
    uf: UFS.includes(v.uf.trim().toUpperCase()) ? undefined : 'UF com 2 letras, como SP.',
  })
}

export function errosDoRepresentante(r: Representante): Partial<Record<keyof Representante, string>> {
  return soErros<keyof Representante>({
    nome: erroNome(r.nome),
    cpf: erroCpf(r.cpf, true),
    rg: erroRg(r.rg),
    parentesco: naLista(PARENTESCOS, r.parentesco),
    estadoCivil: naLista(ESTADOS_CIVIS, r.estadoCivil),
    profissao: naLista(PROFISSOES.map((p) => p.nome), r.profissao),
  })
}

/** O que falta para "Salvar cadastro" (CA3), na ordem da tela. */
export function oQueFaltaNoCadastro(v: Cadastro, representante: Representante | undefined, hoje: string): string[] {
  const falta = (Object.keys(errosDoCadastro(v, hoje)) as (keyof Cadastro)[]).map((c) => ROTULOS_DO_CADASTRO[c])
  if (representante) {
    const doRepresentante = Object.keys(errosDoRepresentante(representante)) as (keyof Representante)[]
    falta.push(...doRepresentante.map((c) => `${ROTULOS_DO_REPRESENTANTE[c]} do representante`))
  }
  return falta
}

/** Sem os campos do modelo, o kit do benefício (D1.15, D1.16) não é gerado (CA4). */
export function faltaParaOKit(ficha: Ficha): string[] {
  const falta = [
    !validarNome(ficha.nome) && 'nome completo',
    !(ficha.cpf && validarCpf(ficha.cpf)) && 'CPF',
    !estadoCivilDaLista(ficha.estadoCivil) && 'estado civil',
    !ficha.profissao && 'profissão',
    !ficha.rg && 'RG',
    !(ficha.endereco && ficha.bairro && ficha.cidadeUf && ficha.cep) && 'endereço',
    !ficha.telefone && 'telefone',
    ficha.representante && Object.keys(errosDoRepresentante(ficha.representante)).length > 0 && 'dados do representante',
  ]
  return falta.filter((f): f is string => typeof f === 'string')
}

/** A ficha como a tela do cadastro mostra. */
export function cadastroDaFicha(ficha: Ficha): Cadastro {
  const [cidade = '', uf = ''] = (ficha.cidadeUf ?? '').split(' / ')
  return {
    nome: ficha.nome,
    cpf: ficha.cpf ? formatarCpf(ficha.cpf) : '',
    rg: ficha.rg ?? '',
    nascimento: (ficha.nascimento && isoParaData(ficha.nascimento)) || '',
    estadoCivil: estadoCivilDaLista(ficha.estadoCivil),
    profissao: PROFISSOES.some((p) => p.nome === ficha.profissao) ? ficha.profissao! : '',
    telefone: ficha.telefone ? formatarTelefone(ficha.telefone) : '',
    cep: ficha.cep ? formatarCep(ficha.cep) : '',
    rua: ficha.endereco ?? '',
    bairro: ficha.bairro ?? '',
    cidade,
    uf,
  }
}

/** O cadastro como a ficha guarda: normalizado pela biblioteca campos. */
export function fichaDoCadastro(v: Cadastro): Pick<Ficha, 'nome' | 'cpf' | 'rg' | 'nascimento' | 'estadoCivil' | 'profissao' | 'telefone' | 'cep' | 'endereco' | 'bairro' | 'cidadeUf'> {
  return {
    nome: normalizarNome(v.nome),
    cpf: normalizarCpf(v.cpf),
    rg: normalizarRg(v.rg),
    nascimento: v.nascimento.trim() ? (dataParaIso(normalizarData(v.nascimento)) ?? undefined) : undefined,
    estadoCivil: v.estadoCivil,
    profissao: v.profissao,
    telefone: normalizarTelefone(v.telefone),
    cep: normalizarCep(v.cep),
    endereco: v.rua.trim(),
    bairro: v.bairro.trim(),
    cidadeUf: `${v.cidade.trim()} / ${v.uf.trim().toUpperCase()}`,
  }
}

export type Fonte = 'ficha' | 'entrevista'

/** Os campos que a entrevista também traz (GGVP-40). */
const DA_ENTREVISTA = ['telefone', 'estadoCivil', 'profissao'] as const

/**
 * O cadastro preenchido pelas fontes (CA1, CA8): a ficha primeiro; a entrevista completa o que a ficha não tem. Onde as
 * duas dizem diferente, vale a ficha e a diferença aparece para a advogada escolher.
 */
export function preencherCadastro(ficha: Ficha, extraidas: InformacaoExtraida[]) {
  const valores = cadastroDaFicha(ficha)
  const origem: Partial<Record<keyof Cadastro, Fonte>> = {}
  for (const c of Object.keys(valores) as (keyof Cadastro)[]) if (valores[c]) origem[c] = 'ficha'
  const divergencias: { campo: keyof Cadastro; ficha: string; entrevista: string }[] = []
  for (const campo of DA_ENTREVISTA) {
    const e = extraidas.find((x) => x.campo === campo)
    if (!e) continue
    const daEntrevista = campo === 'telefone' ? formatarTelefone(e.valor) : campo === 'estadoCivil' ? estadoCivilDaLista(e.valor) : e.valor
    const igual = campo === 'telefone' ? normalizarTelefone(valores.telefone) === e.valor : valores[campo] === daEntrevista
    if (!valores[campo]) {
      valores[campo] = daEntrevista
      origem[campo] = 'entrevista'
    } else if (!igual) divergencias.push({ campo, ficha: valores[campo], entrevista: daEntrevista })
  }
  return { valores, origem, divergencias }
}

/**
 * Duas pessoas salvando a mesma ficha (CA11): o campo que eu não mexi fica com o que está salvo (o do outro, se ele
 * mexeu); o que só eu mexi vai; o que nós dois mexemos, diferente, volta como conflito.
 */
export function mesclar<T extends Record<string, string>>(base: T, meu: T, atual: T): { valores: T; conflitos: (keyof T)[] } {
  const valores = { ...atual }
  const conflitos: (keyof T)[] = []
  for (const c of Object.keys(meu) as (keyof T)[]) {
    if (meu[c] === base[c]) continue
    if (atual[c] === base[c] || atual[c] === meu[c]) valores[c] = meu[c]
    else conflitos.push(c)
  }
  return { valores, conflitos }
}
