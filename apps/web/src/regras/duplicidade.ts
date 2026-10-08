// Uma ficha só por pessoa (GGVP-16, CA6 e CA9).
import { normalizarCpf, normalizarNome, normalizarTelefone } from '../campos.ts'
import type { Ficha } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'

/** CPF repetido: abre a ficha que já existe, nunca cria outra. */
export function fichaComCpf(fichas: Ficha[], cpf: string | undefined): Ficha | undefined {
  const numeros = normalizarCpf(cpf)
  if (numeros.length !== 11) return undefined
  return fichas.find((f) => f.cpf === numeros)
}

/** Telefone igual ou nome igual (sem acento): só avisa, porque família divide o mesmo celular. */
export function fichasParecidas(fichas: Ficha[], dados: { nome: string; telefone: string }): Ficha[] {
  const telefone = normalizarTelefone(dados.telefone)
  const nome = semAcento(normalizarNome(dados.nome))
  return fichas.filter((f) => (telefone !== '' && f.telefone === telefone) || (nome !== '' && semAcento(f.nome) === nome))
}
