# Homologação no Coolify (GGVP-119): uma imagem com a API servindo a tela montada, numa URL só.
# A cada start: migrações primeiro; se falharem, o container não sobe e o Coolify mantém a versão anterior.
# Segredos (DATABASE_URL) só nas variáveis do Coolify, nunca aqui.
FROM node:22-slim
WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @ggv/web build

ENV NODE_ENV=production HOST=0.0.0.0 PORTA=3000
EXPOSE 3000

# 503 do /saude (banco fora do ar) também conta como falha.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/saude').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["sh", "-c", "pnpm --filter @ggv/api db:migrar && pnpm --filter @ggv/api start"]
