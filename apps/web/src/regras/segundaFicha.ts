// A segunda ficha, de auxílio acidentário (GGVP-28): as 6 seções do modelo do escritório (FICHA DE ATENDIMENTO AUXILIO
// ACIDENTE), a validação pela biblioteca campos e o que só o Jurídico vê. O servidor de exemplo valida de novo.
import { normalizarData, validarNb } from '../campos.ts'
import type { ItemCatalogo } from '../dados/catalogos.ts'
import type { RespostasDaSegundaFicha } from '../dados/tipos.ts'
import { erroData } from './formularios.ts'

export type CampoDaSegunda = keyof RespostasDaSegundaFicha

export type DefinicaoDoCampo = {
  campo: CampoDaSegunda
  rotulo: string
  tipo: 'texto' | 'textoLongo' | 'data' | 'nb' | 'escolha'
  opcoes?: ItemCatalogo[]
  maximo?: number
}

export const SIM_NAO: ItemCatalogo[] = [
  { id: 'sim', nome: 'Sim' },
  { id: 'nao', nome: 'Não' },
  { id: 'nao-sei', nome: 'Não sei' },
]

export const LADOS: ItemCatalogo[] = [
  { id: 'direito', nome: 'Direito' },
  { id: 'esquerdo', nome: 'Esquerdo' },
  { id: 'os dois', nome: 'Os dois' },
]

/** Seções 2 a 6 do modelo (CA5). A seção 1 são os dados pessoais da ficha única; a senha do Meu INSS vai ao cofre. */
export const SECOES: { numero: number; titulo: string; medica?: true; campos: DefinicaoDoCampo[] }[] = [
  {
    numero: 2,
    titulo: 'Dados profissionais',
    campos: [
      { campo: 'empresa', rotulo: 'Empresa', tipo: 'texto', maximo: 120 },
      { campo: 'funcao', rotulo: 'Função', tipo: 'texto', maximo: 120 },
      { campo: 'vinculo', rotulo: 'Vínculo', tipo: 'texto', maximo: 80 },
      { campo: 'afastamentoEm', rotulo: 'Data do afastamento', tipo: 'data' },
      { campo: 'acidenteEm', rotulo: 'Data do acidente', tipo: 'data' },
      { campo: 'acidenteLocal', rotulo: 'Local do acidente', tipo: 'texto', maximo: 200 },
    ],
  },
  {
    numero: 3,
    titulo: 'Benefício e INSS',
    campos: [
      { campo: 'nb', rotulo: 'Número do benefício (NB)', tipo: 'nb' },
      { campo: 'der', rotulo: 'Data de entrada do requerimento (DER)', tipo: 'data' },
    ],
  },
  {
    numero: 4,
    titulo: 'Acidente',
    campos: [
      { campo: 'cat', rotulo: 'Houve CAT?', tipo: 'escolha', opcoes: SIM_NAO },
      { campo: 'catEm', rotulo: 'Data da CAT', tipo: 'data' },
      { campo: 'boletim', rotulo: 'Houve boletim de ocorrência?', tipo: 'escolha', opcoes: SIM_NAO },
      { campo: 'boletimEm', rotulo: 'Data do boletim', tipo: 'data' },
      { campo: 'deTrabalho', rotulo: 'Foi acidente de trabalho?', tipo: 'escolha', opcoes: SIM_NAO },
      { campo: 'parteDoCorpo', rotulo: 'Parte do corpo afetada', tipo: 'texto', maximo: 120 },
      { campo: 'lado', rotulo: 'Lado', tipo: 'escolha', opcoes: LADOS },
    ],
  },
  {
    numero: 5,
    titulo: 'Dados médicos',
    medica: true,
    campos: [
      { campo: 'doencas', rotulo: 'Doenças', tipo: 'texto', maximo: 300 },
      { campo: 'cid', rotulo: 'CID', tipo: 'texto', maximo: 40 },
      { campo: 'tratamento', rotulo: 'Tratamento', tipo: 'texto', maximo: 300 },
      { campo: 'cirurgia', rotulo: 'Houve cirurgia?', tipo: 'escolha', opcoes: SIM_NAO },
      { campo: 'medico', rotulo: 'Médico que acompanha', tipo: 'texto', maximo: 120 },
      { campo: 'laudos', rotulo: 'Laudos', tipo: 'texto', maximo: 300 },
    ],
  },
  {
    numero: 6,
    titulo: 'Histórico do caso contado pelo cliente',
    campos: [{ campo: 'historico', rotulo: 'O que aconteceu *', tipo: 'textoLongo', maximo: 2000 }],
  },
]

const TODOS = SECOES.flatMap((s) => s.campos)

/** Os campos da seção 5: só o Jurídico vê (CA8). */
export const CAMPOS_MEDICOS: CampoDaSegunda[] = SECOES.filter((s) => s.medica).flatMap((s) => s.campos.map((c) => c.campo))

export const MENSAGEM_NB = 'Número do benefício com 10 números.'
export const MENSAGEM_HISTORICO = 'Conte em poucas palavras o que aconteceu.'

export function respostasVazias(): RespostasDaSegundaFicha {
  return Object.fromEntries(TODOS.map((c) => [c.campo, ''])) as RespostasDaSegundaFicha
}

/** O erro de cada campo: datas sem letra e não futuras, NB com 10 números e o histórico obrigatório (Figma 1815:422). */
export function errosDaSegundaFicha(r: RespostasDaSegundaFicha, hoje: string): Partial<Record<CampoDaSegunda, string>> {
  const erros: Partial<Record<CampoDaSegunda, string>> = {}
  for (const c of TODOS) {
    const valor = r[c.campo]
    if (c.tipo === 'data') erros[c.campo] = erroData(valor, hoje)
    if (c.tipo === 'nb' && valor.trim() !== '' && !validarNb(valor)) erros[c.campo] = MENSAGEM_NB
    if (c.tipo === 'escolha' && valor !== '' && !c.opcoes?.some((o) => o.id === valor)) erros[c.campo] = 'Escolha uma das opções.'
    if (c.maximo && valor.length > c.maximo) erros[c.campo] = `Até ${c.maximo} caracteres.`
  }
  if (r.historico.trim().length < 3) erros.historico = MENSAGEM_HISTORICO
  return Object.fromEntries(Object.entries(erros).filter(([, e]) => e !== undefined))
}

export const segundaFichaValida = (r: RespostasDaSegundaFicha, hoje: string) => Object.keys(errosDaSegundaFicha(r, hoje)).length === 0

/** O que ficou em branco, pelo rótulo (o histórico é obrigatório). */
export function emBrancoDaSegunda(r: RespostasDaSegundaFicha): string[] {
  return TODOS.filter((c) => c.campo !== 'historico' && r[c.campo].trim() === '').map((c) => c.rotulo)
}

/** O que o Atendimento pode ver: a seção médica em branco (CA8). */
export function semDadosMedicos(r: RespostasDaSegundaFicha): RespostasDaSegundaFicha {
  return { ...r, ...Object.fromEntries(CAMPOS_MEDICOS.map((c) => [c, ''])) }
}

/** Datas do jeito que a tela mostra: dd/mm/aaaa. */
export function normalizarDatas(r: RespostasDaSegundaFicha): RespostasDaSegundaFicha {
  const datas = TODOS.filter((c) => c.tipo === 'data').map((c) => c.campo)
  return { ...r, ...Object.fromEntries(datas.map((c) => [c, r[c].trim() === '' ? '' : normalizarData(r[c])])) }
}

/** O valor como a ficha mostra: "Sim", "Direito", ou o texto. */
export function valorFalado(c: DefinicaoDoCampo, valor: string): string {
  return c.opcoes?.find((o) => o.id === valor)?.nome ?? valor
}
