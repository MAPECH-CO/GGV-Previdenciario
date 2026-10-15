GGVP-158 · Fechamento (Mateus) · frente "fluxo de ponta a ponta e permissões por perfil" (15/10). Change irmã da `ggvp-158-fechamento`: dois PRs, dois `tasks.md`.

## Por quê

A história do sistema diz que o portal está pronto quando a Maria vai do balcão ao dinheiro com o perfil certo em cada passo: "nenhum login faz o passo de outro perfil, nem pela tela, nem pelo chat, nem chamando a API". A varredura de 15/10 (API rota a rota por perfil; capítulos 1 a 8 com os logins de exemplo; telas e chat) achou: dado que vaza, passo de outro perfil aceito, tarefa na fila errada, tela sem trava, um passo que para. Cada correção traz o teste que falhava.

## Histórias na ordem

Uma história, GGVP-158 (Refinada; frente autorizada em 15/10), um requisito por erro:

1. **E1** · Publicações só para quem abre o processo (GGVP-162) · Jurídico e Sócio.
2. **E2** · `/api/recepcao` sem honorários nem acordo para quem não vê valores · quem não é Atendimento, Financeiro nem Sócio.
3. **E3** · A escalada da confirmação da entrevista na fila da Sênior (G15) · Sênior.
4. **E4** · Depois de subir à Sênior, a confirmação não aceita tentativas (G15) · Atendimento.
5. **E5** · "Olhei, sem novidade" só do Jurídico · advogada.
6. **E6** · A senha do cofre à advogada e à Sênior só com a exigência do INSS aberta (G9) · Jurídico.
7. **E7** · Telas de passo com trava de perfil · todos.
8. **E8** · Jurimetria escrita "dos/das" barrada na peça (G22) · advogada.
9. **E9** · O Sócio lê o conteúdo médico na página da perícia · Sócio.
10. **E10** · Conferir o checklist (D1.21) e o documento (D1.18) só da Documentação, na API e na tela (matriz v35) · Documentação.
11. **E11** · O papel assinado do caso do servidor sobe pela rota do contrato e a assinatura conclui (G1) · Atendimento.

## Travadas

- **Lucas:** recebimento confirmado antes do "Levei ao banco" (GGVP-98 CA9); "Aprovar o resumo" só no caso perdido; o telefone ao Financeiro; orientação por ligação sem Chatwoot (GGVP-53); exigência vencida só da Sênior (G21); a Documentação cobrar documento.
- **Integrações e IA:** scanner simulado; acervo que devolve transcrição; conferência sem IA.
- **Modo misto** (GGVP-125/159): tarefas e chat de exemplo do navegador.

## Fora do escopo

Regra de negócio nova, migração, Chatwoot, Drive e IA de verdade. A matriz muda uma vez, no fim, sobre a main.

## Portões envolvidos

G1, G9, G15, G22, GGVP-162 e o dado de saúde só com `dado_saude.ver_detalhe`, com a leitura registrada.
