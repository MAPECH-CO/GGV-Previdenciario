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
5. **Abrir o próprio documento (Pedro, 14/10; GGVP-81 CA17, GGVP-18 CA8, GGVP-27 CA8).** As telas da ficha (conferência, liberação, perícia) não têm o id do documento, mas o arquivo da ficha guarda o SHA-256, e o registro do documento também (`documento.hash_sha256`). Rota nova `GET /api/pessoas/:id/documentos/:hash` acha o documento pela pessoa e pelo conteúdo, sem mudar o banco; a rota do caso (`GET /api/casos/:id/documentos/:doc`) segue para as listas que já têm o id (Conferir antes do INSS, Protocolar, página do processo). As duas servem o arquivo pela mesma função, com as mesmas travas (`caso.ver`, peça, saúde com `acesso_dado_sensivel`) e os mesmos cabeçalhos. O arquivo do scanner (chave `drive:<id>`) é lido do Drive (`drive.baixar`), também com o Drive só de leitura; sem Drive, 404 com mensagem clara. Na tela, um componente só (`componentes/AbrirDocumento.tsx`) abre o arquivo numa janela do navegador (`window.open` com tamanho de janela), onde o próprio navegador baixa e imprime; sem arquivo no portal, diz isso no lugar do link.
