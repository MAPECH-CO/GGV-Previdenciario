GGVP-158 · Fechamento do desenvolvimento (Mateus) · frente "fluxo de ponta a ponta e permissões por perfil" (15/10), sobre a história do sistema. Change irmã da `ggvp-158-fechamento`, para os dois PRs não brigarem no mesmo `tasks.md`.

## Por quê

A história do sistema diz que o portal está pronto quando a Maria vai do balcão ao dinheiro com o perfil certo em cada passo, e "nenhum login faz o passo de outro perfil: nem pela tela, nem pelo chat, nem chamando a API". A varredura de 15/10 (API rota a rota por perfil; capítulos 1 a 8 com os logins de exemplo; telas e chat) achou onde isso não vale: dado que vaza, passo de outro perfil aceito pela API, tarefa na fila errada e telas sem trava. Cada correção vem com o teste que falhava antes.

## Histórias na ordem

Uma história, GGVP-158 (Refinada; frente autorizada pelo Mateus em 15/10), um requisito por erro:

1. **E1** · Publicações só para quem abre o processo (GGVP-162) · Jurídico e Sócio.
2. **E2** · `/api/recepcao` sem honorários nem acordo para quem não vê valores · Documentação, Jurídico adm, advogada, Sênior.
3. **E3** · A escalada da confirmação da entrevista na fila da Sênior (G15) · Sênior.
4. **E4** · Depois de subir à Sênior, a confirmação não aceita tentativas (G15) · Atendimento.
5. **E5** · "Olhei, sem novidade" só do Jurídico · advogada.
6. **E6** · A senha do cofre à advogada e à Sênior só com a exigência do INSS aberta (G9) · Jurídico.
7. **E7** · Telas de passo com trava de perfil · todos.
8. **E8** · Jurimetria escrita "dos/das" barrada na peça (G22) · advogada.
9. **E9** · O Sócio lê o conteúdo médico na página da perícia · Sócio.
10. **E10** · "Conferir checklist" (D1.21) e "Conferir documento" (D1.18) só da Documentação, na API e na tela (matriz v35) · Documentação.

## Travadas

- **Assinatura em papel do caso do servidor** (crítica na homologação): "Concluir a assinatura" fica desligado na tela (GGVP-159 parte 3, "esperam a rota do Mateus"); a rota existe desde 14/10 (P4.4). Ligar a tela é do Pedro.
- **Lucas:** recebimento confirmado antes do "Levei ao banco" (GGVP-98 CA9); "Aprovar o resumo" só no caso perdido; o telefone ao Financeiro; a orientação por ligação sem Chatwoot (GGVP-53); a exigência vencida só da Sênior (G21); a Documentação cobrar documento.
- **Integrações e IA:** scanner simulado no Receber documento; acervo que devolve transcrição; conferência sem IA.
- **Modo misto das telas** (GGVP-125/159): tarefas e chat de exemplo do navegador.

## Fora do escopo

Regra de negócio nova, migração, Chatwoot, Drive e IA de verdade. A matriz muda uma vez, no fim, sobre a main mais nova.

## Portões envolvidos

G1, G9, G15, G22, GGVP-162 e o dado de saúde só para quem tem `dado_saude.ver_detalhe`, com a leitura registrada.
