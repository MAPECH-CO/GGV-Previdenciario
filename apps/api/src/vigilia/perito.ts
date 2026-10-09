// GGVP-59 CA1, CA6: o perito que a publicação de nomeação cita, pelo nome e pelas grafias conhecidas da base.
import type { Banco } from '../banco/conexao.ts'
import { perito } from '../banco/esquema.ts'

/** Sem acento, minúsculo, só letras e números, com espaço nas pontas para casar palavra inteira: "Dr. Zé" → " dr ze ". */
const normal = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `

/**
 * O perito da base cujo nome, nome normalizado ou grafia aparece no texto. Mais de um bate: vale o nome mais longo, o
 * mais específico. Nenhum: nulo, e a pergunta de um clique da Perícia identifica (CA6); nada trava.
 */
export async function peritoDaPublicacao(banco: Banco, texto: string) {
  const t = normal(texto)
  let achado: { id: string; nome: string; laudos: number } | null = null
  let tamanho = 0
  for (const p of await banco.select().from(perito))
    for (const grafia of [p.nome, p.nomeNormalizado, ...((p.grafias as string[] | null) ?? [])]) {
      const g = normal(grafia)
      if (g.trim() && g.length > tamanho && t.includes(g)) {
        achado = { id: p.id, nome: p.nome, laudos: ((p.perfil as { laudos?: unknown[] } | null)?.laudos ?? []).length }
        tamanho = g.length
      }
    }
  return achado
}
