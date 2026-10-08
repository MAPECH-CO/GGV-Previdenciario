// EXEMPLO. Servidor de exemplo do LOAS de menor de 16 anos (GGVP-50), sobre o mesmo banco de servidor.ts. A condição da
// criança é dado de saúde: só o Jurídico marca e vê. Ligar no servidor: trocar o corpo de cada função por fetch no endpoint
// da spec da ggvp-50.
import { nomeTipo } from './catalogos.ts'
import { doJuridico } from './parecer.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo } from './tipos.ts'
import { hojeIso, idadeEm } from '../regras/datas.ts'
import { CONDICOES_DA_CRIANCA, TERAPIAS, menorDe16, relatoriosDaCrianca, type DadosDaCrianca } from '../regras/infantil.ts'

export type CriancaDoCaso = DadosDaCrianca & { processoId: string; quem: string; quando: string }

/** O LOAS Deficiente de beneficiário menor de 16 anos hoje (CA1). A ficha é do beneficiário. */
export const ehInfantil = (ficha: Ficha, processo: Processo) => processo.beneficio === 'loas-deficiente' && menorDe16(ficha.nascimento, hojeIso(agora()))

/** A condição marcada do caso, para o checklist. */
export const criancaDoCaso = (banco: Banco, processoId: string): CriancaDoCaso | undefined => banco.criancas?.find((c) => c.processoId === processoId)

function acharCaso(banco: Banco, processoId: string) {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return ficha && processo ? { ficha, processo } : null
}

/** O que a tela do parecer mostra: se é infantil, a condição (só ao Jurídico) e os relatórios que o caso pede. */
export type CriancaNaTela = { infantil: boolean; idade?: number; dados?: CriancaDoCaso; relatorios: string[] }

const idadeDa = (ficha: Ficha) => idadeEm(ficha.nascimento!, hojeIso(agora()))

/** GET /api/processos/:id/crianca. Quem não é do Jurídico não recebe a condição. */
export async function obterCrianca(processoId: string, perfil: string | undefined): Promise<CriancaNaTela | null> {
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return null
  if (!ehInfantil(caso.ficha, caso.processo)) return { infantil: false, relatorios: [] }
  const dados = criancaDoCaso(banco, processoId)
  const relatorios = relatoriosDaCrianca(dados ?? { condicoes: [], terapias: [], escola: false }).map(nomeTipo)
  return { infantil: true, idade: idadeDa(caso.ficha), ...(dados && doJuridico(perfil) && { dados }), relatorios }
}

/** PUT /api/processos/:id/crianca. Só o Jurídico; o histórico registra que marcou, sem a condição. */
export async function salvarCrianca(processoId: string, dados: DadosDaCrianca, quem: { perfil?: string; nome: string }): Promise<CriancaNaTela> {
  await esperar()
  if (!doJuridico(quem.perfil)) throw new Error('Só o Jurídico marca a condição da criança.')
  if (dados.condicoes.some((c) => !(c in CONDICOES_DA_CRIANCA)) || dados.terapias.some((t) => !(t in TERAPIAS))) throw new Error('Condição ou terapia fora da lista.')
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  if (!ehInfantil(caso.ficha, caso.processo)) throw new Error('A condição da criança é do LOAS Deficiente de menor de 16 anos.')
  const registro: CriancaDoCaso = { condicoes: [...new Set(dados.condicoes)], terapias: [...new Set(dados.terapias)], escola: dados.escola === true, processoId, quem: quem.nome, quando: agora().toISOString() }
  banco.criancas = [...(banco.criancas ?? []).filter((c) => c.processoId !== processoId), registro]
  // Dado de saúde fica fora do histórico: só o que aconteceu.
  caso.ficha.historico.push(evento('Marcou a condição e as terapias da criança (roteiro infantil)', quem.nome))
  gravar(banco)
  return { infantil: true, idade: idadeDa(caso.ficha), dados: registro, relatorios: relatoriosDaCrianca(registro).map(nomeTipo) }
}
