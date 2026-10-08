// Pasta do cliente no Drive (GGVP-16, CA14, e GGVP-17, CA11): uma só por cliente.
// Regra do scanner: pelo CPF que ele leu nos documentos da pasta; depois pelo nome igual, sem acento;
// por fim pelo nome com uma letra de diferença, desde que só uma pasta fique tão perto.
import { normalizarCpf, normalizarNome } from '../campos.ts'
import type { PastaDrive } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'

/** Uma letra trocada, a mais ou a menos. A leitura da IA usa a mesma tolerância (GGVP-81). */
export function umaLetraDeDiferenca(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
}

export function pastasDoCliente(pastas: PastaDrive[], cliente: { nome: string; cpf?: string }): PastaDrive[] {
  const cpf = normalizarCpf(cliente.cpf)
  if (cpf.length === 11) {
    const peloCpf = pastas.filter((p) => p.cpf === cpf)
    if (peloCpf.length > 0) return peloCpf
  }
  const nome = semAcento(normalizarNome(cliente.nome))
  const iguais = pastas.filter((p) => semAcento(p.nome) === nome)
  if (iguais.length > 0) return iguais
  const perto = pastas.filter((p) => umaLetraDeDiferenca(semAcento(p.nome), nome))
  return perto.length === 1 ? perto : []
}
