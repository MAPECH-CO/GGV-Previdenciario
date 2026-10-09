// EXEMPLO. O cofre simulado (GGVP-24; o cofre de verdade, com o "Revelar", é da GGVP-103). A senha vai e não volta: o
// servidor de exemplo descarta o valor e guarda só quem, quando e de onde. Nunca em ficha, histórico, log nem
// sessionStorage (G9). Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da design.md.
import { QUEM, agora, doServidor, esperar, evento, gravar, ler, noBanco, receber, type Banco, type RegistroDoCofre } from './servidor.ts'
import type { Ficha, SenhaGov } from './tipos.ts'

/** Tamanho aceito da senha do gov.br. */
export const TAMANHO_DA_SENHA = { minimo: 1, maximo: 100 }

function acharFicha(banco: Banco, fichaId: string): Ficha {
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  return ficha
}

/**
 * GGVP-125, bloco 3b: nas fichas do servidor, a senha vai ao cofre do portal (cifrada, com a trilha de quem e quando) e a
 * ficha guarda só a situação. A senha nunca passa pela rota da ficha.
 */
export async function noCofreDoPortal(fichaId: string, acao: 'guardou' | 'nao-sabe' | 'conferiu', senha?: string): Promise<{ senhaGov: SenhaGov }> {
  if (senha !== undefined) await noBanco(`/pessoas/${fichaId}/cofre`, { method: 'POST', corpo: { senha } })
  const r = await noBanco<{ senhaGov: SenhaGov; ficha: Ficha }>(`/fichas/${fichaId}/cofre/gov`, { method: 'POST', corpo: { acao } })
  receber(r)
  return { senhaGov: r.senhaGov }
}

/** Uma linha da trilha do cofre. As outras partes do servidor de exemplo também registram aqui. */
export function registrarNoCofre(banco: Banco, fichaId: string, acao: RegistroDoCofre['acao'], quem = QUEM) {
  banco.cofre.push({ fichaId, quando: agora().toISOString(), quem, acao })
}

/** POST /api/fichas/:id/cofre/gov. Guarda e devolve só a situação (CA2, CA8, CA9). */
export async function guardarSenhaNoCofre(fichaId: string, senha: string): Promise<{ senhaGov: SenhaGov }> {
  await esperar()
  if (senha.length < TAMANHO_DA_SENHA.minimo || senha.length > TAMANHO_DA_SENHA.maximo) throw new Error('Senha vazia ou longa demais')
  if (doServidor(fichaId)) return noCofreDoPortal(fichaId, 'guardou', senha)
  const banco = ler()
  const ficha = acharFicha(banco, fichaId)
  // O valor da senha termina aqui: no servidor de verdade, vai cifrado para o cofre (GGVP-103).
  ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: agora().toISOString(), por: QUEM }
  registrarNoCofre(banco, fichaId, 'guardou')
  ficha.historico.push(evento('Guardou a senha do gov.br no cofre'))
  gravar(banco)
  return { senhaGov: ficha.senhaGov }
}

/** POST /api/fichas/:id/cofre/gov/nao-sabe. A ficha segue com o alerta de senha (CA3, GGVP-36). */
export async function naoSabeASenha(fichaId: string): Promise<{ senhaGov: SenhaGov }> {
  if (doServidor(fichaId)) return noCofreDoPortal(fichaId, 'nao-sabe')
  await esperar()
  const banco = ler()
  const ficha = acharFicha(banco, fichaId)
  ficha.senhaGov = { situacao: 'sem-senha', naoSabe: true }
  registrarNoCofre(banco, fichaId, 'nao-sabe')
  ficha.historico.push(evento('Marcou "não sei a senha do gov.br": o caso segue com o alerta de senha'))
  gravar(banco)
  return { senhaGov: ficha.senhaGov }
}

/** POST /api/fichas/:id/cofre/gov/conferida. A senha que a IA leu do papel, conferida pelo Atendimento (CA15). */
export async function conferirSenhaLida(fichaId: string): Promise<{ senhaGov: SenhaGov }> {
  if (doServidor(fichaId)) return noCofreDoPortal(fichaId, 'conferiu')
  await esperar()
  const banco = ler()
  const ficha = acharFicha(banco, fichaId)
  if (!ficha.senhaGov.conferir) throw new Error('Não há senha lida do papel para conferir')
  ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: agora().toISOString(), por: QUEM }
  registrarNoCofre(banco, fichaId, 'conferiu')
  ficha.historico.push(evento('Conferiu com o papel a senha do gov.br que a IA leu; ela fica no cofre'))
  gravar(banco)
  return { senhaGov: ficha.senhaGov }
}
