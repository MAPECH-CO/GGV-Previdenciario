# Design

## Context

- Esta change continua a `ggvp-6-recepcao-e-entrevista`: mesma base de telas, mesmo servidor de exemplo, mesmos clientes. As decisões da `design.md` dela valem aqui (servidor de exemplo em `src/dados/servidor.ts`, regras puras em `src/regras/`, `campos` pelo `src/campos.ts`, catálogos únicos em `src/dados/catalogos.ts`).
- O catálogo de benefícios já está em `BENEFICIOS` (`src/dados/catalogos.ts`), tirado do cartão GGVP-91. O kit e o checklist usam esse, sem lista nova.
- Duas sessões trabalham ao mesmo tempo. Para a junção não virar briga de arquivo, valem as regras abaixo.

## Decisions (valem para o épico)

1. **Arquivo novo por assunto.** Grupo contrato: `src/dados/contrato.ts` e `src/regras/contrato.ts`. Grupo documentos: `src/dados/checklist.ts` e `src/regras/checklist.ts`. Tipo novo fica no arquivo do assunto, não em `tipos.ts`, salvo quando o outro grupo também precisa dele.
2. **Arquivo comum só com acréscimo.** Em `servidor.ts` (tipo `Banco`), `exemplo.ts`, `tipos.ts`, `catalogos.ts` e `App.tsx`: acrescentar no fim do bloco, sem reordenar nem reformatar o que já existe. Campo novo no `Banco` é opcional (`contratos?: ...`) e a chave do `sessionStorage` não muda.
3. **Porta por variável.** `PORTA_WEB` no `vite.config.ts` e no `playwright.config.ts`. Grupo contrato usa 5181, grupo documentos 5182, a junção 5180.
4. **Ligação entre os grupos.** Onde uma tela de um grupo depende do resultado do outro (o contrato assinado que a leitura arquiva, a cópia que as boas-vindas mandam), a tela lê do servidor de exemplo por uma função com a forma do endpoint e mostra o estado de exemplo. A junção liga as duas pontas.
