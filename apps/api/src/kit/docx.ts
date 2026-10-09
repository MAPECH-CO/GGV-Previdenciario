// O modelo do Word do kit (GGVP-136): abrir o .docx e achar as {{VARIÁVEIS}}. O Word parte "{{NOME COMPLETO}}" em várias
// pedaços de texto (runs) por causa da revisão e do corretor; só uma biblioteca de .docx junta de volta (docxtemplater, com
// o pizzip para abrir o zip). O modelo é do escritório: nada dele vai para o log.
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { dataEmBranco, nomeDaVariavel, variaveisDesconhecidas } from '../../../web/src/regras/kitDoModelo.ts'

/** Onde o Word guarda texto que o modelo pode usar: o corpo, os cabeçalhos e os rodapés. */
const PARTES_COM_TEXTO = /^word\/(document|header\d*|footer\d*)\.xml$/

/** O modelo é o texto do escritório e o CPF é de uma pessoa: um CPF escrito no modelo é dado de cliente que sobrou. */
const CPF_ESCRITO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/

export const MSG_NAO_E_DOCX = 'O arquivo não é um documento do Word (.docx).'
export const MSG_SEM_VARIAVEL = 'O arquivo não tem nenhuma {{VARIÁVEL}}: confira se é o modelo, e não um documento já preenchido.'
export const MSG_CPF_ESCRITO = 'O modelo tem um CPF escrito: troque o dado do cliente pela {{VARIÁVEL}} antes de subir.'

/** As opções da biblioteca: `{{NOME}}` como no ZapSign; um erro de modelo traz trecho do texto, que nunca vai para o log. */
export const OPCOES_DO_MODELO = {
  delimiters: { start: '{{', end: '}}' },
  errorLogging: false,
  parser: (tag: string) => ({ get: (escopo: Record<string, string | undefined>) => escopo[nomeDaVariavel(tag)] }),
}

export type ModeloLido = { ok: true; variaveis: string[] } | { ok: false; erro: string }

/** O que a biblioteca achou de errado na escrita das variáveis, dito em português para a Sênior acertar no Word. */
function erroDaEscrita(e: unknown): string {
  const erros = (e as { properties?: { errors?: { properties?: { xtag?: string } }[] } }).properties?.errors ?? []
  const tag = erros.find((x) => x.properties?.xtag)?.properties?.xtag
  return `O modelo tem uma {{VARIÁVEL}} mal escrita${tag ? ` (perto de "${tag}")` : ''}: confira as chaves {{ }} no Word.`
}

/** Abre o .docx e confere o que o portal exige do modelo (CA1): é do Word, as variáveis são conhecidas e não há CPF escrito. */
export function lerModelo(conteudo: Buffer): ModeloLido {
  let zip: PizZip
  try {
    zip = new PizZip(conteudo)
  } catch {
    return { ok: false, erro: MSG_NAO_E_DOCX }
  }
  if (!zip.file('word/document.xml')) return { ok: false, erro: MSG_NAO_E_DOCX }
  let doc: Docxtemplater
  try {
    doc = new Docxtemplater(zip, OPCOES_DO_MODELO)
  } catch (e) {
    return { ok: false, erro: erroDaEscrita(e) }
  }
  const textos = Object.keys(zip.files)
    .filter((n) => PARTES_COM_TEXTO.test(n))
    .map((n) => doc.getFullText(n))
  const variaveis = [...new Set(textos.flatMap((t) => [...t.matchAll(/\{\{([^{}]*)\}\}/g)].map((m) => nomeDaVariavel(m[1]))))]
  if (variaveis.length === 0) return { ok: false, erro: MSG_SEM_VARIAVEL }
  const desconhecidas = variaveisDesconhecidas(variaveis)
  if (desconhecidas.length > 0) {
    return { ok: false, erro: `O modelo tem variáveis que o portal não sabe preencher: ${desconhecidas.map((v) => `{{${v}}}`).join(', ')}. Confira a escrita no Word.` }
  }
  if (textos.some((t) => CPF_ESCRITO.test(t))) return { ok: false, erro: MSG_CPF_ESCRITO }
  return { ok: true, variaveis }
}

/**
 * O kit preenchido (CA3): cada {{VARIÁVEL}} sai com o dado do cliente, e o dado que falta sai em branco (`faltamNoKit` já
 * barrou o que é obrigatório). No papel (CA5), só a primeira {{DATA DE HOJE}} leva a data de hoje: é a do contrato de
 * honorários, o primeiro documento do modelo. As outras datas saem em branco, para o cliente preencher à mão na assinatura.
 * ponytail: "a primeira é a do contrato" vale para os modelos do escritório; outro modelo com outra ordem pede outra regra.
 */
export function preencherModelo(conteudo: Buffer, valores: Record<string, string | undefined>, hoje: string): Buffer {
  let datas = 0
  const doc = new Docxtemplater(new PizZip(conteudo), {
    ...OPCOES_DO_MODELO,
    parser: (tag: string) => {
      const nome = nomeDaVariavel(tag)
      return { get: (escopo: Record<string, string | undefined>) => (nome === 'DATA DE HOJE' && datas++ > 0 ? dataEmBranco(hoje) : escopo[nome]) }
    },
    nullGetter: () => '',
  })
  doc.render(valores)
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}
