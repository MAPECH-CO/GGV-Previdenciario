// EXEMPLO. Servidor de exemplo da circunstância do acidente (GGVP-47), sobre o mesmo banco de servidor.ts. A tabela de
// documentos por circunstância fica em checklist.ts, com a lista de cada benefício. Ligar no servidor: trocar o corpo de
// cada função por fetch no endpoint da spec da ggvp-47.
import { isoParaData } from '../campos.ts'
import { CATEGORIAS, CIRCUNSTANCIAS, especie, motivoParaNaoSalvar, sugestaoDaSegundaFicha, type AcidenteDoCaso, type AcidenteNaTela, type DadosDoAcidente } from '../regras/acidente.ts'
import { hojeIso } from '../regras/datas.ts'
import { doBancoOuNulo } from './parecer.ts'
import { agora, doServidor, esperar, evento, gravar, ler, noBanco, type Banco } from './servidor.ts'

export type { AcidenteDoCaso, AcidenteNaTela, SugestaoDoAcidente } from '../regras/acidente.ts'

/** A circunstância salva do caso, para o checklist. */
export const acidenteDoCaso = (banco: Banco, processoId: string): AcidenteDoCaso | undefined => banco.acidentes?.find((a) => a.processoId === processoId)

function acharCaso(banco: Banco, processoId: string) {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return ficha && processo ? { ficha, processo } : null
}

/** GET /api/processos/:id/acidente */
export async function obterAcidente(processoId: string): Promise<AcidenteNaTela | null> {
  if (doServidor(processoId)) return doBancoOuNulo<AcidenteNaTela>(`/processos/${processoId}/acidente`)
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return null
  const dados = acidenteDoCaso(banco, processoId)
  const sugestao = sugestaoDaSegundaFicha(caso.ficha)
  return { ...(dados && { dados }), ...(sugestao && { sugestao }) }
}

const podeSalvar = (perfil: string | undefined) => perfil === 'documentacao' || perfil === 'advogada' || perfil?.startsWith('senior') === true

/** PUT /api/processos/:id/acidente. A Documentação ou o Jurídico; o servidor confere de novo. */
export async function salvarAcidente(processoId: string, dados: DadosDoAcidente, quem: { perfil?: string; nome: string }): Promise<AcidenteDoCaso> {
  if (doServidor(processoId)) return noBanco<AcidenteDoCaso>(`/processos/${processoId}/acidente`, { method: 'PUT', corpo: dados })
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
    auxilioAnterior: dados.auxilioAnterior,
    recusados: dados.recusados.filter((r) => r === 'cat' || r === 'ppp'),
    processoId,
    quem: quem.nome,
    quando: agora().toISOString(),
  }
  banco.acidentes = [...(banco.acidentes ?? []).filter((a) => a.processoId !== processoId), registro]
  // O auxílio anterior é dado de saúde: fica fora do histórico.
  caso.ficha.historico.push(
    evento(`Marcou a circunstância do acidente: ${CIRCUNSTANCIAS[dados.circunstancia]} · ${CATEGORIAS[dados.categoria]} · ${especie(dados.circunstancia)}`, quem.nome),
  )
  gravar(banco)
  return registro
}
