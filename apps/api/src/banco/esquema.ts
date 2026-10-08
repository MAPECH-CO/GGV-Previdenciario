// Modelo de dados do portal, por área (design da change ggvp-2-fundacao-tecnica, "Modelo de dados").
// Mudou aqui: `pnpm --filter @ggv/api db:gerar` cria a migração versionada.
// Toda tabela com RLS ligado e sem política: no Supabase, a chave pública não lê nada; só a API, que conecta como
// dona do banco, acessa. Tabela nova: terminar com `.enableRLS()` (o teste das migrações confere).
export * from './esquema/acesso.ts'
export * from './esquema/pessoas.ts'
export * from './esquema/casos.ts'
export * from './esquema/fluxo.ts'
export * from './esquema/documentos.ts'
export * from './esquema/inss.ts'
export * from './esquema/justica.ts'
export * from './esquema/outros.ts'
export * from './esquema/relacionamento.ts'
