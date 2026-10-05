import { defineConfig } from '@playwright/test'

// Ponta a ponta no Chromium: o que depende do CSS aplicado e das rotas do `npm run dev`.
// Os testes terminam em .e2e.ts para o Vitest não pegá-los.
// Mesma porta do vite.config.ts: PORTA_WEB, ou 5173 sem ela.
const porta = process.env.PORTA_WEB ?? '5173'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: `http://localhost:${porta}` },
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${porta}`,
    reuseExistingServer: true,
  },
})
