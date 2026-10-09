import { defineConfig } from '@playwright/test'

// Ponta a ponta no Chromium, com a API de verdade e banco embutido limpo na memória (usuários de exemplo).
// Portas próprias (API 3101, tela 5174), para não brigar com o `pnpm dev` aberto na máquina; PORTA_E2E_API e
// PORTA_E2E_WEB mudam as duas quando outra árvore roda o Playwright ao mesmo tempo.
// Os testes terminam em .e2e.ts para o Vitest não pegá-los.
// As telas pedem sessão (GGVP-117): o projeto "entrar" faz o login de exemplo uma vez e os testes começam logados.
// Os testes do próprio login rodam sem sessão.
const api = process.env.PORTA_E2E_API ?? '3101'
const web = process.env.PORTA_E2E_WEB ?? '5174'
export const SESSAO = 'e2e/.sessao/atendimento.json'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // O navegador no fuso de Brasília, como o de quem usa o portal: o servidor conta o dia em Brasília (hojeEmBrasilia),
  // e a tela, no fuso do navegador. No CI (UTC), das 21h à meia-noite os dois discordavam do dia.
  use: { baseURL: `http://localhost:${web}`, timezoneId: 'America/Sao_Paulo' },
  projects: [
    { name: 'entrar', testMatch: /sessao\.setup\.ts/ },
    { name: 'logado', dependencies: ['entrar'], use: { storageState: SESSAO }, testIgnore: /login\.e2e\.ts/ },
    { name: 'sem-sessao', testMatch: /login\.e2e\.ts/ },
  ],
  webServer: [
    {
      command: 'node --experimental-strip-types ../api/src/principal.ts',
      url: `http://127.0.0.1:${api}/saude`,
      env: { PORTA: api },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${web} --strictPort`,
      url: `http://localhost:${web}`,
      env: { PORTA_API: api },
      reuseExistingServer: false,
    },
  ],
})
