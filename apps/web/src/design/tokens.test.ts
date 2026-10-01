// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { gerarCss } from '../../scripts/gerar-tokens.mjs'
import tokens from './figma-tokens.json'

const src = fileURLToPath(new URL('..', import.meta.url))

function arquivos(pasta: string, termina: RegExp): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name)
    if (entrada.isDirectory()) return arquivos(caminho, termina)
    return termina.test(entrada.name) ? [caminho] : []
  })
}

describe('tokens do Figma', () => {
  it('tem as 29 cores do Tema e os 17 tamanhos da Acessibilidade', () => {
    expect(Object.keys(tokens.cores)).toHaveLength(29)
    expect(Object.keys(tokens.fontes)).toHaveLength(17)
  })

  it('toda cor tem valor claro e escuro em hexadecimal', () => {
    for (const [nome, valores] of Object.entries(tokens.cores)) {
      expect(valores.claro, `${nome} claro`).toMatch(/^#[0-9a-f]{6}$/)
      expect(valores.escuro, `${nome} escuro`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('a fonte grande nunca é menor que a padrão', () => {
    for (const [nome, valores] of Object.entries(tokens.fontes)) {
      expect(valores.grande, `fonte/${nome}`).toBeGreaterThan(valores.padrao)
    }
  })

  it('o nome do Figma vira a variável CSS (cor/fundo → --cor-fundo, fonte/13 → --fonte-13)', () => {
    const css = gerarCss(tokens)
    expect(css).toContain(`--cor-fundo: ${tokens.cores.fundo.claro};`)
    expect(css).toContain(`--cor-fundo: ${tokens.cores.fundo.escuro};`)
    expect(css).toContain(`--fonte-13: ${tokens.fontes['13'].padrao / 16}rem;`)
    expect(css).toContain(`--fonte-13: ${tokens.fontes['13'].grande / 16}rem;`)
  })

  it('tokens.css está em dia com figma-tokens.json (se falhar, rode npm run tokens)', () => {
    // No Windows, o checkout do Git pode trocar o fim de linha por CRLF; o conteúdo é o mesmo.
    const css = readFileSync(join(src, 'design', 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')
    expect(css).toBe(gerarCss(tokens))
  })

  it('todo var(--x) usado no código está definido em algum CSS', () => {
    const definidas = new Set<string>()
    for (const css of arquivos(src, /\.css$/)) {
      for (const [, nome] of readFileSync(css, 'utf8').matchAll(/(--[\w-]+)\s*:/g)) definidas.add(nome)
    }
    const faltando: string[] = []
    for (const arquivo of arquivos(src, /\.(css|tsx?)$/)) {
      if (arquivo.endsWith('.test.ts') || arquivo.endsWith('.test.tsx')) continue
      // só referências completas: var(--cor-${nome}) é montada em tempo de execução e fica de fora
      for (const [, nome] of readFileSync(arquivo, 'utf8').matchAll(/var\((--[\w-]+)[,)]/g)) {
        if (!definidas.has(nome)) faltando.push(`${arquivo.replace(src, '')}: ${nome}`)
      }
    }
    expect(faltando).toEqual([])
  })
})
