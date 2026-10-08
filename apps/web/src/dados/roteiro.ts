// EXEMPLO. Servidor de exemplo dos roteiros de conteúdo mínimo (GGVP-93), sobre o mesmo banco de servidor.ts. A semente é
// a matriz de docs/requisitos/roteiro-laudos.md (PDF do escritório, 26/09) e a resposta do Lucas de 01/10 (Q18). Ligar no
// servidor: trocar o corpo de cada função por fetch no endpoint da design (seção GGVP-93); quem salva vem da sessão.
import { ROTEIRO_INFANTIL } from '../regras/infantil.ts'
import { motivoParaNaoSalvar, novaVersao, roteiroDoBeneficio, type ItemDoRoteiro, type Roteiro } from '../regras/roteiro.ts'
import { roteirosDoEscritorio } from '../regras/roteirosDoEscritorio.ts'
import { agora, esperar, gravar, ler, type Banco } from './servidor.ts'

/** A semente: a régua do escritório. */
export const roteirosDeExemplo = roteirosDoEscritorio

/** Os roteiros do banco: nascem da semente. */
export function roteirosDo(banco: Banco): Roteiro[] {
  banco.roteiros ??= roteirosDeExemplo()
  return banco.roteiros
}

/** O roteiro do benefício do caso; undefined: "benefício sem roteiro" (CA3). Para o parecer (GGVP-20). Menor de 16 anos no LOAS Deficiente: o infantil (GGVP-50). */
export function roteiroDoCaso(banco: Banco, beneficio: string, menorDe16 = false): Roteiro | undefined {
  const roteiros = roteirosDo(banco)
  const infantil = menorDe16 && beneficio === 'loas-deficiente' ? roteiros.find((r) => r.id === ROTEIRO_INFANTIL) : undefined
  return infantil ?? roteiroDoBeneficio(roteiros, beneficio)
}

/** GET /api/roteiros */
export async function obterRoteiros(): Promise<Roteiro[]> {
  const banco = ler()
  const roteiros = roteirosDo(banco)
  gravar(banco)
  return roteiros
}

/** GET /api/roteiros/:id */
export async function obterRoteiro(id: string): Promise<Roteiro | null> {
  return (await obterRoteiros()).find((r) => r.id === id) ?? null
}

/** Só a sênior edita a régua (cartão GGVP-93, "Dados e permissões"). */
export const editaRoteiro = (perfil: string | undefined) => perfil?.startsWith('senior') === true

/** POST /api/roteiros/:id/versoes. Só a sênior; valida de novo; nasce a versão seguinte, com autor e data (CA2). */
export async function salvarRoteiro(id: string, itens: ItemDoRoteiro[], quem: { perfil?: string; nome: string }): Promise<Roteiro> {
  await esperar()
  if (!editaRoteiro(quem.perfil)) throw new Error('Só a sênior edita o roteiro.')
  const motivo = motivoParaNaoSalvar(itens)
  if (motivo) throw new Error(motivo)
  const banco = ler()
  const roteiros = roteirosDo(banco)
  const i = roteiros.findIndex((r) => r.id === id)
  if (i < 0) throw new Error('Roteiro não encontrado')
  roteiros[i] = novaVersao(roteiros[i], itens, quem.nome, agora().toISOString())
  gravar(banco)
  return roteiros[i]
}
