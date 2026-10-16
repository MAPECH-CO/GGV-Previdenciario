// GGVP-158 (integrações e IA): roda o eval da leitura do balcão e dá a nota, campo a campo. O leitor é o mesmo do
// portal (`criarLeitor`), com a IA que quem chama passar: a de mentira nos testes, a de verdade só no comando que o
// Mateus libera (`rodar.ts`). A nota compara o que a leitura guardou com a resposta certa de cada documento inventado.
import type { Ia } from '../ia.ts'
import type { Arquivo, Ficha } from '../../../../web/src/dados/tipos.ts'
import { criarLeitor } from '../../fluxo/leitura.ts'
import { CLIENTE, DATA_DO_ARQUIVO, type CasoDoEval, type Esperado } from './documentos.ts'
import { pdfDeTexto } from './pdf-de-texto.ts'

/** Sem acento, sem caixa e sem o espaço repetido: "Dr. João" e "DR. JOAO" são o mesmo nome. */
const simples = (s: string | undefined) => (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

export type Campo = keyof Esperado
export type NotaDoCaso = { id: string; mede: string; certo: boolean; erros: { campo: Campo; esperado: unknown; lido: unknown }[] }
export type NotaDoEval = { casos: NotaDoCaso[]; campos: number; camposCertos: number; acerto: number }

/** O que a leitura guardou, no formato da resposta certa. */
type Lido = Record<Campo, unknown>

export async function avaliarLeitura(casos: CasoDoEval[], iaDoCaso: (caso: CasoDoEval) => Ia, agora = () => new Date('2026-10-15T15:00:00Z')): Promise<NotaDoEval> {
  const notas: NotaDoCaso[] = []
  for (const caso of casos) {
    const ficha = { id: `eval-${caso.id}`, nome: CLIENTE.nome, cpf: CLIENTE.cpf, arquivos: [] } as unknown as Ficha
    const arquivo: Arquivo = { nome: `${caso.id}.pdf`, tipo: caso.anunciado, local: 'pessoais', data: DATA_DO_ARQUIVO, origem: 'card', repetido: false, aguardaLeitura: true }
    const leitor = criarLeitor({ ia: iaDoCaso(caso), agora })
    const l = await leitor.documento({ ficha, arquivo, leituras: [], conteudo: { bytes: pdfDeTexto(caso.linhas), mime: 'application/pdf' }, quem: null })
    const lido: Lido = {
      tipo: l?.tipo,
      data: l?.data,
      situacao: l?.situacao,
      nome: l?.lidos.nome,
      cpf: l?.lidos.cpf,
      semAssinatura: l?.semAssinatura,
      dataEmBranco: l?.dataEmBranco,
      emitente: l?.emitente,
      // Sem leitura: a conferir, com confiança zero e nada lido (o ilegível também tem confiança zero, mas foi lido).
      semLeitura: l && l.situacao === 'a-conferir' && l.confianca === 0 && Object.keys(l.lidos).length === 0 ? true : undefined,
    }
    const e = caso.esperado
    // Cada campo da resposta certa conta; o nome e o emitente valem sem acento e sem caixa. O que não está na resposta
    // certa (o CPF que não confere, a assinatura que não falta) não pode aparecer.
    const campos: Campo[] = ['tipo', 'data', 'situacao', 'nome', 'cpf', 'semAssinatura', 'dataEmBranco', 'emitente', 'semLeitura']
    const erros = campos.flatMap((campo) => {
      const certo = campo === 'nome' || campo === 'emitente' ? simples(e[campo] as string) === simples(lido[campo] as string) : e[campo] === lido[campo]
      return certo ? [] : [{ campo, esperado: e[campo], lido: lido[campo] }]
    })
    notas.push({ id: caso.id, mede: caso.mede, certo: erros.length === 0, erros })
  }
  const campos = notas.length * 9
  const camposCertos = campos - notas.reduce((n, c) => n + c.erros.length, 0)
  return { casos: notas, campos, camposCertos, acerto: campos ? Math.round((camposCertos / campos) * 1000) / 10 : 0 }
}

/** A nota em texto, para o terminal e para o relatório. */
export function notaEmTexto(n: NotaDoEval): string {
  const linhas = n.casos.map((c) => (c.certo ? `  ok    ${c.id}` : `  ERRO  ${c.id}: ${c.erros.map((x) => `${x.campo} esperado ${JSON.stringify(x.esperado)}, lido ${JSON.stringify(x.lido)}`).join('; ')}`))
  const certos = n.casos.filter((c) => c.certo).length
  return [`Leitura do balcão: ${certos} de ${n.casos.length} documentos certos; ${n.camposCertos} de ${n.campos} campos (${n.acerto}%).`, ...linhas].join('\n')
}
