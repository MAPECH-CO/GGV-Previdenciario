// Gera src/design/tokens.css a partir de src/design/figma-tokens.json.
// O JSON é o retrato das coleções de variáveis do Figma (Tema e Acessibilidade).
// Uso: npm run tokens
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const pasta = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'design')

// Fonte em rem: igual ao px do Figma com o navegador em 16px, e respeita a fonte que a pessoa configurou.
const rem = (px) => `${px / 16}rem`

export function gerarCss(tokens) {
  const cores = Object.entries(tokens.cores)
  const fontes = Object.entries(tokens.fontes)

  const linhasCor = (modo) => cores.map(([nome, valores]) => `  --cor-${nome}: ${valores[modo]};`)
  const linhasFonte = (modo) =>
    fontes.map(([nome, valores]) => `  --fonte-${nome}: ${rem(valores[modo])}; /* ${valores[modo]}px */`)

  return [
    '/* GERADO por scripts/gerar-tokens.mjs a partir de figma-tokens.json. Não edite à mão:',
    '   mude o JSON (ou extraia de novo do Figma) e rode `npm run tokens`.',
    `   Origem: Figma "${tokens.origem.nome}" (${tokens.origem.arquivo}),`,
    `   coleções ${tokens.origem.colecoes.cores} e ${tokens.origem.colecoes.fontes}, extraídas em ${tokens.origem.extraidoEm}. */`,
    '',
    '/* Tema claro e fonte padrão: valores iniciais. */',
    ':root {',
    '  color-scheme: light;',
    ...linhasCor('claro'),
    '',
    ...linhasFonte('padrao'),
    '}',
    '',
    '/* Tema escuro. */',
    ':root[data-tema="escuro"] {',
    '  color-scheme: dark;',
    ...linhasCor('escuro'),
    '}',
    '',
    '/* Fonte grande (+25%). */',
    ':root[data-fonte="grande"] {',
    ...linhasFonte('grande'),
    '}',
    '',
  ].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tokens = JSON.parse(readFileSync(join(pasta, 'figma-tokens.json'), 'utf8'))
  writeFileSync(join(pasta, 'tokens.css'), gerarCss(tokens))
  console.log(
    `tokens.css gerado: ${Object.keys(tokens.cores).length} cores x 2 temas, ${Object.keys(tokens.fontes).length} tamanhos x 2 modos.`,
  )
}
