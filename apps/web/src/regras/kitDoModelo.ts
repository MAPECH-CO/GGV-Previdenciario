// O kit de verdade (GGVP-136): as {{VARIÁVEIS}} dos modelos do escritório e o que o portal põe em cada uma. Regra do
// escritório é código com teste, nunca resposta de modelo. O servidor e as telas usam estas mesmas funções.

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
