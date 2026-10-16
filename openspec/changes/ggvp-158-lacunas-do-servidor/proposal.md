GGVP-158 · Fechamento (Mateus) · as lacunas graves do servidor que a auditoria de 15/10 deixou sem PR (16/10). Change irmã da `ggvp-158-fechamento`, da `ggvp-158-fluxo-e-permissoes` (PR #100) e da `ggvp-158-integracoes-e-ia` (PR #101): um PR, um `tasks.md`.

## Por quê

A conferência dos critérios de 15/10 (PR #102, `docs/conferencia-dos-criterios.md`, "Lacunas") achou três lacunas graves do servidor sem dono. Conferido em 16/10: nem o #100, nem o #101, nem outra branch mexe nelas.

1. **Lacuna 4 · o acervo no chat serve a qualquer perfil** (GGVP-141 CA1, GGVP-142 CA1). A ferramenta `buscar_no_acervo` (`apps/api/src/rotas/chat.ts`) vai a todo perfil com `chat.usar`. Sem a regra de saúde, ela devolve a transcrição conferida de uma entrevista que não é só do Jurídico, a conversa conferida e o modelo de petição. O Financeiro não vê entrevista nem o caso, e a Documentação não vê entrevista nem peça (`docs/requisitos/perfis.md`). Primeiro o teste que prova ou desprova; a correção só entra se ele mostrar o vazamento.
2. **Lacuna 8 · a prestação de contas incompleta** (GGVP-92):
   - CA5: das quatro conferências do OK, só existe a da carta;
   - CA10: dado bancário mudado não pede verificação antes do OK.
3. **Lacuna 10 · o "Digitalizar (scanner simulado)" dá 404 fora dos testes** (GGVP-17 CA10). Espera decisão; não vira código aqui.

## Histórias na ordem

Uma história, a GGVP-158, um requisito por lacuna:

1. **L1** · O acervo no chat só para quem vê as peças · Financeiro, Documentação e Atendimento deixam de receber; Jurídico e Sócio seguem.
2. **L2** · As quatro conferências do OK da prestação (GGVP-92 CA5) · Sênior.
3. **L3** · Mudança de dados bancários esperando a segunda confirmação trava o OK (GGVP-92 CA10, a parte que não depende do prazo) · Sênior.

## Travadas

Não viram código aqui; ficam registradas em `docs/requisitos/duvidas-abertas.md` para quem decide.

- **Lucas:**
  - GGVP-92 CA1: o que a IA monta na prestação, se os números já saem do código (CA4), e com quais fontes (a carta de concessão, como hoje, ou a sentença e o comprovante, como no cartão);
  - GGVP-92 CA10: o prazo de "dados bancários alterados há pouco" para pedir nova verificação depois da segunda confirmação.
- **Mateus, com o Pedro:** o "Digitalizar (scanner simulado)" fora dos testes. Duas saídas:
  - a tela some com o botão fora dos testes;
  - a homologação liga pastas de teste do Drive (tarefa 1.15 da `ggvp-158-fechamento`).

  Nas duas, o botão não pode chamar a rota simulada fora dos testes.

## Fora do escopo

- A IA montar a prestação (CA1) e o prazo do CA10.
- A matriz de permissões: o #100 sobe a versão 35; esta change não a muda.
- A semente de exemplo no navegador (lacuna 2, do Pedro).
- Drive, Chatwoot e IA de verdade.

## Portões envolvidos

- G8: o OK da Sênior só sai com as quatro conferências.
- Dado de saúde só com `dado_saude.ver_detalhe`.
- As peças só com `peticao.ver`: Jurídico e Sócio, os mesmos perfis que veem saúde.
