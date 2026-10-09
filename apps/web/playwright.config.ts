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
// GGVP-118 CA7: o navegador e o processo do teste no fuso do escritório, como a API logo abaixo. O CI roda em UTC, e
// entre 21h e meia-noite o "hoje" do teste, o da tela e o do servidor davam dias diferentes.
const FUSO = 'America/Sao_Paulo'
process.env.TZ = FUSO

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: `http://localhost:${web}`, timezoneId: FUSO },
  projects: [
    { name: 'entrar', testMatch: /sessao\.setup\.ts/ },
    { name: 'logado', dependencies: ['entrar'], use: { storageState: SESSAO }, testIgnore: /login\.e2e\.ts/ },
    { name: 'sem-sessao', testMatch: /login\.e2e\.ts/ },
  ],
  webServer: [
    {
      command: 'node --experimental-strip-types ../api/src/principal.ts',
      url: `http://127.0.0.1:${api}/saude`,
      // O fuso do escritório, como na imagem da homologação (Dockerfile): o CI roda em UTC.
      env: { PORTA: api, TZ: FUSO },
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
