// EXEMPLO. Servidor de exemplo da circunstância do acidente (GGVP-47), sobre o mesmo banco de servidor.ts. A tabela de
// documentos por circunstância fica em checklist.ts, com a lista de cada benefício. Ligar no servidor: trocar o corpo de
// cada função por fetch no endpoint da spec da ggvp-47.
import { isoParaData } from '../campos.ts'
import { CATEGORIAS, CIRCUNSTANCIAS, especie, motivoParaNaoSalvar, type DadosDoAcidente, type ValoresDoAcidente } from '../regras/acidente.ts'
import { hojeIso } from '../regras/datas.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha } from './tipos.ts'

export type AcidenteDoCaso = DadosDoAcidente & { processoId: string; quem: string; quando: string }

/** O que a segunda ficha já diz (GGVP-28): a tela começa daqui, e quem salva é a pessoa. */
export type SugestaoDoAcidente = Partial<Pick<ValoresDoAcidente, 'circunstancia' | 'categoria' | 'acidenteEm'>>

export type AcidenteNaTela = { dados?: AcidenteDoCaso; sugestao?: SugestaoDoAcidente }

/** A circunstância salva do caso, para o checklist. */
export const acidenteDoCaso = (banco: Banco, processoId: string): AcidenteDoCaso | undefined => banco.acidentes?.find((a) => a.processoId === processoId)

function sugestaoDa(ficha: Ficha): SugestaoDoAcidente | undefined {
  const r = ficha.segundaFicha?.respostas
  if (!r) return undefined
  return {
    ...(r.deTrabalho === 'sim' && { circunstancia: 'trabalho' as const }),
    ...(/clt|carteira/i.test(r.vinculo) && { categoria: 'empregado' as const }),
    ...(r.acidenteEm && { acidenteEm: r.acidenteEm }),
  }
}

function acharCaso(banco: Banco, processoId: string) {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return ficha && processo ? { ficha, processo } : null
}

/** GET /api/processos/:id/acidente */
export async function obterAcidente(processoId: string): Promise<AcidenteNaTela | null> {
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return null
  const dados = acidenteDoCaso(banco, processoId)
  const sugestao = sugestaoDa(caso.ficha)
  return { ...(dados && { dados }), ...(sugestao && { sugestao }) }
}

const podeSalvar = (perfil: string | undefined) => perfil === 'documentacao' || perfil === 'advogada' || perfil?.startsWith('senior') === true

/** PUT /api/processos/:id/acidente. A Documentação ou o Jurídico; o servidor confere de novo. */
export async function salvarAcidente(processoId: string, dados: DadosDoAcidente, quem: { perfil?: string; nome: string }): Promise<AcidenteDoCaso> {
  await esperar()
  if (!podeSalvar(quem.perfil)) throw new Error('Só a Documentação ou o Jurídico marcam a circunstância do acidente.')
  const motivo = motivoParaNaoSalvar({ ...dados, acidenteEm: isoParaData(dados.acidenteEm) ?? '' }, hojeIso(agora()))
  if (motivo) throw new Error(motivo)
  if (!(dados.circunstancia in CIRCUNSTANCIAS) || !(dados.categoria in CATEGORIAS)) throw new Error('Circunstância ou categoria fora da lista.')
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  if (caso.processo.beneficio !== 'auxilio-acidente') throw new Error('A circunstância do acidente é do Auxílio-Acidente.')
  const registro: AcidenteDoCaso = {
    circunstancia: dados.circunstancia,
    categoria: dados.categoria,
    acidenteEm: dados.acidenteEm,
    internacao: dados.internacao,
    recusados: dados.recusados.filter((r) => r === 'cat' || r === 'ppp'),
    processoId,
    quem: quem.nome,
    quando: agora().toISOString(),
  }
  banco.acidentes = [...(banco.acidentes ?? []).filter((a) => a.processoId !== processoId), registro]
  // A internação é dado de saúde: fica fora do histórico.
  caso.ficha.historico.push(
    evento(`Marcou a circunstância do acidente: ${CIRCUNSTANCIAS[dados.circunstancia]} · ${CATEGORIAS[dados.categoria]} · ${especie(dados.circunstancia)}`, quem.nome),
  )
  gravar(banco)
  return registro
}
