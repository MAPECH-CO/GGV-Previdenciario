# Conferência dos critérios de aceite (GGVP-145)

Feita em 08/10/2026, à noite, sobre a `main` com a IA jurídica (PR #26) e o deploy da homologação (PR #20). O bloco 3b da
Recepção no servidor (PR #32) estava aberto e não conta aqui.

**O que foi conferido:** as 102 histórias do projeto GGVP em "Em homologação" no Jira na hora da conferência. Nenhuma estava
em "Em análise". Os épicos (GGVP-1, 3, 5 a 9, 11, 13 a 15) ficaram de fora: eles só agrupam as histórias.

**Como:** para cada história, os critérios de aceite do cartão no Jira, com as respostas do Lucas nos comentários (a spec
de cada história em `openspec/changes/` repete os critérios e as respostas), e, no código e nos testes, onde cada critério
está feito. Os testes citam a história e o critério no título ("CA3 · ..."). As linhas citadas são da `main` desta noite.

**Dado de saúde (regra do Pedro, 08/10):** dado de saúde é só o conteúdo médico (laudo, CID, diagnóstico, parecer médico e o
texto dos documentos médicos), e só o Jurídico vê. Status, datas, etapas e o que a pessoa registrou o Atendimento e a
Documentação veem normalmente. A falta de filtro por frase ou palavra de saúde não é lacuna: saiu de propósito.

## Como ler

| Situação | O que quer dizer |
|---|---|
| feito | está no servidor de verdade (ou é regra em código, sem dado guardado), com o arquivo e o teste que provam |
| feito só no servidor de exemplo | funciona na tela, mas grava no navegador (some ao fechar a aba); a história que liga no servidor vem junto |
| parcial | parte está feita; a tabela diz o que falta |
| faltando | não está feito |
| faltando (fora de 09/10 pela spec) | a própria spec da história deixou para depois (chat com ação, ZapSign real, v2); não entra nas lacunas |
| removido | o Lucas tirou o critério do cartão |

Nas tabelas, os caminhos curtos são relativos a `apps/web/src/` (`dados/`, `regras/`, `paginas/`, `componentes/`),
`apps/web/e2e/`, `apps/api/src/` (`rotas/`, `fluxo/`, `banco/`, `ia/`, `vigilia/`, `sessao/`) e `packages/`. Os "P" são os
problemas do roteiro do teste (`docs/entrega/roteiro-do-teste-09-10.md`).

## Resumo

930 critérios em 102 histórias:

| Situação | Critérios |
|---|---|
| feito | 462 |
| feito só no servidor de exemplo | 363 |
| parcial | 49 |
| faltando | 29 |
| faltando (fora de 09/10 pela spec) | 25 |
| removido | 2 |

Por épico (feito · só no exemplo · parcial · faltando):

| Épico | Dono | Histórias | feito | exemplo | parcial | faltando |
|---|---|---|---|---|---|---|
| Recepção e entrevista | Pedro | 16 | 76 | 87 | 3 | 0 |
| Abertura e documentação | Pedro | 12 | 9 | 86 | 7 | 3 |
| Documentação médica | Pedro | 8 | 2 | 40 | 1 | 0 |
| Via administrativa no INSS | Mateus | 7 | 58 | 0 | 3 | 0 |
| Perícia | Pedro | 8 | 0 | 61 | 4 | 0 |
| Judicialização e vigília | Mateus | 14 | 144 | 0 | 3 | 2 |
| Desfecho e financeiro | Mateus | 4 | 18 | 0 | 1 | 8 |
| Relacionamento com o cliente | Pedro | 6 | 2 | 47 | 1 | 0 |
| Experiência por perfil e chat | Pedro | 3 | 4 | 24 | 7 | 2 |
| Fundação técnica | Mateus | 7 | 47 | 0 | 4 | 0 |
| Garantia e governança | Mateus | 7 | 63 | 1 | 5 | 0 |
| IA jurídica | Mateus | 5 | 24 | 5 | 6 | 5 |
| Jurimetria | Mateus | 5 | 15 | 12 | 4 | 9 |

O retrato em uma frase: o que é do Mateus está no servidor, com poucas pontas; o que é do Pedro funciona na tela, mas quase
tudo ainda grava no navegador, e a ligação no servidor é a próxima leva (GGVP-125, 132, 137, 138).

## Lacunas, das mais graves para as mais leves

Quem faz segue o dono do épico (Pedro: Recepção, Abertura, documentação médica, Perícia, Relacionamento, Experiência;
Mateus: Fundação, INSS, Garantia, Justiça, Desfecho, IA, Jurimetria). Tamanho: pequeno, algumas horas; médio, um a dois
dias; grande, mais que isso.

### Graves: a história não está entregue, ou o fluxo para no meio

| # | Lacuna | Histórias (critérios) | Quem faz | Tamanho |
|---|---|---|---|---|
| 1 | Quatro histórias estão em "Em homologação" sem ter sido entregues. "Decidir se recorre" não tem código nenhum (e tem a dúvida Q26 aberta). "Medir ganho e perda" a change da IA deixou para depois. "Perito nomeado" e "Juízo identificado" a change da Jurimetria marcou como travadas; só existe a versão do servidor de exemplo, nas telas do Pedro | GGVP-100 (CA1 a CA8), GGVP-41 (CA4, CA11 e parciais), GGVP-59 (CA1), GGVP-64 (CA3) | Mateus | grande |
| 2 | A causa do item 1: a automação do Jira (`.github/workflows/jira.yml`) põe em "Em homologação" toda chave citada em qualquer commit de um PR mesclado, até em "a GGVP-41 fica para depois" | processo (sem história) | Mateus | pequeno |
| 3 | A tarefa "Marcar perícia" que o servidor abre (pela decisão da advogada, pela exigência do INSS ou pelo despacho) abre "tela não construída", e o resultado registrado na tela da perícia não volta ao servidor | GGVP-49 (CA1, CA2), GGVP-31 (CA7), GGVP-70 (CA6), GGVP-83 (CA2); P1 e P18 | Pedro (ligação GGVP-137) | grande |
| 4 | O caso que a Documentação libera não chega à fila da Sênior no servidor: Recepção e Abertura ainda gravam metade no navegador, e o teste de tela do servidor para na entrevista | GGVP-125 (CA1, CA2, CA3, CA5, CA6), GGVP-104 (CA7), GGVP-109 (CA2) | Pedro (épico Abertura; o cartão GGVP-125 está com o Mateus; o bloco 3b está no PR #32) | grande |
| 5 | Duas tarefas do servidor abrem "tela não construída": "Ajustar o caso", depois que a Sênior reprova, e "Levar ao banco", do Atendimento | GGVP-23 (CA3), GGVP-44 (CA10), GGVP-98 (CA6); P2 e P3 | Mateus | médio |
| 6 | A homologação: o deploy automático entrou nesta noite, mas a tarefa "ligar a homologação antes de 09/10" segue aberta na lista do épico. Confirmar hoje que o endereço abre, com os dados de teste (o teste de amanhã é lá) | GGVP-119 (CA1, CA2), GGVP-126 (CA3) | Mateus | pequeno |
| 7 | "Tarefas do setor" não existe: o líder não vê nem distribui as tarefas, e a atribuição não chega ao histórico | GGVP-78 (CA12), GGVP-99 (CA5, fora pela spec); P6 | Pedro | médio |

### Médias: segue, mas falta algo que o critério pede

| # | Lacuna | Histórias (critérios) | Quem faz | Tamanho |
|---|---|---|---|---|
| 8 | A chave da IA na homologação: sem ela, a análise do indeferimento, a versão 1 da petição e o rascunho do resumo não aparecem (P8, P9, P10). Confirmar que está configurada | GGVP-54, GGVP-63, GGVP-22 | Mateus | pequeno |
| 9 | Feriados e suspensões não cadastrados: o prazo só pula fim de semana | GGVP-34 (CA9); P17 | Mateus (com a GGVP-146, parte 3) | médio |
| 10 | Pedir a petição não confere o parecer médico no servidor. Por caminho o caso já passou pela conferência da Sênior; a spec deixou o bloqueio no botão para a v2, mas um laudo novo ou uma contradição depois disso não trava | GGVP-33 (CA1), GGVP-63 (CA5) | Mateus | pequeno |
| 11 | A jurimetria de perito e de juízo não existe no servidor: a recomendação da perícia, o pedido da petição e a orientação da perícia saem sem ela ou com a do servidor de exemplo | GGVP-38 (CA2, CA6, CA7), GGVP-63 (CA7, CA8), GGVP-61 (CA3), GGVP-70 (CA8), GGVP-131 (CA8) | Mateus (depende do item 1) | grande |
| 12 | O acervo não se alimenta sozinho (vigília, documentos, Drive), não importa a base histórica e não guarda matéria, vara, tese e lição | GGVP-41 (CA1, CA3, CA4, CA6, CA11), GGVP-55 (CA1, CA2, CA6), GGVP-131 (CA1) | Mateus (com a GGVP-146, parte 2) | grande |
| 13 | A chance de êxito só aparece na conferência da Sênior: falta na entrevista, com as cores e a sugestão abaixo de 15%, e na decisão de recorrer | GGVP-131 (CA3, CA4, CA6) | Mateus | médio |
| 14 | A busca da tela inicial não consulta nada | GGVP-78 (CA9) | Pedro | médio |
| 15 | Sênior, Financeiro e Sócio ficam na Central provisória: sem chat, sem busca e sem o atalho na fila vazia | GGVP-78 (CA4, CA6), GGVP-82 (CA6); P11 | Pedro | médio |
| 16 | Tarefas de exemplo que abrem "tela não construída" (Marta, Antônio, Pedro, Lúcia) | GGVP-78 (CA3); P4 | Pedro | pequeno |
| 17 | As regras numéricas das telas médicas (24 meses, 15 dias, PCD) são calculadas no navegador, não pela rota do servidor | GGVP-25 (CA7) | Pedro (ligação GGVP-132) | médio |
| 18 | Kit e checklist da Abertura não usam a Configuração do escritório do servidor, e o item "Parecer médico" não aparece no checklist | GGVP-65 (CA7), GGVP-91 (CA4, CA10) | Pedro | médio |
| 19 | O pedido de complemento ao médico não nasce de uma exigência ou manifestação do juiz, como o Lucas respondeu (Q1) | GGVP-29 | Pedro (ligação GGVP-132) | médio |
| 20 | Nova demanda: a IA da entrevista não separa o processo novo nem marca o dado mudado como sugestão | GGVP-124 (CA6) | Pedro | médio |
| 21 | Os casos de exemplo das telas do Pedro não entram no banco da homologação | GGVP-126 (CA3) | Mateus (depois das ligações) | médio |
| 22 | Falta o teste que procura a senha de teste em PDF, log, exportação e transcrição | GGVP-24 (CA9) | Pedro | pequeno |
| 23 | Exigência do juiz: falta a espera "esperando o cliente", que retoma quando ele responde | GGVP-83 (CA7) | Mateus | pequeno |
| 24 | O histórico do caso não mostra a sugestão da IA recusada (a chamada fica guardada, mas não aparece na linha do processo) | GGVP-99 (CA2) | Mateus | pequeno |
| 25 | A auditoria das chamadas à IA do caso mostra as fontes com o trecho a qualquer perfil que vê o caso; a saída fica só para o Jurídico, mas o trecho das fontes do acervo (decisões de outros casos, só sem nome e e-mail) pode trazer conteúdo médico ao Atendimento, e essa leitura não é registrada. Achado da revisão automática de segurança, conferido no código, sem teste que prove a exposição | GGVP-106 (CA4), GGVP-96 (CA12) | Mateus | pequeno |

### Leves: detalhe, teste ou texto

| # | Lacuna | Histórias (critérios) | Quem faz | Tamanho |
|---|---|---|---|---|
| 26 | A ordem da fila não tem teste, e as tarefas que vencem hoje não vêm separadas logo depois das vencidas | GGVP-78 (CA2, CA8) | Pedro | pequeno |
| 27 | O chat lista só as perícias do servidor de exemplo | GGVP-82 (CA11); P18 | Pedro | pequeno |
| 28 | Na ligação da perícia, a verificação de identidade é só um lembrete na tela, sem registro nem teste | GGVP-111 (CA6) | Pedro | pequeno |
| 29 | O telefone da ficha é conferido por regra local, não por ferramenta de validação | GGVP-24 (CA12) | Pedro | pequeno |
| 30 | O `.env.example` sem senha que a doc da homologação promete não existe; e a doc diz que os usuários de exemplo não vão para o banco da homologação, o contrário do preparo dos dados de teste | GGVP-119 (CA3), GGVP-126 | Mateus | pequeno |
| 31 | A Sênior só chega ao "Dispensar o parecer" da tela de exemplo pelo endereço | GGVP-33 (CA2); P12 | Pedro | pequeno |

ZapSign real (o identificador do modelo e a consulta periódica do retorno, GGVP-69 CA10 e GGVP-72 CA8) ficou fora de 09/10,
sem história. Os 25 critérios "fora de 09/10 pela spec" são, na maioria, o chat com ação (GGVP-45, 55, 63, 87, 99, 106, 109
e 110), os modelos de contrato no servidor (GGVP-104) e a v2 da petição (GGVP-63).

## O que ainda grava no navegador, e a história que liga no servidor

| O quê | Onde está hoje | História que liga |
|---|---|---|
| Recepção depois da entrevista (benefício, cálculo, cadastro, fechamento, nova demanda, segunda ficha) | servidor de exemplo | GGVP-125, bloco 3b (PR #32, aberto) |
| Abertura (contrato, assinatura, documentos, checklist, cobrança, boas-vindas, liberação) | servidor de exemplo | GGVP-125, próximos blocos |
| Documentação médica (parecer, laudo novo, complemento, dispensa, roteiro, leitura dos documentos médicos) | servidor de exemplo; IA simulada | GGVP-132; IA GGVP-134 |
| Perícia (marcar, reunir, orientar, comparecimento, resultado, perfil do perito) | servidor de exemplo; IA simulada | GGVP-137; IA GGVP-139 |
| Relacionamento (conversa, transcrição, conferência, pendência, mensagens, segurança) | servidor de exemplo; IA e transcrição simuladas | GGVP-138; IA GGVP-140; transcrição GGVP-133 |
| Chat do portal | motor do navegador | GGVP-142; acervo GGVP-141 e GGVP-131 |
| Página do caso | servidor de exemplo | GGVP-146, parte 5 |
| Senha do gov.br nas telas da Recepção | descartada no navegador (nunca guardada) | GGVP-146, parte 1 |
| Chatwoot | de verdade no servidor quando o ambiente tem as variáveis `CHATWOOT_*` (senão simulado), só no que passa pelo correio do servidor: a janela "Mensagem ao cliente", a janela do Chatwoot (convite, confirmação, cobrança, complemento, perícia) quando o cliente é do banco, e o aviso de mudança dos dados bancários. As boas-vindas do checklist e o contrato por WhatsApp seguem simulados no servidor de exemplo | GGVP-146, parte 4 (PR #19); boas-vindas e contrato com a Abertura no servidor (GGVP-125, próximos blocos), pelo correio do cliente (`criarCorreio`) |
| Drive (pasta do cliente, original guardado) | simulado | GGVP-107 |
| ZapSign | simulado | fora de 09/10, sem história |

---

## Recepção e entrevista (GGVP-6) · dono: Pedro

Modo misto desde 08/10 (GGVP-125, blocos 1, 2 e 3a): o lead novo do balcão, a ficha, a agenda, a confirmação, as tarefas da
Recepção e a entrevista gravada gravam no servidor. As pessoas da semente e as telas seguintes (benefício, cálculo,
cadastro do lead, fechamento, nova demanda, segunda ficha) ainda usam o servidor de exemplo do navegador; ligam nos
próximos blocos da GGVP-125. O bloco 3b (cadastro, benefício, cálculo, fechamento, nova demanda e o cofre de verdade para
as fichas do servidor) está no PR #32, aberto e ainda fora da `main`: esta conferência não o conta.

### GGVP-16 · Reconhecer quem chegou e para quê

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | busca no servidor `apps/api/src/rotas/recepcao.ts` (`POST /api/balcao/busca`); `recepcao.test.ts:49` e `:92`; regra `apps/web/src/regras/regras.test.ts:150` (CA1) |
| 2 | feito | agendamento e ficha na busca: `regras.test.ts:163` (CA2); cópia com a agenda: `servidorLigado.test.ts:101` |
| 3 | feito | `POST /api/fichas`; `regras.test.ts:345` e `:353` (CA3); `e2e/recepcao.e2e.ts:30` |
| 4 | feito | `POST /api/fichas/:id/encaminhamentos`; `recepcao-agenda.test.ts:113`; `e2e/recepcao.e2e.ts:62` |
| 5 | feito | `regras.test.ts:157` (CA5); `recepcao.test.ts:49` (acha pelo telefone) |
| 6 | feito | `recepcao.test.ts:72` (servidor); `e2e/recepcao.e2e.ts:52`; `regras.test.ts:184` |
| 7 | feito | `e2e/recepcao.e2e.ts:62` ("Encaminhar" desligado sem setor) |
| 8 | feito | `e2e/recepcao.e2e.ts:62` (histórico com quem, quando e o setor) |
| 9 | feito | `recepcao.test.ts:78` (servidor: só com "É outra pessoa"); `regras.test.ts:190` |
| 10 | feito | `regras.test.ts:134` e `:143` (CA10); `recepcao.test.ts:49` |
| 11 | feito | tela `paginas/NovoCliente.tsx`; `e2e/recepcao.e2e.ts:30` ("Salvar apenas"); "Salvar e marcar a entrevista" conferido na passada de 08/10 (roteiro AT1) |
| 12 | feito | `regras.test.ts:325` (CA12, indicação pede o nome) |
| 13 | feito | `e2e/recepcao.e2e.ts:30` (CA13, "Últimos contatos"); a anotação aparece na preparação da advogada (`e2e/preparar-entrevista.e2e.ts`, CA5) |
| 14 | feito só no servidor de exemplo | a pasta do Drive é simulada: `regras.test.ts:204` e `:208`, `servidorLigado.test.ts:85` ("a pasta do Drive ainda é a de exemplo"); o Drive de verdade é a GGVP-107, fora de 09/10 |
| 15 | feito | `regras.test.ts:288`, `:296`, `:303`, `:359` (CA15); servidor recusa data inválida: `recepcao.test.ts:109`; `e2e/recepcao.e2e.ts:83` |
| 16 | feito | `e2e/recepcao.e2e.ts:30` (duplo clique grava uma ficha só) |
| 17 | feito só no servidor de exemplo | "Nova demanda" no balcão leva à GGVP-124 (`e2e/nova-demanda.e2e.ts:50`); a nova demanda ainda não grava no servidor (próximos blocos da GGVP-125) |

### GGVP-17 · Receber documento entregue no balcão

Tudo no servidor de exemplo do navegador; o scanner e o Drive são simulados. Ligação: GGVP-125 (bloco de documentos),
GGVP-107 (Drive) e, no laudo novo, GGVP-132 e GGVP-134.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `paginas/Balcao.test.tsx:132`; `e2e/receber-documento.e2e.ts:26`; para o lead do servidor, o encaminhamento grava lá (`recepcao-agenda.test.ts:113`) |
| 2 | feito só no servidor de exemplo | scanner simulado (`e2e/receber-documento.e2e.ts:26`); o PDF na pasta do Drive é a GGVP-107 |
| 3 | feito só no servidor de exemplo | `e2e/receber-documento.e2e.ts:26` (caso em fase judicial); GGVP-125 |
| 4 | feito só no servidor de exemplo | `e2e/receber-documento.e2e.ts:46` ("A REVISAR"); GGVP-107 |
| 5 | feito só no servidor de exemplo | `e2e/receber-documento.e2e.ts:26` ("Registrar" só depois das conferências); GGVP-125 |
| 6 | feito só no servidor de exemplo | `paginas/FichaCliente.test.tsx:174`; `e2e/receber-documento.e2e.ts:54`; GGVP-132 |
| 7 | feito só no servidor de exemplo | a IA é simulada; `e2e/parecer.e2e.ts` (GGVP-20 CA6 e CA7, "Analisar laudo novo"); GGVP-132 e GGVP-134 |
| 8 | feito só no servidor de exemplo | `e2e/receber-documento.e2e.ts:70`; `regras.test.ts:402` e `:407`; o chat ainda não fala com o servidor (GGVP-142) |
| 9 | feito só no servidor de exemplo | `paginas/FichaCliente.test.tsx:174`; GGVP-132 |
| 10 | feito só no servidor de exemplo | `e2e/receber-documento.e2e.ts:26` (papel ou digital, "CONFERIR O PAPEL"); GGVP-125 |
| 11 | feito só no servidor de exemplo | `regras.test.ts:204`, `:208` e `:213`; GGVP-107 |
| 12 | feito só no servidor de exemplo | `regras.test.ts:225` e `:236`; `paginas/FichaCliente.test.tsx:194`; GGVP-107 |
| 13 | feito só no servidor de exemplo | `regras.test.ts:267` e `:273`; `e2e/receber-documento.e2e.ts:54`; GGVP-107 |
| 14 | feito só no servidor de exemplo | `regras.test.ts:280`; `paginas/FichaCliente.test.tsx:174` e `:194`; GGVP-107 |
| 15 | feito só no servidor de exemplo | `paginas/CentralAtendimento.test.tsx:28`; `paginas/FichaCliente.test.tsx:208`; GGVP-125 |

### GGVP-21 · Confirmar o agendamento do lead

Para o lead do balcão, a confirmação grava no servidor (GGVP-125, bloco 2). O Chatwoot é simulado até a GGVP-146 (parte 4).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito (Chatwoot simulado) | `paginas/ConfirmarAgendamento.test.tsx:24` e `:40`; `e2e/confirmar-agendamento.e2e.ts:33`; mensagem no servidor: `POST /api/agendamentos/:id/confirmacao/mensagem` |
| 2 | feito | `recepcao-agenda.test.ts:73`; `ConfirmarAgendamento.test.tsx:52`; `e2e/confirmar-agendamento.e2e.ts:44` |
| 3 | feito | `recepcao-agenda.test.ts:73`; `ConfirmarAgendamento.test.tsx:67`; `e2e/recepcao-servidor.e2e.ts:34` |
| 4 | feito | `ConfirmarAgendamento.test.tsx:24` |
| 5 | feito | `ConfirmarAgendamento.test.tsx:52`; `e2e/confirmar-agendamento.e2e.ts:18` |
| 6 | feito | servidor: `recepcao-agenda.test.ts:94` (G15); `regras.test.ts:514`; `ConfirmarAgendamento.test.tsx:77` e `:87`; `e2e/confirmar-agendamento.e2e.ts:55` |
| 7 | feito | `ConfirmarAgendamento.test.tsx:52`; `e2e/confirmar-agendamento.e2e.ts:44` |
| 8 | feito | `regras.test.ts:523` e `:535`; `e2e/confirmar-agendamento.e2e.ts:33` |

### GGVP-24 · Preencher a ficha de atendimento

A ficha grava no servidor (GGVP-125, bloco 1). A senha digitada vai a um cofre simulado, que descarta o valor
(`apps/web/src/dados/cofre.ts`); o cofre de verdade na Recepção é a GGVP-146 (parte 1).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `paginas/FichaAtendimento.test.tsx:103`; `e2e/ficha-de-atendimento.e2e.ts:54` (o tablet ainda não chegou ao escritório) |
| 2 | feito só no servidor de exemplo | cofre simulado (`dados/cofre.ts`); `FichaAtendimento.test.tsx:75`; `e2e/ficha-de-atendimento.e2e.ts:33`; GGVP-146 parte 1 |
| 3 | feito | `regras.test.ts:593` (CA6 e CA11, pode ficar em branco); alerta de senha na preparação: `e2e/preparar-entrevista.e2e.ts` (CA2) |
| 4 | feito | `paginas/FichaCliente.test.tsx:81`; a advogada vê na preparação (GGVP-32) |
| 5 | feito | `regras.test.ts:577`; `FichaAtendimento.test.tsx:25` e `:84`; `e2e/ficha-de-atendimento.e2e.ts:14` |
| 6 | feito | `FichaAtendimento.test.tsx:84`; `regras.test.ts:593`; `e2e/ficha-de-atendimento.e2e.ts:33` |
| 7 | feito | `FichaAtendimento.test.tsx:37` |
| 8 | feito | `FichaAtendimento.test.tsx:75`; `regras.test.ts:608`; o servidor recusa senha: `recepcao.test.ts:124` |
| 9 | parcial | a senha de teste não aparece na tela (`e2e/ficha-de-atendimento.e2e.ts:33`) nem no servidor (`recepcao.test.ts:124`); falta o teste que procura a senha em PDF, log, exportação e transcrição, como o critério pede |
| 10 | feito | `FichaAtendimento.test.tsx:84`; histórico no servidor: `recepcao.test.ts:124` ("depois, só o que mudou") |
| 11 | feito | `FichaAtendimento.test.tsx:25`; `regras.test.ts:593` |
| 12 | parcial | CPF, data e idade: `FichaAtendimento.test.tsx:61`, `regras.test.ts:583`; o telefone é conferido por regra local, não por "ferramenta gratuita de validação" |
| 13 | feito só no servidor de exemplo | a IA da transcrição preenche e a pessoa confere: `e2e/transcricao.e2e.ts:22` (GGVP-46); IA simulada até a GGVP-133 |
| 14 | feito só no servidor de exemplo | scanner e leitura simulados: `FichaAtendimento.test.tsx:45`; `e2e/ficha-de-atendimento.e2e.ts:14`; GGVP-107 e GGVP-125 |
| 15 | feito só no servidor de exemplo | `FichaAtendimento.test.tsx:45` (a senha lida vai ao cofre para conferir); cofre de verdade na GGVP-146 parte 1 |

### GGVP-28 · Segunda ficha para auxílio acidentário

Servidor de exemplo do navegador; liga nos próximos blocos da GGVP-125.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `paginas/AnalisarFicha.test.tsx:29`; `e2e/segunda-ficha.e2e.ts:11`; GGVP-125 |
| 2 | feito só no servidor de exemplo | `paginas/SegundaFicha.test.tsx:83`; `e2e/segunda-ficha.e2e.ts:11` |
| 3 | feito só no servidor de exemplo | `regras.test.ts:706`; `e2e/segunda-ficha.e2e.ts:11` |
| 4 | feito só no servidor de exemplo | `paginas/AnalisarFicha.test.tsx:29` e `:40` ("Sim" e "Não" registrados) |
| 5 | feito só no servidor de exemplo | `regras.test.ts:669`; `SegundaFicha.test.tsx:22` |
| 6 | feito só no servidor de exemplo | scanner simulado: `SegundaFicha.test.tsx:44`; `e2e/segunda-ficha.e2e.ts:11` |
| 7 | feito só no servidor de exemplo | `SegundaFicha.test.tsx:44` (senha ao cofre simulado); GGVP-146 parte 1 |
| 8 | feito só no servidor de exemplo | `regras.test.ts:700`; `SegundaFicha.test.tsx:22` e `:83` |

### GGVP-32 · Preparar a conversa lendo a ficha

A tarefa "Preparar entrevista" grava no servidor para o lead do balcão (GGVP-125, bloco 2). O resumo da ficha feito pela IA
é texto de exemplo; a situação da senha vem do cofre simulado.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `paginas/CentralAdvogada.test.tsx:63`; `e2e/preparar-entrevista.e2e.ts:21`; tarefa no servidor: `recepcao-agenda.test.ts:73`, `e2e/recepcao-servidor.e2e.ts:34` |
| 2 | feito | `paginas/PrepararEntrevista.test.tsx:40`; `regras.test.ts:635` |
| 3 | feito só no servidor de exemplo | `PrepararEntrevista.test.tsx:23` ("A IA sugere · você confere"); o resumo é texto de exemplo, sem IA de verdade |
| 4 | feito só no servidor de exemplo | `PrepararEntrevista.test.tsx:50`; `regras.test.ts:647`; a situação vem do cofre simulado, que liga na GGVP-146 (parte 1) |
| 5 | feito | `PrepararEntrevista.test.tsx:59`; `componentes/DetalheCompromisso.test.tsx:47`; `e2e/preparar-entrevista.e2e.ts:36` |

### GGVP-36 · Renovar a senha do gov.br antes da entrevista

Tudo no servidor de exemplo (`apps/web/src/dados/renovacao.ts`, `cofre.ts`): a senha é descartada, não chega a cofre nenhum.
Liga na GGVP-146 (parte 1), junto com o cofre de verdade (GGVP-103).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/renovacao.test.ts:17`; `e2e/renovar-senha.e2e.ts:22` |
| 2 | feito só no servidor de exemplo | `renovacao.test.ts:32`; `paginas/RenovarSenha.test.tsx:33` |
| 3 | feito só no servidor de exemplo | `renovacao.test.ts:51`; `RenovarSenha.test.tsx:49`; `e2e/renovar-senha.e2e.ts:43` |
| 4 | feito só no servidor de exemplo | `renovacao.test.ts:17`; `RenovarSenha.test.tsx:22` |
| 5 | feito só no servidor de exemplo | `RenovarSenha.test.tsx:33` (mascarada; depois, só a situação) |
| 6 | feito só no servidor de exemplo | `renovacao.test.ts:51`; `RenovarSenha.test.tsx:49` |
| 7 | feito só no servidor de exemplo | `renovacao.test.ts:51`; `e2e/renovar-senha.e2e.ts:22` |
| 8 | feito só no servidor de exemplo | `renovacao.test.ts:32` (quem, quando e a ação, sem o valor) |
| 9 | feito só no servidor de exemplo | `renovacao.test.ts:32` e `:45`; `RenovarSenha.test.tsx:33` |
| 10 | feito só no servidor de exemplo | `RenovarSenha.test.tsx:22` |
| 11 | feito só no servidor de exemplo | `renovacao.test.ts:32` (a data em que funcionou) |

### GGVP-40 · Entrevistar com gravação

A gravação, as ações, o fim da entrevista e as tarefas gravam no servidor para o lead do balcão (GGVP-125, bloco 3a). A
transcrição ao vivo e o texto são simulados até a GGVP-133; a senha dita vai ao cofre simulado (GGVP-146 parte 1).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `paginas/EntrevistaAoVivo.test.tsx:40`; `e2e/entrevista.e2e.ts:31` |
| 2 | feito | `POST /api/gravacoes/:id/audio`; `recepcao-entrevista.test.ts:69` e `:89`; `e2e/recepcao-servidor.e2e.ts:71` |
| 3 | feito (cofre simulado) | a senha sai do texto: `regras.test.ts:722`, `dados/entrevista.test.ts:60`, servidor `recepcao-entrevista.test.ts:69`; o cofre é a GGVP-146 |
| 4 | feito | servidor recusa sem o aviso: `recepcao-entrevista.test.ts:55`; `EntrevistaAoVivo.test.tsx:40` |
| 5 | feito | `recepcao-entrevista.test.ts:69` (fim abre "Cadastrar lead"); `EntrevistaAoVivo.test.tsx:52`; `e2e/entrevista.e2e.ts:31` |
| 6 | feito (cofre simulado) | `EntrevistaAoVivo.test.tsx:75`; `entrevista.test.ts:60` |
| 7 | feito | `regras.test.ts:722` (senhas de teste faladas não ficam no texto); `entrevista.test.ts:60` |
| 8 | feito | `EntrevistaAoVivo.test.tsx:86`; `e2e/entrevista.e2e.ts:83`; sem áudio no servidor: `recepcao-entrevista.test.ts:118` |
| 9 | feito | `paginas/Entrevista.test.tsx:40`; `regras.test.ts:743`; servidor: `recepcao-entrevista.test.ts:118` |
| 10 | feito só no servidor de exemplo | a divisão em partes de 24 MB está pronta (`regras.test.ts:751`, `Entrevista.test.tsx:40`); a transcrição de verdade é a GGVP-133 |
| 11 | feito (transcrição ao vivo simulada) | `EntrevistaAoVivo.test.tsx:52`; `regras.test.ts:767` |
| 12 | feito | `EntrevistaAoVivo.test.tsx:96`; `e2e/entrevista.e2e.ts:69` |
| 13 | feito | nenhuma rota apaga gravação; `dados/transcricao.test.ts:21` ("nada que apague") |

### GGVP-46 · Transcrever a entrevista

A transcrição e a conferência gravam no servidor para o lead do balcão (GGVP-125, bloco 3a), mas o texto é sempre o mesmo
diálogo de exemplo: a transcrição de verdade (OpenAI, quem fala, texto ao vivo) é a GGVP-133.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito (texto simulado) | `dados/transcricao.test.ts:31`; `e2e/transcricao.e2e.ts:22`; servidor `POST /api/gravacoes/:id/transcricao` |
| 2 | feito | `regras.test.ts:875`; `e2e/transcricao.e2e.ts:22` |
| 3 | feito | `dados/entrevista.test.ts:117`; `e2e/transcricao.e2e.ts:53` |
| 4 | feito | `transcricao.test.ts:21`; `regras.test.ts:888`; `e2e/transcricao.e2e.ts:60` |
| 5 | feito | `transcricao.test.ts:21` (nada se apaga); nenhuma rota de apagar no servidor |
| 6 | feito | conferência no servidor: `recepcao-entrevista.test.ts:96`; `transcricao.test.ts:41` e `:66`; "Abrir áudio" e "Exportar PDF": `componentes/Transcricoes.test.tsx:61` |
| 7 | feito | `transcricao.test.ts:57`; `recepcao-entrevista.test.ts:96`; `e2e/transcricao.e2e.ts:22` |
| 8 | feito só no servidor de exemplo | `transcricao.test.ts:31`; a separação vem do texto de exemplo; de verdade na GGVP-133 |

### GGVP-43 · Cadastrar o lead depois da entrevista

Tela e regras prontas, no servidor de exemplo. A tarefa "Cadastrar lead" já nasce no servidor (GGVP-125, bloco 3a), mas o
cadastro em si grava no navegador; liga no próximo bloco da GGVP-125. O CEP usa um ViaCEP simulado.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/cadastro.test.ts:23`; `paginas/CadastrarLead.test.tsx:32`; `e2e/cadastrar-lead.e2e.ts:24` |
| 2 | feito só no servidor de exemplo | `cadastro.test.ts:37`; `CadastrarLead.test.tsx:64`; `e2e/cadastrar-lead.e2e.ts:46` |
| 3 | feito só no servidor de exemplo | `cadastro.test.ts:44`; `regras.test.ts:816` |
| 4 | feito só no servidor de exemplo | `regras.test.ts:833`; `cadastro.test.ts:49` |
| 5 | feito só no servidor de exemplo | `CadastrarLead.test.tsx:50`; `regras.test.ts:816` |
| 6 | feito só no servidor de exemplo | `cadastro.test.ts:70`; `CadastrarLead.test.tsx:78`; `regras.test.ts:828` |
| 7 | feito só no servidor de exemplo | `cadastro.test.ts:49`; `e2e/cadastrar-lead.e2e.ts:60` |
| 8 | feito só no servidor de exemplo | `regras.test.ts:848`; `CadastrarLead.test.tsx:32` |
| 9 | feito só no servidor de exemplo | `cadastro.test.ts:49`; `CadastrarLead.test.tsx:85` |
| 10 | feito só no servidor de exemplo | `cadastro.test.ts:91` (ViaCEP simulado); `CadastrarLead.test.tsx:50` |
| 11 | feito só no servidor de exemplo | `cadastro.test.ts:79`; `regras.test.ts:860`; `e2e/cadastrar-lead.e2e.ts:76` (entre abas do mesmo navegador; entre computadores, só com o servidor) |

### GGVP-51 · Definir o benefício com apoio do acervo

Tela e regras prontas, no servidor de exemplo; a tarefa já nasce no servidor (GGVP-125, bloco 3a). A sugestão da IA e os
casos-base são de exemplo: o acervo de verdade é a GGVP-131 e a GGVP-141.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/beneficio.test.ts:42`; `regras.test.ts:908`; `paginas/DefinirBeneficio.test.tsx:65`; `e2e/definir-beneficio.e2e.ts:48` |
| 2 | feito só no servidor de exemplo | `beneficio.test.ts:28`; `DefinirBeneficio.test.tsx:27`; IA e acervo simulados (GGVP-141) |
| 3 | feito só no servidor de exemplo | `beneficio.test.ts:54`; `DefinirBeneficio.test.tsx:48` |
| 4 | feito só no servidor de exemplo | `DefinirBeneficio.test.tsx:27` |
| 5 | feito só no servidor de exemplo | `DefinirBeneficio.test.tsx:27` e `:48` |
| 6 | feito só no servidor de exemplo | `beneficio.test.ts:54` |
| 7 | feito | regra por código com teste: `regras.test.ts:916` e `:926` (G19) |
| 8 | feito só no servidor de exemplo | `beneficio.test.ts:73` |

### GGVP-57 · Calcular tempo e pontos sobre o CNIS

Servidor de exemplo; liga no próximo bloco da GGVP-125.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/calculo.test.ts:33`; `regras.test.ts:954`; `paginas/CalcularTempo.test.tsx:104` |
| 2 | feito só no servidor de exemplo | `calculo.test.ts:75`; `CalcularTempo.test.tsx:65`; `regras.test.ts:985` |
| 3 | feito só no servidor de exemplo | `calculo.test.ts:43`; `CalcularTempo.test.tsx:91`; `e2e/calcular-tempo.e2e.ts:61` |
| 4 | feito só no servidor de exemplo | `CalcularTempo.test.tsx:44` (o CNIS com a origem e a data) |
| 5 | feito só no servidor de exemplo | `calculo.test.ts:52`; `CalcularTempo.test.tsx:44`; `regras.test.ts:963` |
| 6 | feito só no servidor de exemplo | `calculo.test.ts:75`; `e2e/calcular-tempo.e2e.ts:29` |
| 7 | feito | `regras.test.ts:963` (os números são os digitados, conferidos pela biblioteca campos) |

### GGVP-60 · Registrar por que não virou cliente e recontatar

Servidor de exemplo; liga no próximo bloco da GGVP-125.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/fechamento.test.ts:55`; `regras/fechamento.test.ts:70` (G16) |
| 2 | feito só no servidor de exemplo | `dados/fechamento.test.ts:61`; `e2e/fechamento.e2e.ts:23` |
| 3 | feito só no servidor de exemplo | `dados/fechamento.test.ts:91`; `paginas/Recontatar.test.tsx:27` |
| 4 | feito só no servidor de exemplo | `dados/fechamento.test.ts:76`; `paginas/RegistrarFechamento.test.tsx:92`; `e2e/fechamento.e2e.ts:53` |
| 5 | feito só no servidor de exemplo | `RegistrarFechamento.test.tsx:23`, `:32` e `:41`; `e2e/fechamento.e2e.ts:70` |
| 6 | feito só no servidor de exemplo | `regras/fechamento.test.ts:55` e `:70` |
| 7 | feito só no servidor de exemplo | `RegistrarFechamento.test.tsx:69`; `e2e/fechamento.e2e.ts:53` |
| 8 | feito só no servidor de exemplo | `dados/fechamento.test.ts:61`; `regras/fechamento.test.ts:108` |
| 9 | feito só no servidor de exemplo | `Recontatar.test.tsx:67`; `regras/fechamento.test.ts:108` |
| 10 | feito só no servidor de exemplo | `Recontatar.test.tsx:38`, `:47` e `:57`; `dados/fechamento.test.ts:101` |
| 11 | feito só no servidor de exemplo | `regras/fechamento.test.ts:90`; `RegistrarFechamento.test.tsx:80` |
| 12 | feito | regra em código com teste: `regras/fechamento.test.ts:47` (15 e 30 dias) |

### GGVP-123 · Marcar a entrevista e a agenda

Marcar, remarcar, realizado ou faltou, convite e compromisso interno gravam no servidor (GGVP-125, bloco 2). O convite
pelo Chatwoot é simulado até a GGVP-146 (parte 4).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `POST /api/fichas/:id/agendamentos`; `recepcao-agenda.test.ts:43`; `paginas/MarcarEntrevista.test.tsx:37`; `e2e/agenda.e2e.ts:17` |
| 2 | feito | `regras.test.ts:457`; `dados/agenda.test.ts:45` |
| 3 | feito | servidor: `recepcao-agenda.test.ts:43` (ocupado avisa para todos); `MarcarEntrevista.test.tsx:64`; `e2e/agenda.e2e.ts:36` |
| 4 | feito (Chatwoot simulado) | `regras.test.ts:472`; `dados/agenda.test.ts:58`; `e2e/agenda.e2e.ts:17` |
| 5 | feito | `recepcao-agenda.test.ts:113` (compromisso interno); `paginas/Agenda.test.tsx:16` e `:37`; `e2e/agenda.e2e.ts:50` |
| 6 | feito | `recepcao-agenda.test.ts:113` ("realizado" abre "Cadastrar lead"); `dados/agenda.test.ts:85`; `e2e/agenda.e2e.ts:80` |
| 7 | feito | servidor: `recepcao-agenda.test.ts:43` (limite G15); `MarcarEntrevista.test.tsx:76` e `:90`; `dados/agenda.test.ts:94` |
| 8 | feito | `Agenda.test.tsx:30`, `:63` e `:72`; `regras.test.ts:442`; `paginas/CentralAtendimento.test.tsx:89` |
| 9 | feito | `dados/agenda.test.ts:94`; `e2e/agenda.e2e.ts:64` |

### GGVP-124 · Nova demanda de quem já é cliente

Servidor de exemplo; liga no próximo bloco da GGVP-125.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/novaDemanda.test.ts:39`; `paginas/NovaDemanda.test.tsx:35`; `e2e/nova-demanda.e2e.ts:11` |
| 2 | feito só no servidor de exemplo | `regras/novaDemanda.test.ts:47`; `NovaDemanda.test.tsx:83` |
| 3 | feito só no servidor de exemplo | `dados/novaDemanda.test.ts:75`; `NovaDemanda.test.tsx:110` |
| 4 | feito só no servidor de exemplo | `dados/contrato.test.ts:85` (processo e kit novos, com contrato e procuração) |
| 5 | feito só no servidor de exemplo | `regras/novaDemanda.test.ts:74`; `NovaDemanda.test.tsx:52` |
| 6 | parcial | a tela só avisa que a IA preencherá o processo novo e que dado pessoal mudado vira sugestão; a IA da entrevista não separa o processo novo nem marca a sugestão; sem teste |
| 7 | feito só no servidor de exemplo | `regras/novaDemanda.test.ts:87`; `NovaDemanda.test.tsx:110`; a subpasta no Drive de verdade é a GGVP-107 |
| 8 | feito só no servidor de exemplo | `dados/novaDemanda.test.ts:50`; `NovaDemanda.test.tsx:64`; `e2e/nova-demanda.e2e.ts:50` |
| 9 | feito só no servidor de exemplo | `dados/novaDemanda.test.ts:57`; `e2e/nova-demanda.e2e.ts:34` |
| 10 | feito só no servidor de exemplo | `regras/novaDemanda.test.ts:92` |

### GGVP-120 · Base do front: tokens do Figma, tema e fonte, peças comuns das Centrais

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/web/src/design/tokens.test.ts:20` a `:52` (em dia com o JSON; todo `var(--x)` definido) |
| 2 | feito | `design/preferencias.test.ts:14` a `:44`; `e2e/base-do-front.e2e.ts:19` e `:35` |
| 3 | feito | `componentes/Topbar.test.tsx` |
| 4 | feito | `componentes/TarefaLinha.test.tsx`; `e2e/base-do-front.e2e.ts:43` |
| 5 | feito | `paginas/CentralAtendimento.test.tsx`; `componentes/ChatDoPortal.test.tsx` (o chat agora responde pelo servidor de exemplo) |
| 6 | feito | `paginas/Tokens.test.tsx:6`; `e2e/base-do-front.e2e.ts:50` |
| 7 | feito | `e2e/base-do-front.e2e.ts:64` |
| 8 | feito (superado) | os botões que eram indisponíveis foram ligados depois: "Entrar como…" (`componentes/EntrarComo.test.tsx`), chat, anexar e gravar áudio (`ChatDoPortal.test.tsx:173`) |
| 9 | feito | `e2e/base-do-front.e2e.ts:74` |


## Abertura e documentação (GGVP-7) · dono: Pedro

Tudo no servidor de exemplo do navegador: contrato, assinatura, leitura dos documentos, checklist, cobrança, boas-vindas e
liberação. Liga nos próximos blocos da GGVP-125 (contrato; documentos, checklist e cobrança; liberação à Sênior). ZapSign,
Chatwoot, scanner e Drive são simulados: o ZapSign de verdade ficou fora de 09/10, sem história; o Chatwoot é a GGVP-146
(parte 4); o Drive, a GGVP-107.

### GGVP-65 · Kit de documentos por benefício

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/contrato.test.ts:53` e `:74`; `paginas/PrepararContrato.test.tsx:20`; `e2e/preparar-contrato.e2e.ts:11` |
| 2 | feito só no servidor de exemplo | `regras/contrato.test.ts:67`; `PrepararContrato.test.tsx:38` |
| 3 | feito só no servidor de exemplo | `regras/contrato.test.ts:74`, `:78`, `:83` e `:89`; `PrepararContrato.test.tsx:51` |
| 4 | feito | um teste por benefício, os 9 da tabela: `regras/contrato.test.ts:45` a `:89` |
| 5 | feito | `regras/contrato.test.ts:96` |
| 6 | feito | `regras/contrato.test.ts:106` (catálogo único) |
| 7 | parcial | proposta: a Configuração do escritório versiona o kit no servidor (GGVP-104), mas a tela do contrato usa a tabela fixa do navegador e não oferece "atualizar" o caso em andamento |
| 8 | feito só no servidor de exemplo | `regras/contrato.test.ts:62` e `:118`; `dados/contrato.test.ts:101`; `PrepararContrato.test.tsx:38` |
| 9 | feito só no servidor de exemplo | `dados/contrato.test.ts:85` |

### GGVP-69 · Preencher o contrato pelo modelo e conferir

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/contrato.test.ts:150`, `:173` e `:189`; `PrepararContrato.test.tsx:90` e `:162` |
| 2 | feito só no servidor de exemplo | `PrepararContrato.test.tsx:103` |
| 3 | feito só no servidor de exemplo | `dados/contrato.test.ts:127`; `PrepararContrato.test.tsx:126` e `:144`; `e2e/preparar-contrato.e2e.ts:39` |
| 4 | feito | `regras/contrato.test.ts:223` |
| 5 | feito só no servidor de exemplo | `regras/contrato.test.ts:150` e `:166`; `e2e/preparar-contrato.e2e.ts:30` |
| 6 | feito só no servidor de exemplo | `regras/contrato.test.ts:211`; `PrepararContrato.test.tsx:113`; o servidor de exemplo valida de novo (`dados/contrato.test.ts:174`) |
| 7 | feito só no servidor de exemplo | `dados/contrato.test.ts:122` e `:127` |
| 8 | feito | `regras/contrato.test.ts:231`; `dados/contrato.test.ts:148` |
| 9 | feito só no servidor de exemplo | `regras/contrato.test.ts:173`; `PrepararContrato.test.tsx:90` |
| 10 | parcial | o identificador do modelo é o mesmo na pasta e no "ZapSign" (`regras/contrato.test.ts:239`), mas a pasta MODELOS ZAPSIGN e o ZapSign são simulados |
| 11 | feito | `regras/contrato.test.ts:246`; `e2e/preparar-contrato.e2e.ts:30` |

### GGVP-72 · Assinatura digital pelo ZapSign

O ZapSign é simulado de ponta a ponta: o envio, o link e o retorno "assinado" (botão "Simular o retorno do ZapSign"). A
integração real ficou fora de 09/10 e não tem história ainda.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/contrato.test.ts:201` |
| 2 | feito só no servidor de exemplo | `dados/contrato.test.ts:190` e `:213`; `e2e/colher-assinatura.e2e.ts:11` |
| 3 | feito só no servidor de exemplo | `dados/contrato.test.ts:242`; `e2e/colher-assinatura.e2e.ts:33` |
| 4 | feito só no servidor de exemplo | `dados/contrato.test.ts:190` e `:201` |
| 5 | feito só no servidor de exemplo | `dados/contrato.test.ts:213` |
| 6 | feito só no servidor de exemplo | `dados/contrato.test.ts:242` |
| 7 | feito só no servidor de exemplo | `dados/contrato.test.ts:264` (retorno sem o segredo recusado; evento repetido não anexa duas vezes) |
| 8 | faltando | proposta: a consulta periódica ao ZapSign, para o retorno que não chegou, não existe |
| 9 | feito só no servidor de exemplo | `dados/contrato.test.ts:272` |
| 10 | feito só no servidor de exemplo | `dados/contrato.test.ts:242`; `e2e/colher-assinatura.e2e.ts:33` |
| 11 | feito | regra em código: `regras/contrato.test.ts:253` e `:258`; `dados/contrato.test.ts:230` |
| 12 | feito só no servidor de exemplo | `regras/contrato.test.ts:266`; o WhatsApp pelo Chatwoot segue simulado: a GGVP-146 (parte 4) não ligou este envio, que vai para o servidor com a Abertura (GGVP-125) e deve usar o correio do cliente (`criarCorreio`) |

### GGVP-77 · Assinatura em papel na entrevista

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/contrato.test.ts:292`; `dados/contrato.test.ts:283` |
| 2 | feito só no servidor de exemplo | `dados/contrato.test.ts:292`; scanner e Drive simulados (GGVP-107) |
| 3 | feito só no servidor de exemplo | `dados/contrato.test.ts:292`; `e2e/colher-assinatura.e2e.ts:57` |
| 4 | feito só no servidor de exemplo | `regras/contrato.test.ts:275`; `dados/contrato.test.ts:313` |

### GGVP-85 · Verificar o contrato assinado

A leitura do contrato pela IA é simulada (botão "Simular a leitura da IA").

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/contrato.test.ts:333`; `regras/contrato.test.ts:301`; `e2e/conferir-contrato.e2e.ts:31` |
| 2 | feito só no servidor de exemplo | `dados/contrato.test.ts:342`; `paginas/ConferirContrato.test.tsx:37` |
| 3 | feito só no servidor de exemplo | `dados/contrato.test.ts:367`; `ConferirContrato.test.tsx:60`; `e2e/conferir-contrato.e2e.ts:40` |
| 4 | feito só no servidor de exemplo | `dados/contrato.test.ts:342`; `ConferirContrato.test.tsx:37` |
| 5 | feito só no servidor de exemplo | `dados/contrato.test.ts:360`; `regras/contrato.test.ts:319`; `ConferirContrato.test.tsx:48` |
| 6 | feito só no servidor de exemplo | `dados/contrato.test.ts:367`; `ConferirContrato.test.tsx:60` |
| 7 | feito só no servidor de exemplo | `dados/contrato.test.ts:384`; `ConferirContrato.test.tsx:77` |

### GGVP-89 · Cópia do contrato para o cliente levar

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/contrato.test.ts:410`; `paginas/EntregarCopia.test.tsx:25` |
| 2 | feito só no servidor de exemplo | `dados/contrato.test.ts:396` |
| 3 | feito só no servidor de exemplo | `dados/contrato.test.ts:418`; `regras/contrato.test.ts:330`; `EntregarCopia.test.tsx:35` |
| 4 | feito só no servidor de exemplo | `dados/contrato.test.ts:431`; `regras/contrato.test.ts:340`; `EntregarCopia.test.tsx:54`; `e2e/entregar-copia.e2e.ts:38` |
| 5 | feito só no servidor de exemplo | `dados/contrato.test.ts:418`; `e2e/entregar-copia.e2e.ts:18` |

### GGVP-81 · Ler e arquivar os documentos

A leitura da IA e a automação do scanner são simuladas; o Drive é a GGVP-107.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/leitura.test.ts:76`; `e2e/conferir-documentos.e2e.ts:51` |
| 2 | feito só no servidor de exemplo | `leitura.test.ts:89` |
| 3 | feito só no servidor de exemplo | `leitura.test.ts:173`; `regras/leitura.test.ts:42`; `paginas/ConferirDocumentos.test.tsx:79` |
| 4 | feito só no servidor de exemplo | `leitura.test.ts:153`, `:162` e `:227` |
| 5 | feito só no servidor de exemplo | `leitura.test.ts:220` (classificação na GGVP-95) |
| 6 | feito só no servidor de exemplo | `leitura.test.ts:76` (o lote em revisão não entra); `e2e/receber-documento.e2e.ts:46` |
| 7 | feito só no servidor de exemplo | `ConferirDocumentos.test.tsx:21`, `:40` e `:61`; `leitura.test.ts:100` e `:119`; `regras/leitura.test.ts:17` e `:60` |
| 8 | feito só no servidor de exemplo | `leitura.test.ts:173`; `regras/leitura.test.ts:42` |
| 9 | feito só no servidor de exemplo | `leitura.test.ts:89` e `:100`; `regras/leitura.test.ts:53` |
| 10 | feito só no servidor de exemplo | `leitura.test.ts:186`; `regras/leitura.test.ts:33`; `ConferirDocumentos.test.tsx:92` e `:106` |
| 11 | feito só no servidor de exemplo | `leitura.test.ts:194` (recusado sem motivo pelo servidor de exemplo) |
| 12 | feito só no servidor de exemplo | `leitura.test.ts:210`; `regras/leitura.test.ts:70` |
| 13 | feito só no servidor de exemplo | `leitura.test.ts:61` e `:283` |
| 14 | feito só no servidor de exemplo | `dados/checklist.test.ts:44`; `leitura.test.ts:100` |
| 15 | feito só no servidor de exemplo | `paginas/CentralAtendimento.test.tsx:28`; `paginas/FichaCliente.test.tsx:208` (GGVP-17 CA15) |
| 16 | feito só no servidor de exemplo | `leitura.test.ts:143` (documento médico não se descarta) |

### GGVP-91 · Checklist de documentos obrigatórios do benefício

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/checklist.test.ts:26`; `paginas/ConferirChecklist.test.tsx:29`; `e2e/checklist.e2e.ts:15` |
| 2 | feito só no servidor de exemplo | `checklist.test.ts:78`; `ConferirChecklist.test.tsx:57` (G1) |
| 3 | feito só no servidor de exemplo | `ConferirChecklist.test.tsx:41`; `e2e/checklist.e2e.ts:15` |
| 4 | parcial | os documentos complementares entram (`ConferirChecklist.test.tsx:123` e `:157`), mas o item "Parecer médico" com o status do GGVP-20 não aparece no checklist; o status do parecer só aparece na liberação (GGVP-18) |
| 5 | feito só no servidor de exemplo | `checklist.test.ts:44`; `ConferirChecklist.test.tsx:41` e `:47` |
| 6 | feito só no servidor de exemplo | `checklist.test.ts:90`; `ConferirChecklist.test.tsx:68`; `e2e/checklist.e2e.ts:39` |
| 7 | feito só no servidor de exemplo | `checklist.test.ts:26`; `ConferirChecklist.test.tsx:29` |
| 8 | feito só no servidor de exemplo | `checklist.test.ts:99`; `e2e/transcricao.e2e.ts:22` |
| 9 | feito só no servidor de exemplo | `checklist.test.ts:107` |
| 10 | parcial | a lista vem de uma configuração de exemplo no navegador (`dados/checklist.ts`, `configurarListas`); a Configuração do escritório no servidor (GGVP-104) já versiona os kits, mas ainda não alimenta o checklist |

### GGVP-18 · Liberar o caso ao Jurídico

Servidor de exemplo. O OK da Documentação ainda não cria a tarefa da Sênior no servidor: a conferência antes do INSS lê
casos do banco, e a liberação grava no navegador (GGVP-125, CA3).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/liberacao.test.ts:63`; `e2e/liberar.e2e.ts:16`; não chega à fila da Sênior no servidor (GGVP-125) |
| 2 | feito só no servidor de exemplo | `liberacao.test.ts:56`; `regras/liberacao.test.ts:24` |
| 3 | feito só no servidor de exemplo | `liberacao.test.ts:86`; `regras/liberacao.test.ts:37` e `:51`; `paginas/LiberarCaso.test.tsx:94` e `:111` |
| 4 | feito só no servidor de exemplo | `liberacao.test.ts:91` (recusado e registrado no servidor de exemplo); `LiberarCaso.test.tsx:69`; `e2e/liberar.e2e.ts:94` |
| 5 | feito só no servidor de exemplo | `liberacao.test.ts:42`; `regras/liberacao.test.ts:57`; `paginas/CentralAtendimento.test.tsx:82` |
| 6 | feito só no servidor de exemplo | `liberacao.test.ts:63`; `LiberarCaso.test.tsx:55` |
| 7 | feito só no servidor de exemplo | `regras/liberacao.test.ts:24`; `LiberarCaso.test.tsx:55` |

### GGVP-97 · Boas-vindas ao cliente

Servidor de exemplo; o envio pelo Chatwoot segue simulado. A GGVP-146 (parte 4) ligou o Chatwoot de verdade só no correio
do servidor (o modelo "Boas-vindas" da janela "Mensagem ao cliente" sai por ele); o cartão do checklist ainda não chega à
API. Liga quando o checklist for para o servidor (GGVP-125, próximos blocos), com a rota das boas-vindas usando o correio
do cliente (`criarCorreio`).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/boasVindas.test.ts:13`; `regras/boasVindas.test.ts:12` e `:21` |
| 2 | feito só no servidor de exemplo | `boasVindas.test.ts:25` |
| 3 | feito só no servidor de exemplo | `boasVindas.test.ts:39`; `regras/boasVindas.test.ts:5`; `e2e/boas-vindas.e2e.ts:32` |
| 4 | feito só no servidor de exemplo | `boasVindas.test.ts:25`; `componentes/CartaoBoasVindas.test.tsx:32` |
| 5 | feito só no servidor de exemplo | `boasVindas.test.ts:13`; `regras/boasVindas.test.ts:12` |
| 6 | feito só no servidor de exemplo | `boasVindas.test.ts:45`; `CartaoBoasVindas.test.tsx:51`; `e2e/boas-vindas.e2e.ts:38` |

### GGVP-101 · Cobrar os documentos pendentes

Servidor de exemplo; o envio pelo Chatwoot é simulado (GGVP-146, parte 4).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/cobranca.test.ts:19`; `paginas/ConferirChecklist.test.tsx:74`; `e2e/cobranca.e2e.ts:12` |
| 2 | feito só no servidor de exemplo | `cobranca.test.ts:96` |
| 3 | feito | regra em código: `regras/cobranca.test.ts:23` e `:30`; `cobranca.test.ts:36` |
| 4 | feito só no servidor de exemplo | `cobranca.test.ts:19` |
| 5 | feito só no servidor de exemplo | `regras/cobranca.test.ts:47` |
| 6 | feito só no servidor de exemplo | `cobranca.test.ts:36` |
| 7 | feito só no servidor de exemplo | `cobranca.test.ts:54`; `paginas/CentralAtendimento.test.tsx:75`; `paginas/CentralAdvogada.test.tsx:15` |
| 8 | feito só no servidor de exemplo | `cobranca.test.ts:69` e `:81`; `regras/cobranca.test.ts:38` e `:81`; `e2e/cobranca.e2e.ts:35` |
| 9 | feito só no servidor de exemplo | `cobranca.test.ts:96` |
| 10 | feito só no servidor de exemplo | `cobranca.test.ts:87`; `regras/cobranca.test.ts:69` |
| 11 | feito só no servidor de exemplo | `regras/cobranca.test.ts:88`; `e2e/cobranca.e2e.ts:12` |
| 12 | feito só no servidor de exemplo | `regras/cobranca.test.ts:56`; `cobranca.test.ts:54` |

### GGVP-125 · Ligar a Recepção e a Abertura no servidor, até a conferência da Sênior

O cartão está com o Mateus. Três blocos de seis entregues em 08/10 (lead e ficha; agenda e confirmação; entrevista gravada e
transcrição); o bloco 3b está no PR #32, aberto. Faltam
entrevista e benefício (cadastro, benefício, cálculo, fechamento), contrato, documentos com checklist e cobrança, e a
liberação à Sênior.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | parcial | ficha, agenda, confirmação, tarefas da Recepção e entrevista gravam no banco (`apps/api/src/rotas/recepcao.ts`, `recepcao-agenda.ts`, `recepcao-entrevista.ts`; testes `recepcao*.test.ts`); benefício, cálculo, cadastro, fechamento, nova demanda, contrato, documentos, checklist, cobrança e liberação ainda gravam no navegador |
| 2 | parcial | `packages/contratos/src/recepcao.ts` tem os contratos dos três blocos; o resto dos tipos continua em `apps/web/src/dados/tipos.ts` |
| 3 | faltando | o OK da Documentação não cria a tarefa da Sênior no banco |
| 4 | feito | nas rotas novas: `recepcao.test.ts:148`, `recepcao-agenda.test.ts:138`; matriz: `permissoes.test.ts:97` |
| 5 | parcial | no servidor: G9 (`recepcao.test.ts:124`, a ficha nunca grava a senha), G15 (`recepcao-agenda.test.ts:43` e `:94`) e G10 (`recepcao-entrevista.test.ts:55`); G1, G16 e G17 ainda só no servidor de exemplo |
| 6 | faltando | o teste de tela do servidor vai do balcão à entrevista gravada (`e2e/recepcao-servidor.e2e.ts:6`, `:34` e `:71`), não à fila da Sênior |


## Documentação médica · dono: Pedro

Tudo no servidor de exemplo do navegador: o parecer, o laudo novo, o complemento, a dispensa, o roteiro, a leitura dos
documentos médicos e as linhas da deficiência e do acidente. A ligação no servidor é a GGVP-132; a IA dessas telas é
simulada até a GGVP-134. Do lado do servidor já valem a trava do parecer na conferência da Sênior (GGVP-23) e a dispensa
por duas Sêniores (`apps/api/src/rotas/conferencia.ts`), pela mesma regra do contrato (`travaDoParecer`, GGVP-109).

### GGVP-20 · Parecer de suficiência da documentação médica

Resposta do Lucas (01/10): todo documento médico que entra passa pela comparação da IA; o resultado sobe como sugerido e
espera a conferência da advogada (G17); contradição trava (G18) e já pede os complementares.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/parecer.test.ts:38`; `dados/parecer.test.ts:46`; `e2e/parecer.e2e.ts:24` |
| 2 | feito só no servidor de exemplo | `regras/parecer.test.ts:50`, `:56` e `:115`; `dados/parecer.test.ts:140`; `e2e/parecer.e2e.ts:68` |
| 3 | feito só no servidor de exemplo | `regras/parecer.test.ts:101`; `dados/parecer.test.ts:82` e `:111`; `e2e/parecer.e2e.ts:24` |
| 4 | feito só no servidor de exemplo | `regras/parecer.test.ts:65`; `dados/parecer.test.ts:119` |
| 5 | feito só no servidor de exemplo | `regras/parecer.test.ts:93`; `dados/parecer.test.ts:82`; `e2e/parecer.e2e.ts:24` |
| 6 | feito só no servidor de exemplo | `dados/parecer.test.ts:156` e `:176`; `AnalisarLaudoNovo.test.tsx:21`; `FichaCliente.test.tsx:73`; `e2e/parecer.e2e.ts:50` |
| 7 | feito só no servidor de exemplo | `regras/parecer.test.ts:76`; `dados/parecer.test.ts:156`; `e2e/parecer.e2e.ts:50` (a IA é simulada até a GGVP-134) |
| 8 | feito só no servidor de exemplo | `regras/parecer.test.ts:76`, `:87` e `:93`; `e2e/parecer.e2e.ts:24` |

No servidor, a conferência da Sênior mostra o parecer item a item, sem CID nem texto do laudo (`conferencia.test.ts:71`),
e só o Jurídico o lê (`conferencia.test.ts:77`).

### GGVP-29 · Pedir o complemento ao médico do cliente

Respostas do Lucas (01/10): a IA gera a orientação e a advogada só confirma (Q1); com prazo do juiz, o limite é o prazo
e a tarefa é urgente (Q2); a mesma pendência gira no Atendimento, com a IA dizendo se o laudo novo já cobre (Q4).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/complemento.test.ts:28`; `PedirComplemento.test.tsx:32`; `regras/parecer.test.ts:132`; `e2e/complemento.e2e.ts:27` |
| 2 | feito só no servidor de exemplo | os mesmos testes do CA1 (sem frase-chave, sem CID) |
| 3 | feito só no servidor de exemplo | `dados/complemento.test.ts:46` (duas tentativas sobem à Sênior) e `:69` (com prazo do juiz, urgente); `PedirComplemento.test.tsx:49` e `:62`; `CentralAdvogada.test.tsx:30` |
| 4 | feito só no servidor de exemplo | `dados/complemento.test.ts:87`; `PedirComplemento.test.tsx:80`; `e2e/complemento.e2e.ts:27` |
| 5 | feito só no servidor de exemplo | `dados/complemento.test.ts:87`; `dados/documentos.test.ts:104`; `PedirComplemento.test.tsx:92` |
| 6 | feito só no servidor de exemplo | `dados/complemento.test.ts:28`; `PedirComplemento.test.tsx:32`; `e2e/complemento.e2e.ts:27` |

Parcial pela resposta do Lucas (Q1): a orientação nasce do parecer "Insuficiente", mas não nasce ainda de uma exigência
ou manifestação do juiz que peça complemento médico (o servidor da Justiça não abre o complemento). Fica com a GGVP-132.

### GGVP-33 · Portão: sem parecer, o caso não anda

Resposta do Lucas (01/10, Q14): a dispensa precisa de duas Sêniores de acordo, com justificativa, no histórico.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | parcial | a regra é uma só, no contrato (`packages/contratos/src/governanca.test.ts:75` a `:94`). No servidor, "aprovar para o INSS" recusa (`conferencia.test.ts:104`). "Liberar ao Jurídico" trava só no servidor de exemplo (`LiberarCaso.test.tsx:94`; `e2e/portao.e2e.ts:26`). **Falta:** o pedido da petição no servidor (`apps/api/src/rotas/peticao.ts`) não confere o parecer. A spec da petição deixou esse bloqueio para a v2 (GGVP-63 CA5): por caminho, o caso que chega à Justiça já passou pela conferência da Sênior; um laudo novo ou uma contradição depois disso não trava a petição |
| 2 | feito | dispensa por duas Sêniores no servidor: `conferencia.test.ts:128` e `:150`; no card: `ParecerMedico.test.tsx:68`, `DispensarParecer.test.tsx:23`; no painel dos sócios (GGVP-75), os dispensados contra os "Suficiente" (`fluxo/resultados.test.ts:89`). Na tela do servidor de exemplo, a Sênior só chega ao "Dispensar o parecer" pelo endereço (P12) |
| 3 | feito só no servidor de exemplo | `regras/parecer.test.ts:169`; `CentralAtendimento.test.tsx:131`; `e2e/portao.e2e.ts:56` (o chat de verdade é a GGVP-142) |
| 4 | feito só no servidor de exemplo | `LiberarCaso.test.tsx:94`; `e2e/portao.e2e.ts:26` |
| 5 | feito só no servidor de exemplo | `dados/parecer.test.ts:304` |

### GGVP-42 · Aposentadoria PCD: linha do tempo da deficiência

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/deficiencia.test.ts:8`; `dados/deficiencia.test.ts:14`; `LinhaDaDeficiencia.test.tsx:22`; `e2e/deficiencia.e2e.ts:15` |
| 2 | feito só no servidor de exemplo | `regras/deficiencia.test.ts:97`; `dados/deficiencia.test.ts:39` e `:55`; `LinhaDaDeficiencia.test.tsx:59`; `e2e/deficiencia.e2e.ts:26` |
| 3 | feito só no servidor de exemplo | `regras/deficiencia.test.ts:23`; `dados/deficiencia.test.ts:62` |
| 4 | feito | a regra em código: `regras/deficiencia.test.ts:37`, `:54` e `:89`; na tela: `LinhaDaDeficiencia.test.tsx:40` e `:84` |

Sem caminho por clique até a linha do tempo (P13 do roteiro): o teste abre pela rota.

### GGVP-47 · Auxílio-Acidente: prova do acidente

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/acidente.test.ts:41`; `regras/checklist.test.ts:100`; `dados/acidente.test.ts:51`; `e2e/acidente.e2e.ts:41` |
| 2 | feito só no servidor de exemplo | `regras/acidente.test.ts:50` e `:75`; `ConferirChecklist.test.tsx:94` e `:139`; `e2e/liberar.e2e.ts:85` |
| 3 | feito só no servidor de exemplo | `regras/checklist.test.ts:111` e `:116`; `dados/acidente.test.ts:85`; `e2e/acidente.e2e.ts:66` |
| 4 | feito só no servidor de exemplo | `regras/liberacao.test.ts:69` e `:78`; `dados/acidente.test.ts:121`; `LiberarCaso.test.tsx:133`; `e2e/acidente.e2e.ts:90` |

### GGVP-50 · BPC/LOAS de menor de 16 anos

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/infantil.test.ts:5`; `dados/infantil.test.ts:17`; `DarParecer.test.tsx:131`; `e2e/infantil.e2e.ts:15` |
| 2 | feito só no servidor de exemplo | `regras/infantil.test.ts:13`; `dados/infantil.test.ts:33`, `:39` e `:49`; `ConferirChecklist.test.tsx:157`; `e2e/infantil.e2e.ts:26` |

### GGVP-93 · Roteiro de conteúdo mínimo por benefício, configurável e versionado

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/roteiro.test.ts:20`; `dados/roteiro.test.ts:15`; `e2e/roteiro.e2e.ts:12` e `:30` |
| 2 | feito só no servidor de exemplo | `regras/roteiro.test.ts:26` e `:42`; `dados/roteiro.test.ts:52` e `:64`; `dados/parecer.test.ts:199` |
| 3 | feito só no servidor de exemplo | `dados/roteiro.test.ts:45`; `dados/parecer.test.ts:216`; `DarParecer.test.tsx:108` |
| 4 | feito só no servidor de exemplo | `dados/parecer.test.ts:199` |

O roteiro é editado no navegador. A Configuração do escritório no servidor (GGVP-104) versiona os kits e as mensagens,
não os roteiros: a ligação (GGVP-132) leva o roteiro para lá. Sem caminho por clique até a tela (P13 do roteiro).

### GGVP-95 · Classificar cada documento médico que entra

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/leitura.test.ts:220`; `regras/leitura.test.ts:84`; `ConferirDocumentos.test.tsx:119`; `e2e/documento-medico.e2e.ts:13` |
| 2 | feito só no servidor de exemplo | `dados/leitura.test.ts:237`; `ConferirDocumentos.test.tsx:127` |
| 3 | feito só no servidor de exemplo | `dados/leitura.test.ts:247`; `CentralAtendimento.test.tsx:45`; `e2e/documento-medico.e2e.ts:32` |
| 4 | feito só no servidor de exemplo | `dados/leitura.test.ts:227` |
| 5 | feito só no servidor de exemplo | `dados/leitura.test.ts:267` |
| 6 | feito só no servidor de exemplo | `dados/leitura.test.ts:220` (a leitura da IA é simulada; o leitor de verdade é a GGVP-134) |
| 7 | feito só no servidor de exemplo | `dados/leitura.test.ts:273` |
| 8 | feito só no servidor de exemplo | `dados/leitura.test.ts:283` |
| 9 | feito só no servidor de exemplo | `dados/leitura.test.ts:273` (o original guardado no Drive é a GGVP-107) |
| 10 | feito só no servidor de exemplo | `dados/leitura.test.ts:283`; `e2e/documento-medico.e2e.ts:13` |

## Via administrativa no INSS (GGVP-8) · dono: Mateus

Tudo no servidor de verdade. Um limite comum: a fila da Sênior só recebe os casos já gravados no banco (os de exemplo da
semente). O caso que a Documentação libera na tela ainda grava no navegador e não chega lá (GGVP-125, CA3).

### GGVP-23 · Conferência do sênior antes do INSS

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/rotas/conferencia.test.ts:59`; `Conferencia.test.tsx:56` |
| 2 | feito | `conferencia.test.ts:162`; `e2e/via-administrativa.e2e.ts:70` |
| 3 | parcial | o servidor devolve ao Atendimento com o motivo (`conferencia.test.ts:174`; `CentralAtendimento.test.tsx:190`), mas a tarefa "Ajustar o caso" abre "tela não construída" (P2 do roteiro) |
| 4 | feito | `conferencia.test.ts:66`; `Conferencia.test.tsx:66`; `e2e/via-administrativa.e2e.ts:59` |
| 5 | feito | `conferencia.test.ts:71`, `:104`, `:128` e `:150`; `Conferencia.test.tsx:83`; `e2e/via-administrativa.e2e.ts:90` |
| 6 | feito | `conferencia.test.ts:59` |
| 7 | feito | `conferencia.test.ts:162` |
| 8 | feito | `conferencia.test.ts:174`; `Conferencia.test.tsx:107`; `packages/contratos/src/inss.test.ts:46` |
| 9 | feito | `conferencia.test.ts:184` |
| 10 | feito | `conferencia.test.ts:195` |

### GGVP-27 · Protocolar no Meu INSS

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/inss.test.ts:90` e `:107`; `Passos.test.tsx:33`; `e2e/via-administrativa.e2e.ts:7` |
| 2 | feito | `inss.test.ts:136` |
| 3 | feito | `inss.test.ts:116`; `Passos.test.tsx:54` |
| 4 | feito | `inss.test.ts:125`; `contratos/src/inss.test.ts:5` e `:13`; `Passos.test.tsx:41` |
| 5 | feito | `inss.test.ts:90` |
| 6 | feito | `inss.test.ts:151`; `Passos.test.tsx:61` |
| 7 | feito | `inss.test.ts:136` |

### GGVP-31 · Mandar para perícia quando o benefício pede

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `inss.test.ts:176`; `Passos.test.tsx:88`; `e2e/via-administrativa.e2e.ts:36`. A tarefa aberta não tem tela (P1, na Perícia) |
| 2 | feito | `fluxo/juncao-d2.test.ts:44`; `inss.test.ts:187` |
| 3 | feito | `inss.test.ts:187` |
| 4 | feito | ficou fora da change em 07/10 e chegou com a GGVP-38: `rotas/recomendacao-pericia.test.ts:71` e `:88` |
| 5 | feito | `inss.test.ts:169`; `contratos/src/inss.test.ts:23` e `:28`; `Passos.test.tsx:76` |
| 6 | feito | `inss.test.ts:176` |
| 7 | parcial | a junção fecha com o resultado de todas as perícias (`fluxo/juncao-d2.test.ts:52`), mas o resultado registrado na tela da perícia (servidor de exemplo) não chega ao servidor (GGVP-137) |

### GGVP-35 · Vigiar o Meu INSS todo dia

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `fluxo/juncao-d2.test.ts:70` |
| 2 | feito | `rotas/vigilia.test.ts:67` (sem registro completo, a tarefa "Trazer a resposta do INSS" continua aberta) |
| 3 | feito | `rotas/vigilia.test.ts:73` e `:84`; `Vigilia.test.tsx:71`; `e2e/via-administrativa.e2e.ts:112` |
| 4 | removido | tirado do cartão em 01/10 (Q6): a vigília é manual |
| 5 | feito | `vigilia.test.ts:67`; `Vigilia.test.tsx:41` |
| 6 | feito | `vigilia.test.ts:89`; `Vigilia.test.tsx:51` e `:60`; `contratos/src/inss.test.ts:78` |
| 7 | feito | `vigilia.test.ts:60`; `Vigilia.test.tsx:35` |
| 8 | feito | `vigilia.test.ts:89` |
| 9 | removido | tirado do cartão em 01/10 (Q6) |
| 10 | feito | `vigilia.test.ts:73` |

### GGVP-39 · Tratar exigência do INSS

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/exigencia.test.ts:79` e `:94`; `Exigencia.test.tsx:82`; `contratos/src/exigencia.test.ts:7` |
| 2 | feito | `exigencia.test.ts:100` (a tarefa de perícia nasce sem tela, P1) |
| 3 | feito | `exigencia.test.ts:196`; `e2e/via-administrativa.e2e.ts:177` |
| 4 | feito | `exigencia.test.ts:183`; `Exigencia.test.tsx:128`; `contratos/src/exigencia.test.ts:43` |
| 5 | feito | `fluxo/exigencia.test.ts:15` e `:20`; `rotas/exigencia.test.ts:119` |
| 6 | feito | `rotas/exigencia.test.ts:196` |
| 7 | feito | `fluxo/prazo-inss.test.ts:7` a `:21`; `rotas/exigencia.test.ts:72`; `Exigencia.test.tsx:60` |
| 8 | feito | `Exigencia.test.tsx:69`; `contratos/src/exigencia.test.ts:7` e `:17` |
| 9 | feito | `rotas/exigencia.test.ts:79` |
| 10 | feito | `rotas/exigencia.test.ts:111` |
| 11 | feito | `rotas/exigencia.test.ts:156`; `Exigencia.test.tsx:140` |
| 12 | feito | `fluxo/exigencia.test.ts:15` e `:20`; `rotas/exigencia.test.ts:119`; `Exigencia.test.tsx:149` |
| 13 | feito | `rotas/exigencia.test.ts:169`; `Exigencia.test.tsx:140` e `:156` |
| 14 | feito | `fluxo/prazo-inss.test.ts:36` e `:44`; `rotas/exigencia.test.ts:214`, `:236` e `:243`; `Exigencia.test.tsx:95` |

Na Central de exemplo, a tarefa "Cumprir exigência do INSS" do Pedro abre "tela não construída" (P4 do roteiro): ela vem
do servidor de exemplo, não do servidor.

### GGVP-44 · Benefício deferido: prestação de contas e ida ao banco

O fluxo do banco mudou com a GGVP-98 (versão 14 da matriz): o Financeiro recebe, avisa e marca a ida ao banco; o
Atendimento leva o cliente.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/vigilia.test.ts:73` (deferido abre "Prestar contas"); `rotas/prestacao.test.ts:88` (o banco só depois) |
| 2 | feito | `prestacao.test.ts:88` e `:97` |
| 3 | feito | `prestacao.test.ts:167`; `Prestacao.test.tsx:150` |
| 4 | feito | `prestacao.test.ts:80`; `Prestacao.test.tsx:57` |
| 5 | feito | `prestacao.test.ts:80`; `contratos/src/calculo-prestacao.test.ts:5` a `:20`; `Prestacao.test.tsx:57` e `:66` |
| 6 | feito | `prestacao.test.ts:108`; `Prestacao.test.tsx:80` |
| 7 | feito | `prestacao.test.ts:88` |
| 8 | feito | `prestacao.test.ts:120`; `Prestacao.test.tsx:89` |
| 9 | feito | `prestacao.test.ts:120`; `Prestacao.test.tsx:109` |
| 10 | parcial | o agendamento está feito (`prestacao.test.ts:150`; `Prestacao.test.tsx:140`; `e2e/via-administrativa.e2e.ts:220`), mas a tarefa "Levar ao banco" do Atendimento abre "tela não construída" (P3 do roteiro) |
| 11 | feito | `prestacao.test.ts:167`; `Prestacao.test.tsx:150`; `contratos/src/prestacao.test.ts:41` |
| 12 | feito | `prestacao.test.ts:191` |

### GGVP-48 · Indeferido segue para a Justiça

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/vigilia.test.ts:114`; `e2e/via-administrativa.e2e.ts:149` |
| 2 | feito | `vigilia.test.ts:107`; `Vigilia.test.tsx:90` |
| 3 | feito | `vigilia.test.ts:114` |

## Perícia (GGVP-10) · dono: Pedro

As telas da perícia gravam no servidor de exemplo do navegador; a ligação no servidor é a GGVP-137, a IA delas é a
GGVP-139. Do lado do servidor, o INSS e a exigência já abrem a tarefa "Marcar perícia" para o Jurídico administrativo
(`apps/api/src/rotas/inss.ts:360`, `apps/api/src/fluxo/exigencia.ts:102`), e a recomendação da IA sobre a perícia
(GGVP-38) já tem tela (`/casos/:id/pericias`). Mas a tarefa "Marcar perícia" do servidor não tem tela: abre "tela não
construída" (P1 do roteiro). O lembrete ao cliente sai pelo Chatwoot simulado (GGVP-146, parte 4).

### GGVP-49 · Iniciar a tarefa de perícia

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | parcial | no servidor de exemplo: `regras/pericia.test.ts:32`; `dados/pericia.test.ts:68`; `PericiaAberta.test.tsx:20`; `e2e/pericia-iniciar.e2e.ts:12`. No servidor, a tarefa nasce (`inss.test.ts`, decisão de perícia), mas abre "tela não construída" (P1) |
| 2 | parcial | igual ao CA1: `dados/pericia.test.ts:80` e `:91`; `PericiaAberta.test.tsx:57`; no servidor, a tarefa nasce sem tela |
| 3 | feito só no servidor de exemplo | `regras/pericia.test.ts:40`; `dados/pericia.test.ts:98`; `PericiaAberta.test.tsx:20` |
| 4 | feito só no servidor de exemplo | `dados/pericia.test.ts:110`; `PericiaAberta.test.tsx:48` e `:90` |

O chat "Perícias para marcar" lista só as perícias do servidor de exemplo, não a do servidor (P18 do roteiro).

### GGVP-53 · Marcar a perícia com o cliente

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/pericia.test.ts:79`; `dados/pericia.test.ts:126`; `MarcarPericia.test.tsx:31`; `e2e/pericia-marcar.e2e.ts:25` |
| 2 | feito só no servidor de exemplo | `dados/pericia.test.ts:134`; `MarcarPericia.test.tsx:49` e `:137` (a leitura do comprovante é simulada até a GGVP-139) |
| 3 | feito só no servidor de exemplo | `regras/pericia.test.ts:86`; `dados/pericia.test.ts:134` e `:157` |
| 4 | feito só no servidor de exemplo | `regras/pericia.test.ts:86`; `dados/pericia.test.ts:157`; `MarcarPericia.test.tsx:49` |
| 5 | feito só no servidor de exemplo | `MarcarPericia.test.tsx:117`; `e2e/pericia-marcar.e2e.ts:63` |
| 6 | feito só no servidor de exemplo | `dados/pericia.test.ts:167`; `MarcarPericia.test.tsx:77`; `e2e/pericia-marcar.e2e.ts:79` |
| 7 | feito só no servidor de exemplo | `regras/pericia.test.ts:107`; `dados/pericia.test.ts:176`; `MarcarPericia.test.tsx:89` (envio pelo Chatwoot simulado) |
| 8 | feito só no servidor de exemplo | `dados/pericia.test.ts:189`; `MarcarPericia.test.tsx:97`; `e2e/pericia-marcar.e2e.ts:79` |
| 9 | feito só no servidor de exemplo | `regras/pericia.test.ts:99`; `dados/pericia.test.ts:199`; `MarcarPericia.test.tsx:158` |

### GGVP-56 · Reunir o que a perícia pede

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/pericia.test.ts:243`; `e2e/pericia-documentos.e2e.ts:59` |
| 2 | feito só no servidor de exemplo | `dados/pericia.test.ts:255`; `ReunirDocumentosPericia.test.tsx:26`; `e2e/pericia-documentos.e2e.ts:15` |
| 3 | feito só no servidor de exemplo | `dados/pericia.test.ts:237`; `e2e/pericia-documentos.e2e.ts:59` |
| 4 | feito só no servidor de exemplo | `dados/pericia.test.ts:262`; `ReunirDocumentosPericia.test.tsx:39` |
| 5 | feito só no servidor de exemplo | `regras/pericia.test.ts:120`; `dados/pericia.test.ts:269`; `ReunirDocumentosPericia.test.tsx:39` |
| 6 | feito só no servidor de exemplo | `dados/pericia.test.ts:269` e `:287`; `e2e/pericia-documentos.e2e.ts:15` |
| 7 | feito só no servidor de exemplo | `dados/pericia.test.ts:295`; `ReunirDocumentosPericia.test.tsx:75` |

### GGVP-61 · Orientação da perícia, padrão ou pelo perfil do perito

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/pericia.test.ts:326`; `e2e/pericia-orientacao.e2e.ts:14` (a IA é simulada até a GGVP-139) |
| 2 | feito só no servidor de exemplo | `regras/pericia.test.ts:141`; `dados/pericia.test.ts:337` e `:346`; `OrientacaoPericia.test.tsx:18` |
| 3 | parcial | marcado "[v2]" na história. A orientação usa os números do perito do servidor de exemplo (`dados/pericia.test.ts:337`), não a jurimetria do perito do servidor (GGVP-59), e não traz a recomendação da GGVP-38, que já está no servidor |
| 4 | feito só no servidor de exemplo | `regras/pericia.test.ts:150` |
| 5 | feito só no servidor de exemplo | `regras/pericia.test.ts:141`; `dados/pericia.test.ts:346`; `OrientacaoPericia.test.tsx:35`; `e2e/pericia-orientacao.e2e.ts:51` |
| 6 | feito só no servidor de exemplo | `dados/pericia.test.ts:354`; `OrientacaoPericia.test.tsx:35` |
| 7 | feito só no servidor de exemplo | `dados/pericia.test.ts:326` e `:346`; `e2e/pericia-orientacao.e2e.ts:14` |
| 8 | feito só no servidor de exemplo | `regras/pericia.test.ts:150`; `dados/pericia.test.ts:381` |
| 9 | feito só no servidor de exemplo | `dados/pericia.test.ts:337`; `OrientacaoPericia.test.tsx:18` |
| 10 | feito só no servidor de exemplo | `regras/pericia.test.ts:150`; `dados/pericia.test.ts:381` |
| 11 | feito só no servidor de exemplo | `regras/pericia.test.ts:171`; `dados/pericia.test.ts:394`; `OrientacaoPericia.test.tsx:64`; `e2e/pericia-orientacao.e2e.ts:61` |
| 12 | feito só no servidor de exemplo | `regras/pericia.test.ts:177`; `dados/pericia.test.ts:372`; `OrientacaoPericia.test.tsx:18` |

### GGVP-62 · Preparar o cliente

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `OrientarPericia.test.tsx:24`; `e2e/pericia-preparar.e2e.ts:15` |
| 2 | feito só no servidor de exemplo | `dados/pericia.test.ts:426` e `:435`; `OrientarPericia.test.tsx:50` |
| 3 | feito só no servidor de exemplo | `dados/pericia.test.ts:419`; `OrientarPericia.test.tsx:37` |
| 4 | feito só no servidor de exemplo | `dados/pericia.test.ts:441`; `OrientarPericia.test.tsx:64` |
| 5 | feito só no servidor de exemplo | `dados/pericia.test.ts:458`; `e2e/pericia-preparar.e2e.ts:69` |
| 6 | feito só no servidor de exemplo | `dados/pericia.test.ts:441`; `OrientarPericia.test.tsx:64` (quem recusa hoje é o servidor de exemplo; no servidor, com a GGVP-137) |
| 7 | feito só no servidor de exemplo | `dados/pericia.test.ts:426`; `OrientarPericia.test.tsx:50` |
| 8 | feito só no servidor de exemplo | `dados/pericia.test.ts:469`; `OrientarPericia.test.tsx:83`; `e2e/pericia-preparar.e2e.ts:56` |

### GGVP-66 · Comparecimento e remarcação

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/pericia.test.ts:191`; `dados/pericia.test.ts:521`; `ComparecimentoPericia.test.tsx:70`; `e2e/pericia-comparecimento.e2e.ts:60` |
| 2 | feito só no servidor de exemplo | `dados/pericia.test.ts:567`; `ComparecimentoPericia.test.tsx:95`; `e2e/pericia-comparecimento.e2e.ts:79` |
| 3 | feito só no servidor de exemplo | `dados/pericia.test.ts:580`; `ComparecimentoPericia.test.tsx:107` |
| 4 | feito só no servidor de exemplo | `dados/pericia.test.ts:543` e `:567`; `ComparecimentoPericia.test.tsx:83` |
| 5 | feito só no servidor de exemplo | `regras/pericia.test.ts:206`; `dados/pericia.test.ts:543`; `ComparecimentoPericia.test.tsx:83` |
| 6 | feito só no servidor de exemplo | `dados/pericia.test.ts:532`; `ComparecimentoPericia.test.tsx:119` |
| 7 | feito só no servidor de exemplo | `regras/pericia.test.ts:198`; `dados/pericia.test.ts:493` e `:510`; `ComparecimentoPericia.test.tsx:29` e `:37` |
| 8 | feito só no servidor de exemplo | `regras/pericia.test.ts:198`; `dados/pericia.test.ts:493` |
| 9 | feito só no servidor de exemplo | `dados/pericia.test.ts:593`; `ComparecimentoPericia.test.tsx:56`; `e2e/pericia-comparecimento.e2e.ts:46` |

No teste de amanhã, comparecimento e resultado só aparecem mexendo no relógio: as perícias de exemplo são daqui a 9 dias
(P7 do roteiro).

### GGVP-70 · Conferir o resultado e decidir o próximo passo

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/pericia.test.ts:613`; `e2e/pericia-resultado.e2e.ts:36` |
| 2 | feito só no servidor de exemplo | `regras/pericia.test.ts:232`; `dados/pericia.test.ts:640`; `ResultadoPericia.test.tsx:53` |
| 3 | feito só no servidor de exemplo | `dados/pericia.test.ts:656`; `ResultadoPericia.test.tsx:64`; `e2e/pericia-resultado.e2e.ts:68` |
| 4 | feito só no servidor de exemplo | `regras/pericia.test.ts:232`; `dados/pericia.test.ts:675`; `ResultadoPericia.test.tsx:78` |
| 5 | feito só no servidor de exemplo | `regras/pericia.test.ts:215`; `dados/pericia.test.ts:631`; `ResultadoPericia.test.tsx:39` |
| 6 | parcial | no servidor de exemplo o resultado volta à origem (`dados/pericia.test.ts:640` e `:686`); no servidor, o D2 não recebe o resultado da perícia de volta enquanto a perícia não for ligada (GGVP-137) |
| 7 | feito só no servidor de exemplo | coberto pelos testes da GGVP-73: `dados/pericia.test.ts:735`; `ResultadoPericia.test.tsx:125` |
| 8 | feito só no servidor de exemplo | `ResultadoPericia.test.tsx:39`; `e2e/pericia-resultado.e2e.ts:36` (números do perito do servidor de exemplo, não da GGVP-59) |
| 9 | feito só no servidor de exemplo | `dados/pericia.test.ts:701`; `ResultadoPericia.test.tsx:102`; `e2e/pericia-resultado.e2e.ts:90` |

### GGVP-73 · Atualizar o perfil do perito

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/pericia.test.ts:735`; `ResultadoPericia.test.tsx:125` |
| 2 | feito só no servidor de exemplo | `dados/pericia.test.ts:735` |
| 3 | feito só no servidor de exemplo | `dados/pericia.test.ts:735`; `ResultadoPericia.test.tsx:125` |
| 4 | feito só no servidor de exemplo | `dados/pericia.test.ts:762` |
| 5 | feito só no servidor de exemplo | `dados/pericia.test.ts:769` |
| 6 | feito só no servidor de exemplo | `dados/pericia.test.ts:776`; `ResultadoPericia.test.tsx:139` |
| 7 | feito só no servidor de exemplo | `dados/pericia.test.ts:795` |

O perfil do perito do servidor de exemplo e a jurimetria do perito do servidor (GGVP-59) são duas bases separadas até a
GGVP-137.

## Judicialização e vigília (GGVP-9) · dono: Mateus

Tudo no servidor de verdade, com a IA do épico IA jurídica nas telas de publicação, despacho, exigência do juiz e petição.
A IA só roda com a chave configurada no ambiente; sem ela, a tela avisa e a pessoa faz à mão (`apps/api/src/ia/ia.test.ts:57`).
Os feriados não estão cadastrados (GGVP-146, parte 3): a conta de prazo os aceita, mas a lista está vazia (P17 do roteiro).

### GGVP-26 · Receber e casar a publicação pelo número CNJ

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/vigilia/casar.test.ts:24`; `Publicacoes.test.tsx:74`; `e2e/judicializacao.e2e.ts:8` |
| 2 | feito | `casar.test.ts:34` |
| 3 | feito | `casar.test.ts:42`; `rotas/publicacoes.test.ts:51` |
| 4 | feito | `casar.test.ts:34` |
| 5 | feito | `casar.test.ts:42` |
| 6 | feito | `rotas/vigilia-diario.test.ts:63` (os descartes do dia, com o motivo); tela `PainelVigilia.tsx` |
| 7 | feito | `publicacoes.test.ts:42`; `Publicacoes.test.tsx:90` |
| 8 | feito | `publicacoes.test.ts:61` e `:73`; `contratos/src/justica.test.ts:43` e `:50` |
| 9 | feito | `publicacoes.test.ts:61` |
| 10 | feito | `publicacoes.test.ts:51` |
| 11 | feito | `publicacoes.test.ts:61` |
| 12 | feito | `publicacoes.test.ts:42` e `:51`; `Publicacoes.test.tsx:84` |

### GGVP-30 · Vigiar 3 vezes por dia com alarme de falha

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/vigilia-diario.test.ts:46` |
| 2 | feito | `vigilia-diario.test.ts:90`; `vigilia/rodadas.test.ts:37` |
| 3 | feito | `vigilia-diario.test.ts:46` |
| 4 | feito | `vigilia-diario.test.ts:79`; `Publicacoes.test.tsx:74` |
| 5 | feito | `vigilia-diario.test.ts:63` |
| 6 | feito | `vigilia-diario.test.ts:63` |
| 7 | feito | `vigilia-diario.test.ts:79`; `rodadas.test.ts:37` |
| 8 | feito | `rodadas.test.ts:45` e `:55` |
| 9 | feito | `vigilia-diario.test.ts:54`; `rodadas.test.ts:64` |
| 10 | feito | `vigilia/fontes.test.ts:29` e `:33` |
| 11 | feito | `vigilia-diario.test.ts:46` |
| 12 | feito | `vigilia-diario.test.ts:90`; `Publicacoes.test.tsx:84` |

As fontes de publicação de verdade (credenciais no ambiente) não foram conferidas daqui: os testes usam a fonte de exemplo.

### GGVP-34 · Classificar o ato e contar o prazo

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/publicacoes.test.ts:178`; a IA sugere o tipo (épico IA): `Publicacoes.test.tsx:110` e `:124` |
| 2 | feito | `fluxo/prazo-judicial.test.ts:9`, `:14` e `:18`; `publicacoes.test.ts:161` |
| 3 | feito | `publicacoes.test.ts:161`; `Publicacoes.test.tsx:139` |
| 4 | feito | `publicacoes.test.ts:161`; `Publicacoes.test.tsx:131` |
| 5 | feito | `publicacoes.test.ts:186` |
| 6 | feito | `prazo-judicial.test.ts:41`; `publicacoes.test.ts:99` |
| 7 | feito | `prazo-judicial.test.ts:24`, `:29` e `:33` |
| 8 | feito | `prazo-judicial.test.ts:41` |
| 9 | parcial | a conta usa o calendário do tribunal (`prazo-judicial.test.ts:61` e `:66`), mas nenhum feriado ou suspensão está cadastrado (GGVP-146, parte 3) |
| 10 | feito | `publicacoes.test.ts:186` |
| 11 | feito | `fluxo/prazo-inss.test.ts:27` |

### GGVP-37 · Encaminhar pelo tipo de ato

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `vigilia/encaminhar.test.ts:29` |
| 2 | feito | `encaminhar.test.ts:38` |
| 3 | feito | `encaminhar.test.ts:43` |
| 4 | feito | `encaminhar.test.ts:29` |
| 5 | feito | `encaminhar.test.ts:38` |
| 6 | feito | `rotas/publicacoes.test.ts:105` |
| 7 | feito | `encaminhar.test.ts:48` |

### GGVP-52 · Registrar o motivo do indeferimento

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/vigilia.test.ts:107`; `rotas/indeferimento.test.ts:74` |
| 2 | feito | `vigilia.test.ts:114` |
| 3 | feito | `rotas/documentos.test.ts:53` a `:76`; `vigilia.test.ts:114` |
| 4 | feito | `vigilia.test.ts:107` |
| 5 | feito | `vigilia.test.ts:114` |
| 6 | feito | `vigilia.test.ts:114` |
| 7 | feito | `indeferimento.test.ts:74`; `vigilia.test.ts:114` |

### GGVP-54 · A IA analisa o motivo e a sênior despacha

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/indeferimento.test.ts:74`, `:170`, `:185` e `:208`; `Despachar.test.tsx:37`, `:164` e `:191` |
| 2 | feito | `indeferimento.test.ts:101` e `:141`; `Despachar.test.tsx:54` |
| 3 | feito | `indeferimento.test.ts:93`; `Despachar.test.tsx:45` |
| 4 | feito | `indeferimento.test.ts:93` e `:213` |
| 5 | feito | `indeferimento.test.ts:101` |
| 6 | feito | `indeferimento.test.ts:101` e `:141` |
| 7 | feito | `indeferimento.test.ts:101` |
| 8 | feito | `indeferimento.test.ts:86` |
| 9 | feito | `indeferimento.test.ts:93` e `:101` |
| 10 | feito | `indeferimento.test.ts:74`; `vigilia.test.ts:114` |

A análise da IA entrou com o PR da IA (08/10); o P8 do roteiro (despacho sem a análise) fica resolvido onde a chave da IA
estiver configurada.

### GGVP-58 · Laços dos setores até subir o card

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/pendencias.test.ts:117`; `Pendencias.test.tsx:52`; `contratos/src/justica.test.ts:149` |
| 2 | feito | `pendencias.test.ts:126`; `Pendencias.test.tsx:64` |
| 3 | feito | `pendencias.test.ts:126` |
| 4 | feito | `pendencias.test.ts:89` |
| 5 | feito | `pendencias.test.ts:78`; `Pendencias.test.tsx:42` |
| 6 | feito | `pendencias.test.ts:89` |
| 7 | feito | `pendencias.test.ts:117` e `:126`; `Pendencias.test.tsx:73` |
| 8 | feito | `pendencias.test.ts:126` |
| 9 | feito | `pendencias.test.ts:89`; `Despachar.test.tsx:94` |
| 10 | feito | `indeferimento.test.ts:101` (a perícia vai para o Jurídico administrativo; a tarefa nasce sem tela, P1) |
| 11 | feito | `pendencias.test.ts:126`; `Despachar.test.tsx:94` |
| 12 | feito | `pendencias.test.ts:117` |
| 13 | feito | `pendencias.test.ts:78`; `Pendencias.test.tsx:42` |

### GGVP-63 · Pedir a petição e a IA escrever

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/peticao.test.ts:87`; `Peticao.test.tsx:60` |
| 2 | feito | `peticao.test.ts:98`; a versão 1 da IA cita as fontes: `peticao.test.ts:153` e `:181` |
| 3 | feito | `peticao.test.ts:234`; `Peticao.test.tsx:67` e `:200` |
| 4 | faltando (v2 pela spec) | o parecer entra no contexto da IA (`rotas/peticao.ts:264`), mas a jurimetria do juízo não |
| 5 | faltando (v2 pela spec) | o botão não confere o parecer; por caminho, todo caso que chega à Justiça passou pela conferência da Sênior, que exige o parecer |
| 6 | feito | `peticao.test.ts:98`; `Peticao.test.tsx:85` |
| 7 | faltando | a jurimetria entrou (GGVP-15), mas não aparece no pedido da petição nem na página do processo do servidor (depende da GGVP-64, travada) |
| 8 | faltando | idem CA7 |
| 9 | feito | `peticao.test.ts:98` e `:126`; `Peticao.test.tsx:85` |
| 10 | feito | `peticao.test.ts:98` |
| 11 | faltando (fora de 09/10 pela spec) | chat com ação |
| 12 | faltando (fora de 09/10 pela spec) | chat com ação |

O P9 do roteiro (versão 1 vazia) fica resolvido onde a chave da IA estiver configurada: a IA escreve a versão 1
(`peticao.test.ts:153`; `Peticao.test.tsx:37`).

### GGVP-67 · Conferir a petição

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/peticao.test.ts:234` e `:271`; `Peticao.test.tsx:186` e `:200` |
| 2 | feito | `peticao.test.ts:289`; `Peticao.test.tsx:168` |
| 3 | feito | `fluxo/diferenca.test.ts:5` a `:28`; `Peticao.test.tsx:159` |
| 4 | feito | `peticao.test.ts:264`; `Peticao.test.tsx:159` |
| 5 | feito | `peticao.test.ts:289`; `Peticao.test.tsx:168` |
| 6 | feito | `peticao.test.ts:289` e `:304`; `fluxo/pacote.test.ts:9` |
| 7 | feito | `peticao.test.ts:318` |
| 8 | feito | `peticao.test.ts:329` |
| 9 | feito | `peticao.test.ts:289`; `contratos/src/justica.test.ts:184` |
| 10 | feito | `peticao.test.ts:271`; `Peticao.test.tsx:186` |
| 11 | feito | `peticao.test.ts:264` |

### GGVP-71 · Pacote, travas e protocolo no tribunal

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/peticao.test.ts:350` |
| 2 | feito | `peticao.test.ts:350`; `Peticao.test.tsx:258` |
| 3 | feito | `peticao.test.ts:412`; `Peticao.test.tsx:258` |
| 4 | feito | `peticao.test.ts:419`; `Peticao.test.tsx:302` |
| 5 | feito | `peticao.test.ts:403`; `Peticao.test.tsx:281` |
| 6 | feito | `peticao.test.ts:350` e `:403`; `fluxo/travas.test.ts:10` a `:42` |
| 7 | feito | `peticao.test.ts:350` |
| 8 | feito | `peticao.test.ts:419`; `fluxo/pacote.test.ts:9` a `:22` |
| 9 | feito | `peticao.test.ts:437` |
| 10 | feito | `peticao.test.ts:419` |
| 11 | feito | `peticao.test.ts:350`; `Peticao.test.tsx:258` |
| 12 | feito | `peticao.test.ts:289` (a tarefa "Protocolar na Justiça" nasce com a aprovação) |
| 13 | feito | `peticao.test.ts:366` e `:376`; `Peticao.test.tsx:269` |

### GGVP-74 · Vigiar o processo e ler a publicação

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/publicacoes.test.ts:178` |
| 2 | feito | `publicacoes.test.ts:124` e `:135`; o resumo da IA: `Publicacoes.test.tsx:110` |
| 3 | feito | `vigilia/encaminhar.test.ts:38`; `Publicacoes.test.tsx:139` |
| 4 | feito | `Publicacoes.test.tsx:131` |
| 5 | feito | `Publicacoes.test.tsx:159` |
| 6 | feito | `publicacoes.test.ts:99` |
| 7 | feito | `Publicacoes.test.tsx:159` |

### GGVP-79 · Analisar a exigência e criar a tarefa do setor

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/exigencia-juiz.test.ts:72`; `ExigenciaJuiz.test.tsx:89` |
| 2 | feito | `exigencia-juiz.test.ts:64` |
| 3 | feito | `exigencia-juiz.test.ts:135`, `:145` e `:164`; `ExigenciaJuiz.test.tsx:230` |
| 4 | feito | `exigencia-juiz.test.ts:72` (um item por pedido) |
| 5 | feito | `exigencia-juiz.test.ts:56`; `ExigenciaJuiz.test.tsx:82` |
| 6 | feito | `exigencia-juiz.test.ts:64` |
| 7 | feito | `exigencia-juiz.test.ts:72`; `ExigenciaJuiz.test.tsx:89` |
| 8 | feito | `exigencia-juiz.test.ts:99`; `ExigenciaJuiz.test.tsx:156` |
| 9 | feito | `exigencia-juiz.test.ts:105` |
| 10 | feito | `exigencia-juiz.test.ts:72` |
| 11 | feito | `rotas/manifestacao.test.ts:184` |
| 12 | feito | `exigencia-juiz.test.ts:56` |
| 13 | feito | `exigencia-juiz.test.ts:72`; `ExigenciaJuiz.test.tsx:101` |

Na Central de exemplo, a tarefa "Cumprir exigência do juiz" do Antônio abre "tela não construída" (P4 do roteiro): vem do
servidor de exemplo, não do servidor.

### GGVP-83 · Laços dos setores na exigência do juiz

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `exigencia-juiz.test.ts:260` |
| 2 | parcial | o resultado da perícia volta ao card no servidor (`exigencia-juiz.test.ts:271`), mas a perícia é registrada na tela da perícia, que grava no navegador (GGVP-137) |
| 3 | feito | `exigencia-juiz.test.ts:271`; `ExigenciaJuiz.test.tsx:117` |
| 4 | feito | `exigencia-juiz.test.ts:192`; `ExigenciaJuiz.test.tsx:184` |
| 5 | feito | `exigencia-juiz.test.ts:202` |
| 6 | feito | `exigencia-juiz.test.ts:260`; `ExigenciaJuiz.test.tsx:212` |
| 7 | parcial | a tarefa segue com prazo e lembrete (`exigencia-juiz.test.ts:226`), mas não há a espera "esperando o cliente" com retomada quando ele responde |
| 8 | feito | `exigencia-juiz.test.ts:202` |
| 9 | feito | `exigencia-juiz.test.ts:99` |
| 10 | feito | `exigencia-juiz.test.ts:271`; `ExigenciaJuiz.test.tsx:117` |
| 11 | feito | `exigencia-juiz.test.ts:260` |
| 12 | feito | `exigencia-juiz.test.ts:72` (as tarefas "Cumprir exigência do juiz" de cada setor) |
| 13 | feito | `exigencia-juiz.test.ts:192`; `ExigenciaJuiz.test.tsx:184` |
| 14 | feito | `exigencia-juiz.test.ts:218` |

### GGVP-87 · Manifestar e protocolar

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/manifestacao.test.ts:82` |
| 2 | feito | `manifestacao.test.ts:102` |
| 3 | feito | `manifestacao.test.ts:92` e `:102`; `Manifestar.test.tsx:51` |
| 4 | feito | `manifestacao.test.ts:143` e `:148` |
| 5 | feito | `manifestacao.test.ts:72`; `Manifestar.test.tsx:34` |
| 6 | feito | `manifestacao.test.ts:72` |
| 7 | faltando (fora de 09/10 pela spec) | a versão anexada aparece; os tipos de peça da IA ficam para depois |
| 8 | faltando (fora de 09/10 pela spec) | chat com ação |
| 9 | feito | `manifestacao.test.ts:92` |
| 10 | feito | `manifestacao.test.ts:102`; `Manifestar.test.tsx:61` |
| 11 | feito | `manifestacao.test.ts:82` |
| 12 | feito | `manifestacao.test.ts:119`; `Manifestar.test.tsx:67` |
| 13 | feito | `fluxo/prazo-judicial.test.ts:73`; `manifestacao.test.ts:130` |

## Desfecho e financeiro (GGVP-11) · dono: Mateus

Tudo no servidor de verdade. A GGVP-19 entrou pelo PR da IA. A GGVP-100 não entrou: a change do épico diz que ela vai
"no próximo PR" (`openspec/changes/ggvp-11-desfecho-e-financeiro/proposal.md`), e o cartão está em "Em homologação" só
porque um commit mesclado cita a chave (a automação do Jira move toda chave citada).

### GGVP-19 · Estudo de caso do processo perdido

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/rotas/estudo.test.ts:69` e `:112` |
| 2 | feito | `estudo.test.ts:120`; `Estudos.test.tsx:65` |
| 3 | feito | `estudo.test.ts:69`, `:87` e `:102` |
| 4 | feito | `estudo.test.ts:69` |
| 5 | feito | `estudo.test.ts:120`; `Estudos.test.tsx:77` |

Hoje o estudo só nasce pela semente: o "Não recorrer" que o abriria é a GGVP-100, que não existe (`rotas/resultado.ts:32`).

### GGVP-22 · Explicar o resultado ao cliente

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/resultado.test.ts:75` |
| 2 | feito | `resultado.test.ts:90` e `:152`; `ExplicarResultado.test.tsx:66`; `e2e/desfecho.e2e.ts:6` |
| 3 | feito | `resultado.test.ts:46`, `:69` e `:144`; o rascunho da IA: `resultado.test.ts:172`, `:187` e `:206` |
| 4 | feito | `resultado.test.ts:90`, `:120` e `:130` |
| 5 | feito | `resultado.test.ts:46`, `:62` e `:110` |

O P10 do roteiro (resumo vazio) fica resolvido onde a chave da IA estiver configurada.

### GGVP-98 · Financeiro recebe e cliente é avisado

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/prestacao.test.ts:88` |
| 2 | feito | `prestacao.test.ts:167` e `:238` |
| 3 | feito | `prestacao.test.ts:249`; `Prestacao.test.tsx:97` |
| 4 | feito | `prestacao.test.ts:88`, `:257` e `:279` |
| 5 | feito | `prestacao.test.ts:167` |
| 6 | parcial | `prestacao.test.ts:150`; `Prestacao.test.tsx:119`. A tarefa "Levar ao banco" que o Atendimento recebe abre "tela não construída" (P3 do roteiro) |
| 7 | feito | `prestacao.test.ts:191` |
| 8 | feito | `prestacao.test.ts:135`; `banco/migracoes.test.ts:109` |
| 9 | feito | `prestacao.test.ts:207`, `:224` e `:267`; `Prestacao.test.tsx:131`; `e2e/via-administrativa.e2e.ts:220` |

### GGVP-100 · Improcedente: decidir se recorre

Sem spec e sem código. O cartão ainda tem uma dúvida aberta (Q26: quem escreve e protocola o recurso).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | faltando | não há a decisão "Vale recorrer?" |
| 2 | faltando | o "Não recorrer" não existe; o estudo de caso nasce pela semente |
| 3 | faltando | — |
| 4 | faltando | — |
| 5 | faltando | — |
| 6 | faltando | — |
| 7 | faltando | — |
| 8 | faltando | a proposta da IA com a chance de êxito também não existe aqui (a chance só está na conferência da Sênior, GGVP-131) |

## Relacionamento com o cliente (GGVP-12) · dono: Pedro

Tudo no servidor de exemplo do navegador: conversa, gravação, transcrição, o que mudou, conferência com desfazer,
pendência, mensagens e segurança. A ligação no servidor é a GGVP-138; a IA, a GGVP-140; a transcrição de verdade, a
GGVP-133; o Chatwoot de verdade, a GGVP-146 (parte 4).

### GGVP-76 · Registrar a conversa por telefone ou presencial

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/conversa.test.ts:53`; `Conversa.test.tsx:46`; `e2e/conversa.e2e.ts:14` |
| 2 | feito só no servidor de exemplo | `dados/conversa.test.ts:79`; `Conversa.test.tsx:82` e `:131`; `e2e/conversa.e2e.ts:63` |
| 3 | feito só no servidor de exemplo | `regras/conversa.test.ts:30` e `:52`; `dados/conversa.test.ts:39`; `RegistrarConversa.test.tsx:24` |
| 4 | feito só no servidor de exemplo | `regras/conversa.test.ts:36`; `RegistrarConversa.test.tsx:40` e `:51`; `e2e/conversa.e2e.ts:14` e `:63` |
| 5 | feito só no servidor de exemplo | `dados/conversa.test.ts:53`; `Conversa.test.tsx:46` |
| 6 | feito só no servidor de exemplo | `dados/conversa.test.ts:64`; `Transcricoes.test.tsx:109` (transcrição simulada até a GGVP-133) |
| 7 | feito só no servidor de exemplo | `dados/conversa.test.ts:103`; `e2e/conversa.e2e.ts:187` |
| 8 | feito só no servidor de exemplo | `dados/conversa.test.ts:114`; `CentralAtendimento.test.tsx:167`; `e2e/conversa.e2e.ts:63` |
| 9 | feito só no servidor de exemplo | `dados/conversa.test.ts:64`; `FichaCliente.test.tsx:33`; `e2e/conversa.e2e.ts:14` |

### GGVP-80 · Transcrever e identificar o que mudou

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/conversa.test.ts:170`; `e2e/conversa.e2e.ts:14` |
| 2 | feito só no servidor de exemplo | `regras/conversa.test.ts:73`; `dados/conversa.test.ts:152` |
| 3 | feito só no servidor de exemplo | `dados/conversa.test.ts:188` (a senha dita vai para o cofre do servidor de exemplo; o cofre de verdade é a GGVP-146, parte 1) |
| 4 | feito só no servidor de exemplo | `dados/conversa.test.ts:197`; `e2e/conversa.e2e.ts:63` |
| 5 | feito só no servidor de exemplo | `regras/conversa.test.ts:73`; `dados/conversa.test.ts:152` |
| 6 | feito só no servidor de exemplo | `dados/conversa.test.ts:170`; `Transcricoes.test.tsx:123` |
| 7 | feito só no servidor de exemplo | `dados/conversa.test.ts:188` (o trecho vira "[senha retirada: vai ao cofre]"); `e2e/conversa.e2e.ts:14` |
| 8 | feito só no servidor de exemplo | `dados/conversa.test.ts:188`; `e2e/conversa.e2e.ts:14` e `:63` |
| 9 | feito só no servidor de exemplo | `dados/conversa.test.ts:214` |

### GGVP-84 · Atualizar ficha e processo com desfazer

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/conversa.test.ts:234`; `ConferirConversa.test.tsx:51` |
| 2 | feito só no servidor de exemplo | `regras/conversa.test.ts:145`; `dados/conversa.test.ts:292`; `HistoricoDeVersoes.test.tsx:28` e `:43` |
| 3 | feito só no servidor de exemplo | `dados/conversa.test.ts:273` |
| 4 | feito só no servidor de exemplo | `regras/conversa.test.ts:122`; `ConferirConversa.test.tsx:35` e `:86` |
| 5 | feito só no servidor de exemplo | `regras/conversa.test.ts:122`; `ConferirConversa.test.tsx:35` |
| 6 | feito só no servidor de exemplo | `dados/conversa.test.ts:234`; `ConferirConversa.test.tsx:51` |
| 7 | feito só no servidor de exemplo | `dados/conversa.test.ts:273`; `ConferirConversa.test.tsx:51` |
| 8 | feito só no servidor de exemplo | `regras/conversa.test.ts:114`; `dados/conversa.test.ts:281`; `ConferirConversa.test.tsx:94` |
| 9 | feito | `apps/web/src/desfazer.test.tsx:42`, `:60` e `:74`; `e2e/conversa.e2e.ts:91` |

### GGVP-88 · Pendência da conversa vira tarefa

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/conversa.test.ts:171`; `dados/conversa.test.ts:326`; `ConferirConversa.test.tsx:137` |
| 2 | feito só no servidor de exemplo | `dados/conversa.test.ts:352`; `ConferirConversa.test.tsx:177` |
| 3 | feito só no servidor de exemplo | `regras/conversa.test.ts:160`; `ConferirConversa.test.tsx:162` |
| 4 | feito só no servidor de exemplo | `dados/conversa.test.ts:326`; `CentralAtendimento.test.tsx:179`; `e2e/conversa.e2e.ts:149` |
| 5 | feito só no servidor de exemplo | `regras/conversa.test.ts:181`; `dados/conversa.test.ts:358` |

### GGVP-102 · Mensagens ao cliente com modelo e registro

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/mensagens.test.ts:5`; `dados/mensagens.test.ts:15`; `MensagemAoCliente.test.tsx:24`; `e2e/mensagens.e2e.ts:11` |
| 2 | feito só no servidor de exemplo | `dados/mensagens.test.ts:66` |
| 3 | feito só no servidor de exemplo | `regras/mensagens.test.ts:24`; `MensagemAoCliente.test.tsx:39`; `e2e/mensagens.e2e.ts:28` |
| 4 | feito só no servidor de exemplo | `dados/mensagens.test.ts:66` |
| 5 | feito só no servidor de exemplo | `dados/mensagens.test.ts:78`; `MensagemAoCliente.test.tsx:70`; `ConviteChatwoot.test.tsx:63`; `e2e/mensagens.e2e.ts:42` |
| 6 | feito só no servidor de exemplo | `regras/mensagens.test.ts:51`; `dados/mensagens.test.ts:53`; `MensagemAoCliente.test.tsx:61` (Chatwoot simulado) |
| 7 | feito só no servidor de exemplo | `regras/mensagens.test.ts:5`; `dados/mensagens.test.ts:33`; `MensagemAoCliente.test.tsx:50` |
| 8 | feito só no servidor de exemplo | `dados/mensagens.test.ts:45` |
| 9 | feito só no servidor de exemplo | `regras/mensagens.test.ts:37`; `dados/mensagens.test.ts:90`; `MensagemAoCliente.test.tsx:39` |
| 10 | feito só no servidor de exemplo | `ConviteChatwoot.test.tsx:52` (Chatwoot simulado) |

### GGVP-111 · Terceiro não se passa pelo cliente para obter informação ou mudar dados

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/seguranca.test.ts:14`; `dados/seguranca.test.ts:37` e `:56`; `ConferirConversa.test.tsx:203` e `:226`; `FichaCliente.test.tsx:216`; `e2e/seguranca.e2e.ts:9` |
| 2 | feito só no servidor de exemplo | `regras/seguranca.test.ts:44`; `dados/seguranca.test.ts:93`; `e2e/seguranca.e2e.ts:25` |
| 3 | feito só no servidor de exemplo | `regras/seguranca.test.ts:29`; `Conversa.test.tsx:167`; `e2e/seguranca.e2e.ts:59` |
| 4 | feito | `regras/mensagens.test.ts:62`; `e2e/seguranca.e2e.ts:73` |
| 5 | feito só no servidor de exemplo | `regras/seguranca.test.ts:33`; `dados/seguranca.test.ts:62` e `:83`; `CartaoDadosBancarios.test.tsx:19` |
| 6 | parcial | só um lembrete na tela das mensagens da perícia (`componentes/MensagemAoCliente.tsx:149`), sem teste; a ligação de orientação da perícia não pede nem registra a verificação |
| 7 | feito só no servidor de exemplo | `LaudoPeloChat.test.tsx:62`; `Conversa.test.tsx:167` |
| 8 | feito só no servidor de exemplo | `regras/seguranca.test.ts:23`; `ConferirConversa.test.tsx:203`; `Conversa.test.tsx:175` |

## Experiência por perfil e chat (GGVP-5) · dono: Pedro

As Centrais juntam as tarefas do servidor e as do servidor de exemplo. O chat responde pelo motor do navegador: o chat
pelo motor de IA de verdade é a GGVP-142. A página do caso lê o servidor de exemplo: a página do processo pelo banco é a
GGVP-146 (parte 5).

### GGVP-78 · Tela inicial "O que é meu hoje" por perfil

Sem spec própria no repositório: os critérios são os do cartão no Jira.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | a Central do Atendimento: `CentralAtendimento.test.tsx:20` e `:190`; cada perfil vê só a sua raia no servidor: `apps/api/src/rotas/inss.test.ts:98` |
| 2 | parcial | o servidor põe as urgentes no topo (`apps/api/src/rotas/inss.ts:191`) e a linha avisa a urgência (`TarefaLinha.test.tsx:43`); nenhum teste prova a ordem da fila |
| 3 | parcial | a linha abre o passo (`TarefaLinha.test.tsx:33`), mas várias tarefas abrem "tela não construída": a perícia do servidor (P1), "Levar ao banco" (P3) e quatro tarefas de exemplo (P4) |
| 4 | parcial | a Central provisória diz "Nada na sua fila agora" (P11), sem o atalho para buscar cliente; nas Centrais de Atendimento, Advogada e Jurídico administrativo não há estado vazio |
| 5 | feito | `TarefaLinha.test.tsx:24`, `:33` e `:51` |
| 6 | parcial | Atendimento, Advogada e Jurídico administrativo têm o chat abaixo da busca (`CentralAtendimento.test.tsx:113` e `:156`); Sênior, Financeiro e Sócio ficam na Central provisória, sem chat nem busca (P11) |
| 7 | feito | `TarefaLinha.test.tsx:24` |
| 8 | parcial | o servidor junta vencidas e de hoje como "urgentes" (`inss.ts:127`); as de hoje não vêm separadas logo depois das vencidas |
| 9 | faltando | a busca não consulta nada (`componentes/CampoBusca.tsx:5`) |
| 10 | feito | a tarefa concluída sai da fila: `inss.test.ts:136`; `CentralAtendimento.test.tsx:167` |
| 11 | feito só no servidor de exemplo | o protocolo (D2.02) vem do servidor (`inss.test.ts:90`); as tarefas da perícia vêm do servidor de exemplo (`e2e/pericia-marcar.e2e.ts:25`), até a GGVP-137 |
| 12 | faltando | "Tarefas do setor: tela ainda não construída" nas Centrais (P6); o líder não distribui |

### GGVP-82 · Conversar com o portal em linguagem natural

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `dados/chat.test.ts:30`, `:40` e `:48`; `ChatDoPortal.test.tsx:27`; `e2e/chat.e2e.ts:18` |
| 2 | feito só no servidor de exemplo | `dados/chat.test.ts:53`; `ChatDoPortal.test.tsx:36`; `e2e/chat.e2e.ts:40` |
| 3 | feito só no servidor de exemplo | `dados/chat.test.ts:107`; `ChatDoPortal.test.tsx:54` e `:83` |
| 4 | feito só no servidor de exemplo | `regras/chat.test.ts:44`, `:54` e `:61`; `dados/chat.test.ts:118`; `ChatDoPortal.test.tsx:96` |
| 5 | feito só no servidor de exemplo | `dados/chat.test.ts:127`; `ChatDoPortal.test.tsx:54` |
| 6 | parcial | o lugar do chat está certo onde há Central (`ChatDoPortal.test.tsx:154` e `:173`; `CentralAtendimento.test.tsx:156`); Sênior, Financeiro e Sócio ainda sem chat (P11) |
| 7 | feito só no servidor de exemplo | `regras/chat.test.ts:71`, `:76` e `:84`; `dados/chat.test.ts:141` |
| 8 | feito só no servidor de exemplo | `regras/chat.test.ts:107`; `dados/chat.test.ts:158`; `ChatDoPortal.test.tsx:104` |
| 9 | feito só no servidor de exemplo | `regras/chat.test.ts:91` e `:100`; `dados/chat.test.ts:167` |
| 10 | feito só no servidor de exemplo | `dados/chat.test.ts:64`; `ChatDoPortal.test.tsx:44`; `e2e/chat.e2e.ts:56` |
| 11 | parcial | `dados/chat.test.ts:76`: lista só as perícias do servidor de exemplo, não a do servidor (P18) |
| 12 | feito só no servidor de exemplo | `dados/chat.test.ts:184` a `:227`; `ChatDoPortal.test.tsx:118` e `:134` |

### GGVP-86 · Navegar pelo caso numa linha só

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | `regras/caso.test.ts:18` e `:29`; `dados/caso.test.ts:22`; `PaginaDoCaso.test.tsx:19`; `e2e/caso.e2e.ts:13` |
| 2 | feito só no servidor de exemplo | `regras/caso.test.ts:43`; `dados/caso.test.ts:37` |
| 3 | feito só no servidor de exemplo | `regras/caso.test.ts:50`; `dados/caso.test.ts:46`; `PaginaDoCaso.test.tsx:45` |
| 4 | feito só no servidor de exemplo | `dados/caso.test.ts:53`; `PaginaDoCaso.test.tsx:60` |
| 5 | feito só no servidor de exemplo | `dados/caso.test.ts:61`; `PaginaDoCaso.test.tsx:69` |
| 6 | feito só no servidor de exemplo | `regras/caso.test.ts:92`; `dados/caso.test.ts:67`; `PaginaDoCaso.test.tsx:77` |
| 7 | feito só no servidor de exemplo | `dados/caso.test.ts:80`; `PaginaDoCaso.test.tsx:89`; `e2e/caso.e2e.ts:46` |
| 8 | feito só no servidor de exemplo | `dados/caso.test.ts:89` |
| 9 | feito só no servidor de exemplo | `dados/caso.test.ts:97` |
| 10 | feito só no servidor de exemplo | `regras/caso.test.ts:61`; `dados/caso.test.ts:107`; `PaginaDoCaso.test.tsx:98` |
| 11 | feito só no servidor de exemplo | `dados/caso.test.ts:117` |
| 12 | feito só no servidor de exemplo | `regras/caso.test.ts:71`; `dados/caso.test.ts:126`; `PaginaDoCaso.test.tsx:109` e `:117` |
| 13 | feito só no servidor de exemplo | `regras/caso.test.ts:81`; `dados/caso.test.ts:135`; `e2e/caso.e2e.ts:46` |

## Fundação técnica (GGVP-2) e processo (GGVP-3) · dono: Mateus

Tudo no servidor de verdade (`apps/api`), com testes no banco embutido.

### GGVP-117 · Entrar no portal com e-mail e senha

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/sessao/rotas.test.ts:39` e `:51`; `sessao/regras.test.ts:28`; `Entrar.test.tsx:21`; `e2e/login.e2e.ts:12` |
| 2 | feito | `sessao/rotas.test.ts:89` e `:99`; `sessao/regras.test.ts:7` a `:19`; `e2e/login.e2e.ts:39` |
| 3 | feito | `App.test.tsx:224`; `Entrar.test.tsx:55`; `e2e/login.e2e.ts:28` |
| 4 | feito | `sessao/rotas.test.ts:121`; `App.test.tsx:210`; `e2e/login.e2e.ts:54` |
| 5 | feito | `sessao/rotas.test.ts:133` e `:143` |
| 6 | feito | `sessao/rotas.test.ts:152`; `banco/usuarios.test.ts:14` |
| 7 | feito | `sessao/rotas.test.ts:163` |

### GGVP-118 · Base de código: stack (ADR-001), monorepo, banco de dados e CI

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `docs/decisoes/ADR-001-base-de-codigo-e-stack.md` (documento, sem teste) |
| 2 | feito | `pnpm dev` na raiz sobe API e tela com o banco embutido, sem Docker (usado nesta conferência) |
| 3 | feito | `apps/api`, `apps/web`, `packages/contratos`, `packages/campos` |
| 4 | feito | `banco/migracoes.test.ts:32` |
| 5 | feito | `.github/workflows/ci.yml`: typecheck, lint, testes, Playwright e varredura de segredos |
| 6 | feito | `packages/campos` (`packages/campos/test/campos.test.ts`); `packages/contratos/src/contratos.test.ts` |

### GGVP-119 · Ambiente: homologação no Coolify com deploy a cada merge e Postgres de dev por pessoa

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | parcial | o caminho existe no repositório desde 08/10: depois da CI verde na `main`, o workflow `.github/workflows/imagem.yml` publica a imagem e chama o Coolify (`docs/infra/homologacao.md`, seções 2 a 5). A tarefa "ligar a homologação antes de 09/10" segue aberta (`openspec/changes/ggvp-2-fundacao-tecnica/tasks.md`, 2.6). Não abri a homologação daqui |
| 2 | parcial | depende da tarefa 2.6, que se confere abrindo o endereço da homologação |
| 3 | parcial | o banco da homologação passou para o Supabase (doc, seção 1); o `.env.example` sem senha não existe (tarefa 2.4 aberta) |
| 4 | feito | sem `DATABASE_URL`, o portal local sobe com o banco embutido; com ela, usa o banco do dev (`apps/api/src/servidor.test.ts`) |
| 5 | feito | `docs/infra/homologacao.md`, seção 6: migração com erro ou banco fora do ar, o Coolify mantém a versão anterior; `HEALTHCHECK` do `Dockerfile` (configuração, sem teste do deploy) |
| 6 | feito | segredos só no Coolify e nos segredos do GitHub (doc, seções 3 e 4; `imagem.yml`); varredura de segredos no CI (`ci.yml`) |

### GGVP-126 · Homologação com usuários e dados de teste

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `banco/homologacao.test.ts:51` |
| 2 | feito | `banco/homologacao.test.ts:62` e `:70` |
| 3 | parcial | `banco/homologacao.test.ts:38` cobre os passos do servidor; Recepção, Abertura, documentação médica, Perícia e Relacionamento ainda sem caso no banco (tarefa 6.4 aberta, depende da GGVP-125 e da GGVP-132) |
| 4 | feito | `banco/homologacao.test.ts:81` |
| 5 | feito | `banco/homologacao.test.ts:32` e `:103` |

### GGVP-128 · Testes de tela e revisão automática completas na verificação do GitHub

Sem spec própria no repositório: os critérios são os do cartão no Jira.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `.github/workflows/ci.yml`, job "Testes de tela (Playwright)" |
| 2 | feito | `ci.yml`, passo "Relatório do Playwright, quando falha" |
| 3 | feito | `.github/workflows/claude-review.yml`, `--max-turns 40` |
| 4 | feito | branch própria `ci/GGVP-128-testes-de-tela-na-verificacao` |

### GGVP-129 · Modelo de dados do portal: tabelas de todos os épicos, RLS, travas no banco e LGPD

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `banco/migracoes.test.ts:32` |
| 2 | feito | `banco/migracoes.test.ts:42` |
| 3 | feito | `banco/migracoes.test.ts:52` e `:58` |
| 4 | feito | `banco/migracoes.test.ts:67` e `:71` |
| 5 | feito | `banco/migracoes.test.ts:78` |
| 6 | feito | `banco/migracoes.test.ts:83` |
| 7 | feito | `banco/migracoes.test.ts:91` e `:109` |
| 8 | feito | tabela própria com leitura registrada: `banco/migracoes.test.ts:58`; `rotas/conferencia.test.ts:77` |
| 9 | feito | `apps/api/src/cofre.test.ts:11`, `:17` e `:33` |

### GGVP-96 · Perfis e permissões

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `packages/contratos/src/permissoes.test.ts:44` |
| 2 | feito | `permissoes.test.ts:19`; `sessao/rotas.test.ts:202` |
| 3 | feito | `banco/usuarios.test.ts:40` (pela linha de comando; não há tela para o Sócio atribuir perfis, P15 do roteiro) |
| 4 | feito | `permissoes.test.ts:23` |
| 5 | feito | `permissoes.test.ts:27` |
| 6 | feito | `permissoes.test.ts:34`; `rotas/inss.test.ts:176` |
| 7 | feito | `permissoes.test.ts:38` |
| 8 | feito | `sessao/rotas.test.ts:202` |
| 9 | feito | `EntrarComo.test.tsx:55` e `:67`; `sessao/rotas.test.ts:202` |
| 10 | feito | `sessao/rotas.test.ts:180`; `permissoes.test.ts:61`; `EntrarComo.test.tsx:19`; `e2e/perfis.e2e.ts:6` |
| 11 | feito | `EntrarComo.test.tsx:55`; `e2e/via-administrativa.e2e.ts:52` |
| 12 | feito | `permissoes.test.ts:44` e `:48`; `rotas/conferencia.test.ts:77`; `Conferencia.test.tsx:74` |
| 15 | feito | `permissoes.test.ts:7` e `:108` |
| 16 | feito | `banco/migracoes.test.ts:109` |

A história não tem CA13 nem CA14 (a numeração pula na spec).

## Garantia e governança (GGVP-13) · dono: Mateus

Tudo no servidor de verdade. Vários critérios valem nas telas de outras histórias: a tabela cita o teste da história do
passo. Alguns a própria spec deixou para depois de 09/10 (chat com ação, atribuição pelo líder, modelos do ZapSign):
aparecem como "faltando (fora de 09/10 pela spec)" e não entram nas lacunas graves.

### GGVP-25 · Regras objetivas calculadas por código

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/fluxo/regras.test.ts:20`, `:24` e `:29` |
| 2 | feito | `fluxo/regras.test.ts:35` e `:49` |
| 3 | feito | `fluxo/regras.test.ts:64` e `:78` |
| 4 | feito | `fluxo/regras.test.ts:92`; `rotas/regras.test.ts:50`; `contratos/src/governanca.test.ts:23` |
| 5 | feito | `fluxo/regras.test.ts:106` a `:132` |
| 6 | feito | `fluxo/regras.test.ts:139`; `rotas/regras.test.ts:37` |
| 7 | parcial | o servidor calcula (`rotas/regras.test.ts:37`), mas as telas médicas do Pedro (parecer, linha da deficiência) ainda calculam no navegador, com a regra própria, e não chamam esta rota (GGVP-132) |
| 8 | feito | `fluxo/regras.test.ts:139` |

### GGVP-68 · Lista de exigências com prazo, responsável e prova

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | a advogada distribui um item por exigência: `rotas/exigencia-juiz.test.ts:72`; a IA sugere os itens (GGVP-79): `exigencia-juiz.test.ts:135` e `:164` |
| 2 | feito | `exigencia-juiz.test.ts:72` e `:192`; no INSS: `rotas/exigencia.test.ts:79` |
| 3 | feito | `rotas/manifestacao.test.ts:72` e `:184`; no INSS: `exigencia.test.ts:169`; `ExigenciaJuiz.test.tsx:117` |
| 4 | feito | `exigencia.test.ts:225`; `manifestacao.test.ts:143` |
| 5 | feito | `ExigenciaJuiz.test.tsx:148`; `exigencia-juiz.test.ts:260` |
| 6 | feito | `exigencia.test.ts:79` (GGVP-39) |
| 7 | feito | `exigencia.test.ts:196` (GGVP-39) |
| 8 | feito | `exigencia.test.ts:183` (GGVP-39) |
| 9 | feito | `exigencia-juiz.test.ts:64` |
| 10 | feito | `exigencia-juiz.test.ts:72`; `ExigenciaJuiz.test.tsx:117` |
| 11 | feito | `exigencia-juiz.test.ts:99` (a tarefa de perícia nasce sem tela, P1) |
| 12 | feito | `manifestacao.test.ts:206` |
| 13 | feito | `manifestacao.test.ts:72` (a versão pode ser anexada antes); a minuta pela IA: `rotas/peticao.test.ts:153` |
| 14 | feito | `exigencia-juiz.test.ts:271`; `ExigenciaJuiz.test.tsx:117` |
| 15 | feito | `manifestacao.test.ts:143` (sobe ao topo com a tela da exigência) |

### GGVP-94 · Tarefa com laço, lembrete e escalonamento

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `fluxo/lembrete.test.ts:9`, `:15` e `:22` |
| 2 | feito | `exigencia-juiz.test.ts:202`; `rotas/pendencias.test.ts:89`; `fluxo/exigencia.test.ts:15` |
| 3 | feito | `exigencia.test.ts:119`; `Exigencia.test.tsx:149` |
| 4 | feito | `exigencia-juiz.test.ts:271`; `pendencias.test.ts:126` |
| 5 | faltando (fora de 09/10 pela spec) | proposta do Fernando, não aprovada |
| 6 | feito | `exigencia-juiz.test.ts:226`; `ExigenciaJuiz.test.tsx:193` |
| 7 | feito | `exigencia-juiz.test.ts:260`; `pendencias.test.ts:117` |
| 8 | feito | `exigencia-juiz.test.ts:235`; `pendencias.test.ts:104`; `Exigencia.test.tsx:105` |
| 9 | feito | `exigencia-juiz.test.ts:235`; `exigencia.test.ts:129`; `contratos/src/governanca.test.ts:45` |
| 10 | feito | `exigencia-juiz.test.ts:235`; `pendencias.test.ts:104` |
| 11 | feito | `exigencia-juiz.test.ts:226`; `exigencia.test.ts:129` |
| 12 | faltando (fora de 09/10 pela spec) | o portal não envia nada sozinho nesta entrega, então não há envio que falhe |

Os laços das telas do Pedro (cobrança de documento, complemento médico, remarcação da perícia, pendência da conversa)
seguem a regra do servidor de exemplo, não esta (GGVP-125, GGVP-132, GGVP-137, GGVP-138).

### GGVP-99 · Histórico de quem fez o quê, incluindo a IA

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | faltando (fora de 09/10 pela spec) | a IA não muda campo, só sugere (`ia/ia.test.ts:28`); não há o que desfazer |
| 2 | parcial | a chamada à IA e a escolha da pessoa ficam guardadas (`ia/ia.test.ts:28`; `exigencia-juiz.test.ts:164`; `rotas/ia.test.ts:43`), mas a linha do histórico do caso não mostra "sugestão recusada" |
| 3 | feito | `rotas/historico.test.ts:46` |
| 4 | faltando (fora de 09/10 pela spec) | o chat só consulta até 09/10 |
| 5 | faltando (fora de 09/10 pela spec) | a atribuição pelo líder não existe (P6) |
| 6 | parcial | a conferência da conversa só grava depois de a pessoa conferir, mas no servidor de exemplo (GGVP-84, `dados/conversa.test.ts:234`); no servidor, com a GGVP-138 |
| 7 | feito | `historico.test.ts:46`; `Historico.test.tsx:34` |
| 8 | feito | antes e depois: `rotas/configuracao.test.ts:58`; segredo só o fato: `rotas/cofre.test.ts:54` e `:105` |
| 9 | feito | `historico.test.ts:64`; `banco/migracoes.test.ts:52` |
| 10 | feito | correção como versão nova: `rotas/prestacao.test.ts:108`; `peticao.test.ts:318` |
| 11 | feito | `historico.test.ts:46`; `Historico.test.tsx:34` |
| 12 | feito | `historico.test.ts:73`; `Historico.test.tsx:45` e `:56` |
| 13 | feito | a trava do banco: `banco/migracoes.test.ts:52` |
| 14 | feito | `historico.test.ts:105`; `Historico.test.tsx:72` |

Os rótulos de alguns eventos aparecem sem acento na tela (P19 do roteiro).

### GGVP-103 · Cofre de senhas do gov.br

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | a senha dita vai ao cofre na conversa e na entrevista do navegador (`dados/conversa.test.ts:188`); no servidor, com a GGVP-133 e a GGVP-146 (parte 1) |
| 2 | feito | `rotas/cofre.test.ts:68`; `rotas/inss.test.ts:151` |
| 3 | feito | a IA não tem caminho até o cofre: só a rota de revelar abre (`cofre.test.ts:68`) |
| 4 | feito | `cofre.test.ts:54`; `Historico.test.tsx:89` |
| 5 | feito | `cofre.test.ts:68` |
| 6 | feito | `cofre.test.ts:68` e `:91` |
| 7 | feito | `cofre.test.ts:80` |
| 8 | feito | `cofre.test.ts:54`; `apps/api/src/cofre.test.ts:11` e `:17` |
| 9 | feito | `cofre.test.ts:105` |
| 10 | feito | `cofre.test.ts:118` |
| 11 | feito | `cofre.test.ts:54` |

Nas telas da Recepção, a senha do gov.br da ficha ainda some no navegador: `dados/cofre.ts` e `dados/renovacao.ts`
descartam o valor (GGVP-146, parte 1).

### GGVP-104 · Configuração do escritório

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/configuracao.test.ts:75`; `Configuracao.test.tsx:48` |
| 2 | faltando (fora de 09/10 pela spec) | modelos de contrato e ZapSign real |
| 3 | feito | `configuracao.test.ts:58` e `:99`; `Configuracao.test.tsx:71` |
| 4 | feito | `configuracao.test.ts:58`; `Configuracao.test.tsx:37` |
| 5 | feito | `configuracao.test.ts:113` |
| 6 | feito | `configuracao.test.ts:75` |
| 7 | parcial | a conferência da Sênior barra sem o kit (`rotas/conferencia.test.ts:92`, G1); a liberação da Documentação usa o checklist do navegador, não o kit do servidor (GGVP-125) |
| 8 | faltando (fora de 09/10 pela spec) | entra com a geração do contrato no servidor |
| 9 | faltando (fora de 09/10 pela spec) | idem |
| 10 | faltando (fora de 09/10 pela spec) | ZapSign real fora de 09/10 |

A tela mostra códigos e "Versão 1, desde 31/12/1999" no kit (P16 do roteiro).

### GGVP-109 · Ninguém pula um portão de aprovação: validação no servidor

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `rotas/gestao.test.ts:43`; `rotas/inss.test.ts:116` |
| 2 | parcial | aprovar sem kit, parecer ou perfil é recusado (`conferencia.test.ts:92` e `:104`; `sessao/rotas.test.ts:202`); liberar ao Jurídico ainda é só no servidor de exemplo, e pedir a petição não confere o parecer (ver GGVP-33) |
| 3 | feito | `Manifestar.test.tsx:42`; `Passos.test.tsx:41`; `Prestacao.test.tsx:66` |
| 4 | feito | `rotas/prestacao.test.ts:182` |
| 5 | feito | `inss.test.ts:116` |
| 6 | feito | `peticao.test.ts:87`; `manifestacao.test.ts:72` e `:206` |
| 7 | feito | `manifestacao.test.ts:184`; `exigencia.test.ts:169` |
| 8 | faltando (fora de 09/10 pela spec) | o chat só consulta; no chat de exemplo, a recusa do portão já aparece (`regras/chat.test.ts:44`) |
| 9 | feito | `gestao.test.ts:43`, `:52` e `:66`; `Tentativas.test.tsx:14`; `e2e/governanca.e2e.ts:6` |

## IA jurídica (GGVP-14) · dono: Mateus

A plataforma de IA está no servidor (`apps/api/src/ia/`): a OpenAI sugere, a Mistral lê documento, toda chamada fica
registrada, e sem chave nada trava. As telas do Pedro ainda usam a IA simulada do navegador (GGVP-134, GGVP-139,
GGVP-140). O chat com ação ficou fora de 09/10. A GGVP-41 a própria change deixou "para depois, quando o acervo tiver
dado" e está em "Em homologação" só porque commits mesclados citam a chave.

### GGVP-38 · Recomendação sobre a perícia

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/rotas/recomendacao-pericia.test.ts:71`; `Pericias.test.tsx:42` |
| 2 | faltando | sem a jurimetria do perito, que depende de identificar o perito (GGVP-59, travada) |
| 3 | feito | `recomendacao-pericia.test.ts:71` |
| 4 | feito | `recomendacao-pericia.test.ts:88`; `Pericias.test.tsx:67` |
| 5 | feito | a recomendação não lê o comprovante; quem lê é a tela da perícia, que não tira o perito (`dados/pericia.test.ts:134`, servidor de exemplo) |
| 6 | parcial | a recomendação sai sem a jurimetria e nada trava (`recomendacao-pericia.test.ts:71`); a pergunta de um clique para identificar o perito só existe na página do caso do servidor de exemplo (`dados/caso.test.ts:80`) |
| 7 | faltando | sem números do perito na recomendação (CA2) |

### GGVP-41 · Medir ganho e perda e gravar no acervo

Fora desta entrega pela change da IA ("depois, quando o acervo tiver dado"). O que existe vem de outras histórias.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | parcial | o processo bom entra no acervo com o aviso (GGVP-98: `rotas/prestacao.test.ts:167`) e o ruim como estudo de caso (GGVP-19: `rotas/estudo.test.ts:120`); sem a "lição" de cada desfecho |
| 2 | parcial | o motivo do indeferimento vai ao banco de motivos (`rotas/vigilia.test.ts:114`) e a busca do acervo o usa (`ia/acervo.test.ts:43`) |
| 3 | parcial | a Gestão mostra por benefício, perito, juízo e advogada (`fluxo/resultados.test.ts:138` e `:156`); sem matéria, vara e tese |
| 4 | faltando | o acervo não se atualiza pela vigília, pelos documentos nem pelo Drive |
| 5 | feito | só o desfecho conferido entra nas contas (`rotas/acervo.test.ts:66`); caso sem o dado fica fora dos grupos (`resultados.test.ts:138`) |
| 6 | parcial | o registro não guarda matéria, vara, tese nem lição |
| 7 | feito | indicadores por código (`fluxo/resultados.test.ts:34`) com a conferência da Sênior (`acervo.test.ts:66`) |
| 8 | feito | `resultados.test.ts:34` |
| 9 | feito | uma vez por caso: `prestacao.test.ts:167` |
| 10 | parcial | a busca anonimiza e-mail e nome (`ia/acervo.test.ts:64`); nenhum teste procura CPF, endereço ou telefone no texto gravado |
| 11 | faltando | sem falha visível nem reprocessamento da gravação no acervo |

### GGVP-45 · Buscar no acervo antes de escrever

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/ia/acervo.test.ts:30` e `:43`; `rotas/peticao.test.ts:181` |
| 2 | feito | `acervo.test.ts:58`; `peticao.test.ts:170` |
| 3 | faltando (fora de 09/10 pela spec) | o card de confirmação do chat |
| 4 | feito | `acervo.test.ts:30`; `peticao.test.ts:181` |
| 5 | feito | a instrução proíbe número de jurimetria na peça (`ia/ia.ts:128`); `ia/ia.test.ts:44` |
| 6 | feito | `acervo.test.ts:30` e `:64`; `peticao.test.ts:181` |

A busca é por texto no PostgreSQL; a busca por sentido ficou para depois (spec).

### GGVP-106 · Guardrails de IA e do chat

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/ia/ia.test.ts:28`; os portões no servidor (GGVP-109) |
| 2 | feito | `ia.test.ts:28`; `packages/contratos/src/ia.test.ts:5` |
| 3 | feito | versões da petição com número, data, instruções e quem pediu: `rotas/peticao.test.ts:234` e `:271` |
| 4 | feito | `ia.test.ts:28`; `rotas/ia.test.ts:43` e `:53`. Ressalva: fora do Jurídico, a saída some, mas o trecho das fontes continua (lacuna 25) |
| 5 | feito só no servidor de exemplo | a advogada confere a recomendação do benefício na tela da Recepção (GGVP-51, `dados/beneficio.test.ts:28` e `:54`; `DefinirBeneficio.test.tsx:27`); no servidor, com a GGVP-125 (bloco 3b, PR #32 aberto) |
| 6 | feito só no servidor de exemplo | o laudo novo (GGVP-20, `regras/parecer.test.ts:76`); a IA de verdade é a GGVP-134 |
| 7 | feito só no servidor de exemplo | a leitura do comprovante (GGVP-53, `dados/pericia.test.ts:134`); a IA de verdade é a GGVP-139 |
| 8 | faltando (fora de 09/10 pela spec) | chat com ação |
| 9 | faltando (fora de 09/10 pela spec) | chat com ação (no chat de exemplo, a regra do responsável existe: `regras/chat.test.ts:71`) |
| 10 | faltando (fora de 09/10 pela spec) | chat com ação |
| 11 | feito | `ia.test.ts:44`; os números vêm de código (`fluxo/chance.test.ts:5`; `rotas/conferencia.test.ts:220`) |
| 12 | feito | `ia.test.ts:123` (GGVP-110) |
| 13 | faltando (fora de 09/10 pela spec) | chat com ação |

### GGVP-110 · Conteúdo malicioso não manipula a IA

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `apps/api/src/ia/ia.test.ts:117` e `:123` |
| 2 | feito | `ia/acervo.test.ts:30` e `:64` (GGVP-45) |
| 3 | feito | `ia.test.ts:141` |
| 4 | faltando (fora de 09/10 pela spec) | chat com ação |
| 5 | faltando (fora de 09/10 pela spec) | chat com ação |
| 6 | feito só no servidor de exemplo | a leitura do comprovante não liga o perito (`dados/pericia.test.ts:134`), até a GGVP-139 |
| 7 | feito | `ia.test.ts:149`; `rotas/resultado.test.ts:206` |
| 8 | faltando | o lote do acervo pelo chat não existe (GGVP-55, CA4 e CA5) |
| 9 | feito só no servidor de exemplo | a transcrição só vai à ficha depois da conferência (GGVP-84, `dados/conversa.test.ts:234`), até a GGVP-133 e a GGVP-138 |
| 10 | feito | `ia.test.ts:123` |

## Jurimetria e dashboards (GGVP-15) · dono: Mateus

No servidor: o painel de resultados (GGVP-75), a base do acervo e a conferência dos desfechos (parte da GGVP-55) e a
chance de êxito na conferência da Sênior (primeiro recorte da GGVP-131). A GGVP-59 e a GGVP-64 a própria change marcou como
travadas ("em Tarefas pendentes, sem revisão"); estão em "Em homologação" só porque commits mesclados citam as chaves. A
jurimetria de perito e juízo que aparece hoje é a do servidor de exemplo, nas telas do Pedro (`dados/peritos.ts`,
`dados/caso.ts`).

### GGVP-55 · Subir lote avulso de processos no acervo pelo chat e ver a base em uso na Gestão

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | faltando | não há o comando de importação da base histórica (GGVP-146, parte 2) |
| 2 | faltando | sem a pergunta de unificação de grafias |
| 3 | feito | `apps/api/src/fluxo/resultados.test.ts:165` e `:175`; `Resultados.test.tsx:117` |
| 4 | faltando (fora de 09/10 pela spec) | chat com ação |
| 5 | faltando (fora de 09/10 pela spec) | chat com ação |
| 6 | faltando | o acervo não se alimenta pela vigília, pelos documentos nem pelo Drive (ver GGVP-41 CA4) |
| 7 | feito | `rotas/acervo.test.ts:57`, `:66` e `:89`; `ConferirAcervo.test.tsx:40` e `:52`; `e2e/jurimetria.e2e.ts:32` |

### GGVP-59 · Perito nomeado: identificar e mostrar a jurimetria

Travada pela change; sem código no servidor.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | faltando | a classificação da publicação não liga o perito nem abre "Quesitos e assistente técnico" |
| 2 | feito só no servidor de exemplo | a sobreposição do perito na página do caso (`dados/caso.test.ts:67`; `PaginaDoCaso.test.tsx:77`) |
| 3 | feito só no servidor de exemplo | `regras/caso.test.ts:92` |
| 4 | feito só no servidor de exemplo | GGVP-73: `dados/pericia.test.ts:735` |
| 5 | feito só no servidor de exemplo | GGVP-53: `dados/pericia.test.ts:134` |
| 6 | feito só no servidor de exemplo | `dados/caso.test.ts:80`; `PaginaDoCaso.test.tsx:89` |
| 7 | feito só no servidor de exemplo | `dados/pericia.test.ts:795` |
| 8 | feito só no servidor de exemplo | `dados/pericia.test.ts:735` |
| 9 | feito só no servidor de exemplo | `dados/pericia.test.ts:769` |
| 10 | feito só no servidor de exemplo | GGVP-61: `dados/pericia.test.ts:337` e `:346` |

### GGVP-64 · Juízo identificado: mostrar a jurimetria

Travada pela change; sem código no servidor além do recorte por juízo no painel (GGVP-75).

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito só no servidor de exemplo | a sobreposição do juízo na página do caso (`dados/caso.test.ts:67`; `PaginaDoCaso.test.tsx:77`) |
| 2 | feito só no servidor de exemplo | idem |
| 3 | faltando | a minuta da petição não usa a jurimetria do juízo (`rotas/peticao.ts`) |
| 4 | feito só no servidor de exemplo | `regras/caso.test.ts:92` |
| 5 | parcial | no painel, o recorte por juízo vem de código (`fluxo/resultados.test.ts:138`); a sobreposição do caso usa o servidor de exemplo |
| 6 | feito | a instrução proíbe número de jurimetria na peça (`ia/ia.ts:128`; `ia/ia.test.ts:44`) |

### GGVP-75 · Painel de resultado para os sócios

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | feito | `fluxo/resultados.test.ts:34`, `:107`, `:138` e `:156`; `Resultados.test.tsx:44` e `:126` |
| 2 | feito | `resultados.test.ts:54`; `Resultados.test.tsx:57` |
| 3 | feito | `resultados.test.ts:89`; `Resultados.test.tsx:64` |
| 4 | feito | `resultados.test.ts:122`; `rotas/gestao.test.ts:74`; `contratos/src/permissoes.test.ts:11` |
| 5 | feito | `resultados.test.ts:27`; `Resultados.test.tsx:92` |
| 6 | feito | `Resultados.test.tsx:92`; `resultados.test.ts:165` |
| 7 | feito | `resultados.test.ts:43` |
| 8 | feito | `resultados.test.ts:34`; `contratos/src/resultados.test.ts:16`; `e2e/jurimetria.e2e.ts:7` |

### GGVP-131 · Acervo que aprende (RAG), jurimetria e chance de êxito do caso

História-guia. O primeiro recorte (só a chance na conferência da Sênior) está no servidor; o resto depende das histórias de
cada pedaço.

| CA | Situação | Onde está e o teste que prova |
|---|---|---|
| 1 | parcial | o processo bom e o estudo do perdido entram no acervo (`prestacao.test.ts:167`; `estudo.test.ts:120`), sem os campos da parte 1 (ver GGVP-41) |
| 2 | feito | `fluxo/chance.test.ts:5` a `:15`; `rotas/conferencia.test.ts:220` e `:251` |
| 3 | faltando | sem a chance na entrevista |
| 4 | faltando | sem a sugestão de não pegar abaixo de 15% nem as cores |
| 5 | feito | `conferencia.test.ts:220`; `Conferencia.test.tsx:42` |
| 6 | faltando | depende da GGVP-100 |
| 7 | parcial | as fontes do acervo aparecem na petição (`peticao.test.ts:181`) e o número fica fora da peça (`ia/ia.ts:128`); sem jurimetria no pedido |
| 8 | faltando | depende da GGVP-59 e da GGVP-64 (no servidor de exemplo, a sobreposição existe) |
| 9 | parcial | o desfecho não conferido fica fora das contas (`rotas/acervo.test.ts:66`); sem a pergunta de um clique |
| 10 | feito | `conferencia.test.ts:251` |
| 11 | feito | `conferencia.test.ts:220` |

