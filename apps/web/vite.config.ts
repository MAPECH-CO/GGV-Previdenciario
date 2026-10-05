import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // kit/campos fica fora de apps/web e o servidor de desenvolvimento precisa poder servi-la (src/campos.ts).
  // Porta por variável (PORTA_WEB) para rodar sessões em paralelo, cada uma na sua árvore; sem ela, 5173.
  server: { port: Number(process.env.PORTA_WEB ?? 5173), strictPort: true, fs: { allow: ['.', '../../kit/campos/src'] } },
  test: {
    // No Windows, com o repositório no OneDrive, o pool "forks" estoura o tempo ao subir o worker.
    pool: 'threads',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
