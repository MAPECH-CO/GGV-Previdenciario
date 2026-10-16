import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/banco/esquema.ts',
  out: './drizzle',
  // GGVP-163 R1: o schema `conhecimento` é do Lucas; o drizzle-kit nunca gera nem apaga nada nele.
  schemaFilter: ['public'],
})
