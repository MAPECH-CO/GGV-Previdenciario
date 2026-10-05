import { defineConfig } from '@playwright/test'

// Ponta a ponta no Chromium: o que depende do CSS aplicado e das rotas do `npm run dev`.
// Os testes terminam em .e2e.ts para o Vitest não pegá-los.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
