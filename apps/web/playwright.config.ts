import { defineConfig } from '@playwright/test'

// Ponta a ponta no Chromium, com a API de verdade e banco embutido limpo na memória (usuários de exemplo).
// Portas próprias (API 3101, tela 5174), para não brigar com o `pnpm dev` aberto na máquina.
// Os testes terminam em .e2e.ts para o Vitest não pegá-los.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: 'http://localhost:5174' },
  webServer: [
    {
      command: 'node --experimental-strip-types ../api/src/principal.ts',
      url: 'http://127.0.0.1:3101/saude',
      env: { PORTA: '3101' },
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { PORTA_API: '3101' },
      reuseExistingServer: false,
    },
  ],
})
