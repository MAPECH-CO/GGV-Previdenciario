// @vitest-environment node
// GGVP-108 CA6: todo CPF e todo número CNJ dos dados de exemplo (telas, servidor e testes de ponta a ponta) confere
// pelo dígito, como o portal exige. Fica de fora o teste de unidade, que escreve número errado de propósito, e a
// máscara de campo, só com zeros.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { normalizarCnj, normalizarCpf, validarCnj, validarCpf } from '../campos.ts'

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const arquivos = ['apps/web/src', 'apps/web/e2e', 'apps/api/src']
  .flatMap((pasta) => readdirSync(RAIZ + pasta, { recursive: true }).map((f) => `${pasta}/${String(f).replaceAll('\\', '/')}`))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
const soZeros = (s: string) => /^[0.-]+$/.test(s)

const BUSCAS: [string, RegExp, (s: string) => boolean][] = [
  ['CPF', /(?<![\d.-])(\d{3}\.\d{3}\.\d{3}-\d{2})(?![\d.-])/g, (s) => validarCpf(normalizarCpf(s))],
  ['CPF', /cpf\w*\s*[:=]\s*['"`](\d{11})['"`]/gi, validarCpf],
  ['CNJ', /(?<![\d.-])(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})(?![\d.-])/g, (s) => validarCnj(normalizarCnj(s))],
  ['CNJ', /['"`](\d{20})['"`]/g, validarCnj],
]

describe('GGVP-108 CA6 · os dados fictícios conferem', () => {
  it('todo CPF e número CNJ dos exemplos tem o dígito verificador certo', () => {
    const achados = arquivos.flatMap((f) => {
      const texto = readFileSync(RAIZ + f, 'utf8')
      return BUSCAS.flatMap(([tipo, busca, valido]) => [...texto.matchAll(busca)].map((m) => ({ tipo, numero: m[1], f, valido: soZeros(m[1]) || valido(m[1]) })))
    })
    expect(achados.filter((a) => a.tipo === 'CNJ').length).toBeGreaterThan(10) // a busca acha os números
    expect(achados.filter((a) => !a.valido).map((a) => `${a.tipo} ${a.numero} em ${a.f}`)).toEqual([])
  })
})
