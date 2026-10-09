# Revisão do portal GGV Prev · 08/10

08/10/2026 · Mateus

## Como foi feita

Achei 6 erros graves no `main` que vai para a homologação: 2 deixam pular portões (G1, G3), 1 mexe no dinheiro do cliente e 3 são telas que um perfil abre sem poder. A API está bem trancada; o furo está nas telas e em duas travas do servidor.

- **Versão testada:** `main` em 6ed2e01, a mesma imagem que está no ar em ggvprev.mapech.com.br (`/saude` respondeu banco ligado).
- **Onde:** portal local (API e telas), banco em memória com a semente de exemplo e a IA ligada. Os usuários são os de exemplo (`atendimento@exemplo.ggv`, `advogada@`, `senior@`, `juridico@`, `documentacao@`, `financeiro@`, `socio@`, `lider@`).
- **Base:** BPMN lido no Miro (D1, D2, D3, D3a, D3b, D4, DP; o D5 não tem frame), as 147 histórias do Jira, `perfis.md`, os portões G1 a G22 e o roteiro de 09/10 (P1 a P21).
- **Como:** entrei com cada perfil, abri cada tarefa da Central, digitei endereços de telas de outros perfis e chamei a API direto com cada perfil nas rotas de valores, saúde e petição.
- **Fora desta passada:** a homologação com login (as senhas são só do Lucas), gravação de áudio, qualidade do texto da IA e celular.

Para reproduzir cada erro, use o mesmo `main` local (`pnpm dev`) ou a homologação com o perfil indicado. Os testes de dinheiro e de aprovação gravam: faça no local, não na homologação do Lucas.

## Erros graves

Os seis travam a homologação: furam um portão, mexem no dinheiro do cliente ou deixam um perfil decidir o que não é dele.

| # | Com qual acesso | O que acontece | Como reproduzir | Portão / história |
| --- | --- | --- | --- | --- |
| E1 | Sênior | Aprova para o INSS caso com "Kit assinado: não", ficha não preenchida e checklist não conferido. A tarefa "Protocolar no Meu INSS" nasce na hora. | Central → "Antônia Lima · Conferir antes do INSS" → "Aprovar". A tela já mostra as três faltas. Causa: `rotas/conferencia.ts` só checa o kit se ele estiver cadastrado, e só 2 de 12 benefícios têm kit (os LOAS). Nos outros 10, o G1 não roda. O contrato assinado nunca é checado aqui. | G1, G2 · GGVP-23, GGVP-91, GGVP-109 |
| E2 | Advogada | Grava a prestação de contas com percentual diferente do contrato. Com 100% no lugar de 30%, os honorários ficam R$ 12.345,67 e o repasse ao cliente, R$ 0,00. Sem aviso. | "Vera Lúcia · Prestar contas" → troque "Honorários do contrato (%)" de 30,00 para 100 → valor 12.345,67, prazo, "Conferi" → "Concluir". O Financeiro vê "Honorários (100,00%)" sem o percentual do contrato ao lado. O servidor aceita de 0 a 100 e não compara. | GGVP-44, GGVP-98 |
| E3 | Atendimento | Define o benefício do cliente, decisão que é só da advogada, e antes da entrevista acontecer. | Endereço `/entrevista/josefa-entrevista/beneficio` → "Outro benefício" → LOAS Idoso → marque a conferência → "Confirmar benefício". Sai "✓ Benefício definido". O próprio fluxo da entrevista só libera esse botão ao encerrar; o endereço direto pula. | G3 · GGVP-51, GGVP-135 |
| E4 | Atendimento | Abre a gravação da entrevista (Jurídico) com o botão "Gravar" ativo, e também o cálculo de tempo e pontos. O topo mostra "Início" levando à Central da advogada. | `/entrevista/josefa-entrevista/gravacao` e `/entrevista/josefa-entrevista/calculo`. Causa: cerca de 55 telas de passo (Recepção, Abertura, Perícia, documentação médica) não conferem o perfil no `App.tsx`. Algumas se protegem por dentro (parecer, laudo novo, dispensa, liberar); estas não. O PR #14 corrige. | GGVP-135, GGVP-96 |
| E5 | Advogada | Aprova o resumo do resultado com o marcador "[completar: o motivo da decisão]" no texto. Ele segue ao Atendimento para ler ao cliente. O rascunho também diz "indeferido" num caso de improcedência na Justiça. | "Paulo Mendes · Aprovar o resumo para o cliente" → não mexa no texto → "O Atendimento, no padrão" → "Aprovar o resumo". Sai "Resumo aprovado". | GGVP-22, G8 |
| E6 | Jurídico administrativo e Atendimento | Tarefas que nascem no servidor abrem "Esta tela ainda não foi construída". | Advogada decide a perícia da Antônia → Jurídico adm. → "Marcar perícia médica" (vai a `/tarefas/<id>`). Sênior reprova o Benedito → Atendimento → "Ajustar o caso" (idem). Continua depois do PR da Perícia no servidor. | P1, P2 · GGVP-49, GGVP-127, GGVP-137 |

## Erros médios e leves

| # | Com qual acesso | O que acontece | Onde ver | História |
| --- | --- | --- | --- | --- |
| M1 | Todos | Datas depois das 21h de Brasília aparecem com o dia seguinte (a data é cortada em UTC). | Conclua uma prestação à noite: "concluída em 09/10" com o relógio em 08/10 22:33. Mesmo padrão em petição, despacho, manifestação, página do caso, transcrições e dados bancários (`iso.slice(0, 10)`). | GGVP-44, 63, 87 |
| M2 | Documentação | Cai na "Início do Atendimento", com as 16 tarefas do Atendimento (preparar contrato, colher assinatura, confirmar agendamento). | Entre como Documentação. | GGVP-130, GGVP-78 |
| M3 | Atendimento | Recebe "Liberar ao Jurídico" como urgente, mas só pode ver (pelo BPMN, o OK é da Documentação). Tarefa que a pessoa não pode fazer, na fila dela. | Central → "Sebastião · Liberar ao Jurídico". | GGVP-18 |
| M4 | Atendimento | Ficha de cliente do servidor abre vazia ("Nenhum documento recebido", sem CPF), enquanto a conferência da Sênior lista RG, CPF, procuração e contrato do mesmo cliente. | Central → nome "Benedito Alves". | GGVP-125, GGVP-86 |
| M5 | Advogada | Na prestação, o texto diz "o Atendimento agenda a ida ao banco"; desde a GGVP-98 quem marca é o Financeiro. | Tela "Prestar contas", rodapé. | GGVP-98 |
| M6 | Sócio | Vê "Honorários recebidos: R$ 4.500,00 · 1 recebimento": com um só, o total é o valor de um cliente. | Topo → Resultados. | GGVP-75 |
| M7 | Sócio, Sênior | No Raio-X, porcentagens sem o próprio número de casos ("Laudo médico favorável: 44%", "Êxito por safra: 9% → 25% → 36%"). O G22 pede "71% em 34 laudos". | Topo → Resultados → Raio-X. | G22 · GGVP-75 |
| M8 | Todos com Central | A aba "Tarefas do setor (9)" mostra uma contagem e abre "tela ainda não construída". | Central → aba. | P6 · GGVP-147 |
| M9 | Advogada | "Decidir perícia" não mostra a recomendação sobre a perícia que entrou no 136b346. | Antônia → "Precisa de perícia?". | GGVP-38 |
| L1 | Sênior, Jurídico adm. | Benefício aparece como código: "pensao morte", "auxilio acidente", "bpc loas idoso". | Central da Sênior. | GGVP-78 |
| L2 | Sênior | Caso de Pensão por Morte com parecer médico "natureza do impedimento" (conceito do LOAS): semente incoerente, e a IA usa isso nos fatores. | Antônia → Conferência. | GGVP-126 |
| L3 | Atendimento | O chat, perguntado sobre o laudo e o CID da Rita, não vaza nada, mas também não diz que é fora do perfil: responde a fase do caso. | Chat da Central. | GGVP-82 |

## Roteiro de 09/10: o que continua

Dos 21 problemas do roteiro (P1 a P21), conferi 11 no `main` atual: 7 continuam e 4 foram resolvidos pela IA ligada. Os outros 10 não conferi nesta passada.

| Problema | Situação no `main` | O que vi |
| --- | --- | --- |
| P1 Marcar perícia do servidor | Continua | `/tarefas/<id>` → tela não construída (E6) |
| P2 Ajustar o caso devolvido | Continua | Idem (E6) |
| P4 Quatro tarefas de exemplo | Continua | `/tarefas/t5`, `t9`, `t12`, `t13` → tela não construída |
| P5 Prestação: dar o OK | Continua | `/tarefas/a5` na Central da advogada |
| P6 Tarefas do setor | Continua | M8 |
| P7 Resultado da perícia | Continua | "Ainda não há resultado" |
| P8 Análise da IA no despacho | Resolvido com a chave | IA ligada no `main` |
| P9 Petição vazia | Resolvido com a chave | Idem; não percorri a petição |
| P10 Resumo vazio | Resolvido, com novo erro | O rascunho vem, mas aprova com "[completar]" (E5) |
| P11 Sênior sem chat | Resolvido para a Sênior | Financeiro e Sócio não conferidos |
| P16 Kit com códigos | Continua parecido | L1, agora também na Central |
| P17 Feriados | Não conferido | |

Antes do teste do Lucas, vale avisar que E1 a E5 não estão na lista dele: são novos.

## PRs abertos

Nenhum dos 9 PRs abertos está pronto para entrar sem ajuste: 4 têm a varredura de segredos vermelha, 2 falham no mesmo teste de tela e 5 disputam números de migração ou a versão 19 da matriz. Nenhum tem revisão aprovada.

| PR | Tamanho | CI | Conflito | Risco principal |
| --- | --- | --- | --- | --- |
| #14 Perfil por tela e entrevista na hora | +273 | Tela falha (4 testes) | Não | Corrige E4; os 4 testes que falham: sessão expirada, compromisso interno, cobrança escura, laudo da Lúcia |
| #13 Glossário, transcrição e IA no Relacionamento | +17.701 | Tela falha (laudo da Lúcia) | Não | Cria a migração 0020 e sobe a matriz para 19, igual ao #2 |
| #2 Recepção no servidor (3b a 4b) | +14.554 | Sem CI | Sim | Migrações 0020 e 0021 iguais às do #11; matriz 19 igual ao #13; tarefa do cálculo no setor Atendimento, o #14 manda ao Jurídico |
| #11 Jurimetria parte 2 (rascunho) | +12.922 | Verde | Não | Migrações 0020 e 0021 iguais às do #2 |
| #7 Motor de fluxo (rascunho) | +5.975 | Sem CI | Sim | Migração 0018 já existe no `main` |
| #3 Google Drive (rascunho) | +6.563 | Typecheck e segredos falham | Sim | Migração 0018 já existe no `main` |
| #1 AASP e DJEN | +718 | Segredos falha | Não | Precisa do `main` (correção do gitleaks do #12) |
| #5 Desfecho e financeiro | +59 | Segredos falha | Não | Idem; não trata o E2 |
| #4 Identificadores (rascunho) | +228 | Segredos falha | Não | Idem |

Ordem que evita retrabalho: #14 primeiro (fecha E4, pequeno), depois decidir quem fica com 0020/0021 e a matriz 19 entre #2, #11 e #13 antes de mesclar qualquer um deles. O teste "o laudo da Lúcia" falha em dois PRs com 1,5 min: ou é instável, ou quebrou com o `main` novo.

## BPMN, Jira e portal fora de linha

Cinco pontos em que o desenho do Miro, a história e o portal dizem coisas diferentes; cada um pede uma decisão do Lucas e a correção no Miro.

- **D1.13 Calcular tempo e pontos:** no Miro está na raia do Atendimento; a GGVP-57 e o PR #14 dão à advogada (decisão do Pedro em 08/10). A tela diz "Advogado do atendimento". O Miro precisa ser corrigido.
- **D1.12 depois de D1.09:** o BPMN põe a entrevista gravada e a transcrição antes de definir o benefício; o portal deixa definir antes (E3).
- **D2.01 e G1:** o BPMN diz que nada vai ao INSS sem checklist completo; o portal só cobra isso nos 2 benefícios com kit (E1). Faltam os kits dos outros 10 na configuração.
- **D1.24:** "o botão OK é da Documentação", mas a Documentação não tem Central própria e a tarefa aparece para o Atendimento (M2, M3).
- **D5:** não tem frame no board; os passos D5.01 a D5.05 vivem só em `docs/bpmn/D5.md`.

## O que está bem

- **A API segura cada perfil.** Chamando o servidor direto, Atendimento, Sênior e Sócio levam 403 na prestação e na ida ao banco; o Sócio leva 403 no despacho e na vigília. Toda tentativa fica no histórico como "ação fora do perfil".
- **Dado de saúde:** parecer, laudo novo, linha da deficiência e resultado da perícia mostram ao Atendimento só a situação, nunca o conteúdo clínico.
- **Portões que funcionam:** dispensa do parecer só para a Sênior (G17), liberar só para a Documentação, recusa da Sênior exige motivo, vigília avisa rodada perdida em vez de dia sem publicação (G13).
- **Resultados:** os indicadores do portal trazem o número de casos e a data da base (G22).
- **CI do `main`** verde, homologação no ar com o banco ligado.
