# Perfis e o que cada um vê

Os perfis saem das raias do BPMN. Toda tela inicial tem o mesmo formato: **"O que é meu hoje"** (fila de tarefas com prazo e cor na que exige ação) mais **uma caixa de conversa** onde a pessoa pergunta ou pede em linguagem natural. A navegação pelos processos fica em segundo plano, a um clique.

| Perfil | Raia no BPMN | Tela inicial mostra | Faz | Nunca vê |
|---|---|---|---|---|
| **Atendimento** | ATENDIMENTO | Agenda do dia, fila de tarefas (assinatura, verificação de contrato, cobrança, exigência, laudo novo a subir), leads para recontatar | Recebe quem chega, confirma agendamento, confere e corrige contrato, cobra cliente, busca e sobe o laudo novo no card do cliente (D1.02); a perícia saiu do Atendimento em 29/09 | Petição, estratégia jurídica, valores (o percentual de honorários aparece só no contrato que confere) |
| **Documentação** | DOCUMENTAÇÃO · ADM | Cards de documentos pendentes por cliente, fila do scanner, checklist por benefício | Recebe, digitaliza e anexa documentos, busca o que exigência ou perícia pede | Petição, valores |
| **Advogada responsável** | JURÍDICO | Entrevistas do dia com a ficha já lida, casos com decisão, exigências e perícias a conferir, laudos novos a conferir, remarcações de perícia que passaram do limite, petições a pedir e conferir | Entrevista, confirma o benefício, decide se o caso precisa de perícia (D2.03), confere o laudo novo (D1.21M), analisa exigência e define o setor, pede e confere a petição, protocola, dá o OK na prestação de contas | Valores fora da prestação de contas que ela faz, configurações do escritório |
| **Sênior** | JURÍDICO (conferência e despacho) | Casos aguardando conferência, despachos pendentes, tarefas que estouraram o limite de cobrança, estudos de caso | Aprova o caso antes do INSS, despacha o que falta depois do indeferimento, decide o que escalou | Valores (vê o resto do Jurídico) |
| **Jurídico administrativo** (estagiário ou assistente jurídico) | JURÍDICO (protocolo, no D2) e JURÍDICO (ADMINISTRATIVO), no DP | Casos liberados para protocolo no Meu INSS; perícias a marcar, orientar e conferir | Protocola no Meu INSS (D2.02). Na perícia: marca no portal do INSS e sobe o comprovante em PDF (DP.02), decide se ela pede documento novo e atribui à Documentação, liga e orienta o cliente (DP.06), registra o comparecimento e remarca se ele faltar (DP.07); passou do limite de remarcações, sobe para a advogada (G15) | Valores, configuração |
| **Financeiro** | FINANCEIRO | Todo o financeiro do escritório: prestações de contas recebidas, recebido, a receber e lançamentos | Recebe e lança a prestação de contas; cuida do financeiro do escritório | Entrevista, petição, laudos |
| **Cliente ou lead** | CLIENTE / LEAD (D1) e CLIENTE nos outros diagramas, raias externas | Fora do portal: a ficha de atendimento, o link de assinatura e as mensagens | Preenche a ficha, assina, envia documentos e laudo novo, confirma presença e comparece à perícia | Qualquer tela interna |
| **Gestão do escritório** (proposto, não está no BPMN) | nenhuma | Configurações | Mantém kits por benefício, modelos, limites de cobrança, mensagens padrão e perfis | (conforme o papel) |
| **Sócio** (proposto, não está no BPMN) | nenhuma | Painel de resultado (GGVP-75) | Acompanha deferimento, procedência, extinções sem mérito e rendimento, só em totais do escritório | Valor ou dado de saúde de cliente individual |

**Valores e financeiro** (Pedro, 06/10): o financeiro do escritório é todo do Financeiro. Ninguém mais vê valores, com três exceções: a advogada responsável vê os valores só na prestação de contas que ela faz; o Sócio vê só totais do escritório; o percentual de honorários aparece no contrato que o Atendimento confere e o cliente assina. O valor da causa e a renda per capita do LOAS não são financeiro do escritório: são dado jurídico e continuam visíveis para a advogada (Pedro, 07/10).

**Sistema** e **IA** também são raias, mas não são perfis de pessoa. Tudo o que fazem aparece para as pessoas como sugestão, tarefa ou registro no histórico do card. Exemplo: o sistema abre sozinho a tarefa de perícia (DP.01) quando a perícia é pedida.

Ajuste de 29/09/2026 (Lucas): a perícia saiu do Atendimento e ficou toda com o Jurídico administrativo (DP.02, DP.06, DP.07 e a remarcação); o DP.01 passou a ser do sistema; o Atendimento ficou com o laudo novo (buscar e subir, D1.02).

---
