import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // /api vai para a API local na mesma origem, para o cookie da sessão valer (GGVP-117). PORTA_API muda no Playwright.
  // Porta da tela por variável (PORTA_WEB) para rodar sessões em paralelo, cada uma na sua árvore; sem ela, 5173.
  server: { port: Number(process.env.PORTA_WEB ?? 5173), strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.PORTA_API ?? 3000}` } },
  test: {
    // No Windows, com o repositório no OneDrive, o pool "forks" estoura o tempo ao subir o worker.
    pool: 'threads',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Os "after" na ordem em que foram definidos: primeiro o cleanup do setup desmonta a tela, depois cada arquivo
    // desliga o fetch simulado. Na ordem inversa (padrão), a tela recarregava no meio e chamava a rede de verdade.
    sequence: { hooks: 'list' },
  },
})
