// GGVP-158: uma lista só das variáveis do servidor. Toda variável que o código do servidor lê está no .env.example (só o
// nome, sem valor) e na doc da homologação, e nada sobra lá. Variável nova fora da lista derruba este teste.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const daRaiz = (caminho: string) => readFileSync(fileURLToPath(new URL(`../../../${caminho}`, import.meta.url)), 'utf8')

function arquivosDoServidor(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivosDoServidor(join(pasta, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(pasta, e.name)] : [],
  )
}

/** Os nomes que o código lê: `process.env.X`, `ambiente.X` (ou `env.X`) e `const { X } = process.env` (ou `ambiente`). */
function variaveisLidas(codigo: string): string[] {
  const nomes = [...codigo.matchAll(/\b(?:process\.env|ambiente|env)\??\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]!)
  for (const [, dentro] of codigo.matchAll(/const \{([^}]*)\} = (?:process\.env|ambiente)\b/g))
    nomes.push(...dentro!.split(',').map((p) => p.split(':')[0]!.trim()).filter(Boolean))
  return nomes
}

const linhasDoExemplo = daRaiz('.env.example')
  .split(/\r?\n/)
  .filter((l) => /^#?\s*[A-Z][A-Z0-9_]*=/.test(l))
const noExemplo = new Set(linhasDoExemplo.map((l) => l.replace(/^#?\s*/, '').split('=')[0]!))
const naDoc = daRaiz('docs/infra/homologacao.md')
const lidas = new Set(arquivosDoServidor(fileURLToPath(new URL('.', import.meta.url))).flatMap((f) => variaveisLidas(readFileSync(f, 'utf8'))))

describe('GGVP-158 · uma lista só das variáveis do servidor', () => {
  it('toda variável que o servidor lê está no .env.example e na doc da homologação', () => {
    expect([...lidas].filter((n) => !noExemplo.has(n)), 'faltam no .env.example').toEqual([])
    expect([...lidas].filter((n) => !naDoc.includes(`| \`${n}\` |`)), 'faltam na tabela de docs/infra/homologacao.md').toEqual([])
  })

  it('nada sobra no .env.example: cada nome é lido pelo servidor', () => {
    expect([...noExemplo].filter((n) => !lidas.has(n))).toEqual([])
  })

  it('o .env.example só tem os nomes, sem valor', () => {
    expect(linhasDoExemplo.filter((l) => !/=\s*$/.test(l))).toEqual([])
  })

  it('a leitura acha as três formas de ler a variável', () => {
    expect(variaveisLidas('process.env.A_B; ambiente?.CC; env.FF; const { DD, EE: e } = ambiente').sort()).toEqual(['A_B', 'CC', 'DD', 'EE', 'FF'])
  })
})
