GGVP-158 · Fechamento (Mateus) · as provas que faltam: os testes do servidor dos critérios que a auditoria de 15/10
deixou "não conferido" ou "parcial" só por falta de teste. Change irmã da `ggvp-158-fechamento`, da
`ggvp-158-fluxo-e-permissoes` (PR #100) e da `ggvp-158-integracoes-e-ia` (PR #101). Autorizada pelo Mateus na noite de
15/10, fora do `/epico`.

## Por quê

A conferência dos critérios (PR #102, `docs/conferencia-dos-criterios.md`, main `e49d510`) achou código que faz o que o
critério pede, mas sem teste do servidor que prove: a prova estava só na tela, no servidor de exemplo, ou em lugar nenhum.
Sem a prova, o Lucas não aceita a história. Aqui entram só os testes; o código não muda.

## Critérios na ordem

Um requisito por critério, um teste por requisito, com a história e o CA no nome:

1. **GGVP-93 CA3** · benefício sem roteiro: o aviso e a conferência manual · advogada.
2. **GGVP-36 CA1, CA4, CA7** · a renovação da senha do gov.br: a tarefa, o prazo e o que a advogada vê · Atendimento.
3. **GGVP-28 CA1** · "pode ser acidentário" abre a pendência da segunda ficha · advogada, depois Atendimento.
4. **GGVP-51 CA2** · sem benefício citado, a sugestão com os casos da casa e o porquê · advogada.
5. **GGVP-86 CA2, CA3, CA5, CA8, CA9, CA11** · a página do processo do caso do servidor · Jurídico e Sócio.
6. **GGVP-151 CA2 e GGVP-38 CA7** · a chance do caso com a recomendação da perícia aberta, número do código · advogada.
7. **GGVP-156 CA2** · a Documentação e o Atendimento veem o perito e o resultado, sem os números nem os laudos.
8. **GGVP-95 CA3** · o documento ilegível vira "reenviar legível" para o Atendimento.
9. **GGVP-24 CA9** · a senha de teste fora da exportação do histórico e do PDF do kit.
10. **GGVP-52 CA2, CA5** · o motivo do indeferimento no acervo; a falha de gravação visível e refeita sem duplicar.

## Regra desta change

- Se o teste mostra que o código não faz o que o critério pede, o código **não** se corrige aqui: o teste sai do commit e
  o critério vai ao PR como lacuna confirmada, com o arquivo e a linha.
- Nenhum arquivo que o PR #100, o PR #101 ou a sessão "Lacunas do servidor sem PR" alteram (`ia/acervo.ts`,
  `rotas/chat.ts`, `rotas/prestacao.ts`). Por isso os critérios 4, 7, 8 e 9 têm arquivo de teste novo.

## Fora do escopo

- Correção de código, migração, variável e dependência nova.
- IA, Drive, Chatwoot, Supabase e homologação de verdade: só o `fetch` falso e o banco embutido, com dado inventado.
- O Jira: só leitura.

## Portões envolvidos

- **G9:** a senha do gov.br fora da exportação e do kit (critério 9).
- **G17:** a conferência manual sem roteiro (critério 1).
- **G19 e G22:** a chance pelo código, com os casos e a data da base (critério 6); a jurimetria do perito só para o
  Jurídico e o Sócio (critério 7).
