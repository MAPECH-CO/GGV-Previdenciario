// Pasta do cliente no Drive (GGVP-16, CA14): uma só por cliente.
// Regra do scanner (a confirmar na GGVP-81): pelo CPF que ele leu; sem CPF, pelo nome sem acento.
import { normalizarCpf, normalizarNome } from '../campos.ts'
import type { PastaDrive } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'

export function pastasDoCliente(pastas: PastaDrive[], cliente: { nome: string; cpf?: string }): PastaDrive[] {
  const cpf = normalizarCpf(cliente.cpf)
  if (cpf.length === 11) {
    const peloCpf = pastas.filter((p) => p.cpf === cpf)
    if (peloCpf.length > 0) return peloCpf
  }
  const nome = semAcento(normalizarNome(cliente.nome))
  return pastas.filter((p) => semAcento(p.nome) === nome)
}
