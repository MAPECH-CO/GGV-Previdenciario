// O kit de verdade (GGVP-136): as {{VARIÁVEIS}} dos modelos do escritório e o que o portal põe em cada uma. Regra do
// escritório é código com teste, nunca resposta de modelo. O servidor e as telas usam estas mesmas funções.
import { formatarCep, formatarCpf, formatarTelefone } from '../campos.ts'
import type { DadosDoContrato } from './contrato.ts'

/** Uma variável do modelo do Word. O `nome` é o do padrão dos modelos do ZapSign, escrito igual no documento. */
export type VariavelDoKit = {
  nome: string
  /** Como a equipe lê, na lista do que falta. */
  rotulo: string
  /** Sai em branco quando não há o dado (telefone para contato). */
  opcional?: boolean
}

/** Quem a variável descreve: o cliente, o beneficiário (o representado do LOAS; o curatelado) ou o genitor(a) que o representa. */
const PESSOAIS: [string, string][] = [
  ['NOME COMPLETO', 'Nome completo'],
  ['ESTADO CIVIL', 'Estado civil'],
  ['NACIONALIDADE', 'Nacionalidade'],
  ['PROFISSÃO', 'Profissão'],
  ['NÚMERO DO CPF', 'CPF'],
  ['NÚMERO DO RG', 'RG'],
]

/** O Word às vezes guarda o acento separado da letra ("Ú" como "U" e o acento): o nome vale depois de normalizado. */
export const nomeDaVariavel = (texto: string) => texto.normalize('NFC').trim()

export const VARIAVEIS_DO_KIT: VariavelDoKit[] = [
  ...PESSOAIS.map(([nome, rotulo]) => ({ nome, rotulo })),
  { nome: 'ENDEREÇO COMPLETO', rotulo: 'Endereço' },
  { nome: 'Nº', rotulo: 'Número do endereço' },
  { nome: 'BAIRRO', rotulo: 'Bairro' },
  { nome: 'CIDADE', rotulo: 'Cidade' },
  { nome: 'UF', rotulo: 'Estado (UF)' },
  { nome: 'CEP', rotulo: 'CEP' },
  { nome: 'TELEFONE', rotulo: 'Telefone' },
  { nome: 'TELEFONE P/ CONTATO', rotulo: 'Telefone para contato', opcional: true },
  // O modelo 7 chama os dois telefones de TEL 1 e TEL 2.
  { nome: 'TEL 1', rotulo: 'Telefone' },
  { nome: 'TEL 2', rotulo: 'Telefone para contato', opcional: true },
  { nome: 'DATA DE HOJE', rotulo: 'Data de hoje' },
  ...PESSOAIS.map(([nome, rotulo]) => ({ nome: `${nome} DO BENEFICIÁRIO`, rotulo: `${rotulo} do beneficiário` })),
  { nome: 'DATA DE NASCIMENTO DO BENEFICIÁRIO', rotulo: 'Data de nascimento do beneficiário' },
  ...PESSOAIS.map(([nome, rotulo]) => ({ nome: `${nome} GENITOR(A)`, rotulo: `${rotulo} do genitor(a)` })),
]

const CONHECIDAS = new Set(VARIAVEIS_DO_KIT.map((v) => v.nome))

/** As variáveis que o portal não sabe preencher: uma escrita errada no Word sairia em branco no papel. */
export const variaveisDesconhecidas = (nomes: string[]) => [...new Set(nomes.map(nomeDaVariavel))].filter((n) => !CONHECIDAS.has(n))

// ─── O que vai em cada variável ───────────────────────────────────────────────────────────────────────────────────────

/** O que o preenchimento lê da ficha das telas. */
export type FichaDoKit = {
  nome: string
  cpf?: string
  telefone: string
  estadoCivil?: string
  profissao?: string
  /** "Rua e número", como o cadastro guarda. */
  endereco?: string
  bairro?: string
  /** "Cidade / UF". */
  cidadeUf?: string
  cep?: string
  /** "filha Renata · (11) 90000-0023": serve de telefone para contato. */
  contatoApoio?: string
}

export type EntradaDoKit = {
  ficha: FichaDoKit
  /** O RG, a nacionalidade, o representante e o curatelado: o que o contrato guarda e a ficha não tem. */
  dados: DadosDoContrato
  /** A linha do kit ("curatela", "loas"...): na curatela o beneficiário é o curatelado; nas demais, o próprio cliente. */
  linha: string
  /** LOAS representado: os dados do genitor(a) entram. */
  representado: boolean
}

const COMECA_COM_NUMERO = /^(?:n[º°o]\.?\s*)?(?:\d|s\/?n\b)/i
const SEM_N = /^n[º°o]\.?\s*/i

/**
 * "Rua das Flores, 123" → a rua e o número, que os modelos pedem em variáveis separadas. A vírgula separa a rua do número;
 * sem vírgula, o último número é o da casa.
 * ponytail: depois do número, o que vem após outra vírgula fica de fora ("123, apto 4"); o complemento vai junto do número
 * ("123 apto 4"). Sem vírgula, "Rua X 123 apto 4" sai com o número 4. O cadastro pede "rua e número" com vírgula.
 */
export function separarEndereco(endereco?: string): { logradouro?: string; numero?: string } {
  const texto = (endereco ?? '').replace(/\s+/g, ' ').trim()
  if (!texto) return {}
  const partes = texto.split(',').map((p) => p.trim()).filter(Boolean)
  const i = partes.findIndex((p, k) => k > 0 && COMECA_COM_NUMERO.test(p))
  if (i > 0) return { logradouro: partes.slice(0, i).join(', '), numero: partes[i].replace(SEM_N, '') }
  const m = /^(.+?)\s+(?:n[º°o]\.?\s*)?(\d+[A-Za-z]?)$/i.exec(texto)
  return m ? { logradouro: m[1], numero: m[2] } : { logradouro: texto }
}

/** "São Paulo / SP" → cidade e UF, como o cadastro guarda. */
export function separarCidadeUf(cidadeUf?: string): { cidade?: string; uf?: string } {
  const partes = (cidadeUf ?? '').split('/').map((p) => p.trim()).filter(Boolean)
  const ultima = partes.at(-1)
  if (!ultima) return {}
  return partes.length > 1 && /^[A-Za-z]{2}$/.test(ultima) ? { cidade: partes.slice(0, -1).join('/'), uf: ultima.toUpperCase() } : { cidade: partes.join('/') }
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-10-09" → "9 de outubro de 2026": a data do contrato de honorários. */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return `${dia} de ${MESES[mes - 1]} de ${ano}`
}

/** As datas do papel que o cliente preenche à mão na assinatura: linhas em branco, com o ano da assinatura. */
export const dataEmBranco = (iso: string) => `dia ____________ de ________________ de ${iso.slice(0, 4)}`

type Pessoa = { nome?: string; estadoCivil?: string; nacionalidade?: string; profissao?: string; cpf?: string; rg?: string }

/** Estado civil e profissão no meio da frase do contrato ("casado(a)", "do lar"), não no começo de um campo. */
const minuscula = (s?: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)

const daPessoa = (sufixo: string, p: Pessoa): Record<string, string | undefined> => ({
  [`NOME COMPLETO${sufixo}`]: p.nome,
  [`ESTADO CIVIL${sufixo}`]: minuscula(p.estadoCivil),
  [`NACIONALIDADE${sufixo}`]: p.nacionalidade,
  [`PROFISSÃO${sufixo}`]: minuscula(p.profissao),
  [`NÚMERO DO CPF${sufixo}`]: p.cpf ? formatarCpf(p.cpf) : undefined,
  [`NÚMERO DO RG${sufixo}`]: p.rg,
})

/**
 * O valor de cada variável conhecida, da ficha e do caso (CA3). Quem não tem o dado fica sem valor: `faltamNoKit` diz o que
 * falta, e o modelo só pede o que usa. `hoje` é aaaa-mm-dd; vale a primeira {{DATA DE HOJE}} do modelo, a do contrato de
 * honorários (ver `preencherModelo`, no servidor).
 */
export function valoresDoKit({ ficha, dados, linha, representado }: EntradaDoKit, hoje: string): Record<string, string | undefined> {
  const cliente: Pessoa = { nome: ficha.nome, estadoCivil: ficha.estadoCivil, nacionalidade: dados.nacionalidade, profissao: ficha.profissao, cpf: ficha.cpf, rg: dados.rg }
  const genitor: Pessoa = {
    nome: dados.representanteNome,
    estadoCivil: dados.representanteEstadoCivil,
    nacionalidade: dados.representanteNacionalidade,
    profissao: dados.representanteProfissao,
    cpf: dados.representanteCpf,
    rg: dados.representanteRg,
  }
  const curatelado: Pessoa = { nome: dados.curateladoNome, nacionalidade: dados.curateladoNacionalidade, cpf: dados.curateladoCpf, rg: dados.curateladoRg }
  const { logradouro, numero } = separarEndereco(ficha.endereco)
  const { cidade, uf } = separarCidadeUf(ficha.cidadeUf)
  const telefone = ficha.telefone ? formatarTelefone(ficha.telefone) : undefined
  return {
    ...daPessoa('', cliente),
    ...daPessoa(' DO BENEFICIÁRIO', linha === 'curatela' ? curatelado : cliente),
    'DATA DE NASCIMENTO DO BENEFICIÁRIO': dados.curateladoNascimento,
    ...(representado ? daPessoa(' GENITOR(A)', genitor) : {}),
    'ENDEREÇO COMPLETO': logradouro,
    'Nº': numero,
    BAIRRO: ficha.bairro,
    CIDADE: cidade,
    UF: uf,
    CEP: ficha.cep ? formatarCep(ficha.cep) : undefined,
    TELEFONE: telefone,
    'TEL 1': telefone,
    'TELEFONE P/ CONTATO': ficha.contatoApoio,
    'TEL 2': ficha.contatoApoio,
    'DATA DE HOJE': dataPorExtenso(hoje),
  }
}

/** O que falta para o modelo, com o nome que a equipe lê (CA4): só o que o modelo usa e que não é opcional. Sem repetir. */
export function faltamNoKit(variaveisDoModelo: string[], valores: Record<string, string | undefined>): string[] {
  const usadas = new Set(variaveisDoModelo.map(nomeDaVariavel))
  const rotulos = VARIAVEIS_DO_KIT.filter((v) => usadas.has(v.nome) && !v.opcional && !valores[v.nome]?.trim()).map((v) => v.rotulo)
  return [...new Set(rotulos)]
}
