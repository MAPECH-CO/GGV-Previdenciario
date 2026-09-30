# Protótipo navegável no Figma

Arquivo **"Portal GGV Previdenciário"** (chave `nHOPzl005CpWDXUWyVZIo6`), na conta MAPECH. É a simulação
clicável do desktop, revisada com o PO em 28/09/2026. O modelo de tela vale para o Railway depois.

## Princípio: por trabalho, não por cliente
A pessoa **não navega por cliente**. Ela entra na **Central de trabalho** da função dela, vê
"O que você tem que fazer" (notificações com o código do passo do BPMN, o cliente, o benefício e o
prazo) ou **busca** por processo, nome ou tarefa. Cada item abre a **tela daquele trabalho** e
"Voltar à Central" retorna. Não existe tela de cliente dedicada.

## Páginas do arquivo
| Página | O que tem | Início do fluxo (Present) |
|---|---|---|
| Desktop · Central de trabalho (simulação) | **Tudo o que é navegável está aqui** (links de protótipo não atravessam páginas): uma Central **por função** (Atendimento, Atendimento · líder, Advogada, Estagiário (Jurídico adm.), Sênior, Financeiro; o painel da Documentação foi retirado em 29/09 e o do Estagiário voltou na mesma noite, ver abaixo), 46 telas de ação `step_<código>` (contagem de 28/09; as telas novas de 29/09 estão em "Ajustes de 29/09 à noite"), a página completa do processo, a página do cliente (duas variantes), o fluxo Novo cliente → Marcar reunião → Reunião com transcrição, a Minuta e as variantes tema escuro / fonte grande | Cada Central, Meus processos e Novo cliente são pontos de início |
| Desktop · Jurídico (simulação) | Versão anterior (hub do caso). Referência, não é o modelo atual | — |
| Page 1 | Homes por perfil e mobile da primeira rodada. Referência | — |

O seletor de perfil (canto superior direito da Central) abre "Entrar como…" e troca de Central. As
notificações de cada função vêm de `docs/requisitos/funcoes-e-telas.md`.

## Advogada: o que foi decidido
- **Tarefa abre o processo do cliente.** Na Central da Advogada (e da Sênior), clicar
  numa tarefa abre a **página completa do processo**, não uma tela solta (duas exceções desde 29/09: D2.03 "Decidir perícia" e D1.21M "Analisar laudo novo" abrem a
  tela da ação). A ação específica (minuta,
  contato) sai de dentro da página.
- **Meus processos** (tela sem uso desde 29/09, com o selo "Substituída"): cada cartão mostra a etapa (balão), o próximo passo e o prazo. À direita, as
  últimas movimentações dos processos do setor.
- **Página completa do processo**, compacta, em três colunas: cabeçalho (número, etapa, benefício,
  NB, cliente clicável, juízo, prazo) + resumo da IA com a próxima ação; abaixo, a **linha do processo
  inteira** (Atendimento → INSS → Judicial, 14 ocorridos com quem fez e o passo do BPMN), dados do
  processo, exigências (prazo, responsável, prova, G21), perícias, prazos, documentos (abrir cada um)
  e ações. Sem texto de apoio desnecessário.
- **Barra de ações do processo**, logo abaixo do cabeçalho: os passos do Jurídico lado a lado em
  ordem cronológica (Entrevista → Pedido ao INSS → Exigência INSS → Perícia INSS → Despacho →
  Petição → Perícia judicial → Exigência do juiz → Minuta → Sentença/recurso → Prestação de contas).
  O que já ocorreu fica desabilitado com ✓; **só a etapa atual está habilitada** (▶, laranja) e abre
  o popup daquela tarefa; o que ainda não chegou fica apagado. Sete casos no protótipo, um por tarefa da Central da Advogada: Clara Nunes (entrevista), Pedro
  Alves (exigência do INSS), Rosa Lima (pedir petição), Marcos Dias (conferir petição), Sérgio Ramos
  (resultado da perícia), Antônio Ferreira Lima (exigência do juiz + minuta) e Lúcia Prado
  (prestação de contas).
- **Cada tarefa tem a sua ação na página.** A página do processo se adapta ao estágio do caso, e a
  tarefa que a abriu ganha um **popup próprio** a partir de "Abrir próxima ação". Exemplo feito:
  "Prestação de contas: dar o OK" abre a página do processo da Lúcia Prado (sentença procedente,
  RPV expedida, painel de honorários) e o popup **Prestação de contas — conferir e dar o OK**:
  valores montados pela IA (condenação, honorários 20%, a repassar, forma e prazo), checklist de
  conferência, observação para o Financeiro e os botões "Dar o OK e liberar o aviso à cliente" (G8)
  e "Pedir ajuste à IA". Segundo exemplo: "Conferir laudo pericial e parecer médico (G17)" abre o processo do Sérgio
  Ramos e o popup **Resultado da perícia — conferir laudo e parecer**: resumo do laudo pela IA,
  conclusão, DII, coerência com o pedido (G18), jurimetria do perito (G22), ponto de atenção,
  checklist de conferência e as decisões "Laudo favorável — gerar a manifestação", "Pedir
  esclarecimentos (quesitos)" e "Impugnar o laudo". Os outros quatro seguem o mesmo padrão, cada um com o
  seu caso: **Entrevista** (Clara Nunes: ficha lida pela IA, sugestão de benefício com fundamentos,
  alternativa, roteiro de perguntas, decisão da advogada — G3 — e "Iniciar a entrevista", que abre a
  reunião com transcrição); **Exigência do INSS** (Pedro Alves: o que o INSS pediu, itens com prova
  — G21 —, resposta redigida pela IA, conferência e "Aprovar — a Documentação anexa e responde");
  **Pedir petição** (Rosa Lima: tese e pedidos sugeridos, provas a anexar, jurimetria do acervo,
  instruções para a IA, opções e "Gerar a petição"); **Conferir petição** (Marcos Dias: o que
  mudou da v1 para a v2, travas G7, ponto de atenção, prévia, conferência e "Assinar e enviar ao
  protocolo" — G6). Sete tarefas da Central da Advogada, sete páginas no estágio certo, sete popups.
- **Histórico**: linha do tempo já está na página; o toggle sob o número abre a versão em detalhe.
- **Etapas futuras não aparecem**: sentença, recurso e prestação de contas só entram quando
  acontecerem (uma linha diz isso ao pé da linha do tempo).
- **Minuta em tela própria**: últimas publicações do processo (contexto da IA), tipo de peça (só
  o que cabe na etapa), caixa de instruções para a IA já preenchida, checkboxes (Tema 350, laudo,
  precedentes do acervo, tutela, anexos) e as travas antes de protocolar (G7). A IA gera; a
  advogada assina (G6).

## Cliente: nome clicável em todo lugar
Qualquer nome de cliente no protótipo (Central, telas de ação, processo, minuta) abre a **página do
cliente**: dados editáveis (nome, CPF, contatos, endereço, profissão, como chegou, contato de apoio),
foto, documentos pessoais, últimos contatos. **Para o Jurídico**, a página lista **todos os processos
do cliente** (judicial atual, administrativo de origem, um encerrado) e o bloco de saúde (CID, laudos,
perícias), restrito. **Para o Atendimento**, mostra o caso em andamento e o que ele faz agora, sem
petição, valores nem conteúdo de laudo. No protótipo todos os nomes abrem a mesma ficha fictícia
(Antônio Ferreira Lima).

## Atendimento: novo cliente e reunião com transcrição
- **Novo cliente** (botão "+ Novo cliente" na Central do Atendimento): o mínimo para começar —
  nome, CPF, telefone/WhatsApp; opcionais e-mail, como chegou, benefício de interesse (só sugestão,
  G3). Se o CPF já existir, o portal abre a ficha em vez de criar outra.
- **Marcar reunião**: tipo (vídeo, presencial, telefone), data e horário, com quem, convite pelo
  WhatsApp com modelo (GGVP-102), gravação e transcrição ligadas com o aviso no início (G10),
  lembrete do kit de documentos (G1). "Iniciar agora" para cliente ao telefone.
- **Reunião com transcrição**: gravação com cronômetro e marca do aviso (G10), transcrição ao vivo
  com quem fala, a IA preenchendo a ficha ao lado (cada campo marcado confirmado / detectado /
  pendente), pendências apontadas, e a senha do gov.br indo ao cofre sem entrar na transcrição (G9).
  Ao encerrar, resumo e ficha vão para a advogada definir o benefício (D1.09–D1.12).

## Atendimento: o que cada tela de ação carrega
Cada tela de ação do Atendimento e da Documentação abre com um cartão **"O que você deve fazer"**:
instruções curtas montadas pela IA a partir da entrevista, do benefício e do caso daquele cliente
(ex.: em "Marcar a perícia", tela que passou ao Estagiário em 29/09: qual agência, que horário, o que conferir no kit antes, o que orientar
o cliente a levar e o portão que vale). O **tipo de benefício** aparece em destaque (selo laranja
"◆ Benefício") no cabeçalho de toda tela e no próprio cartão.
Tipo de benefício sempre visível; contatos do cliente (ligar/WhatsApp) em toda tela que pode
precisar de contato; anexo do documento faltante; contrato na íntegra + anexar página de
assinatura; lista de exigências com cumprida/pendente/sem prova; resumo do que foi coletado com
abrir cada documento; links para os documentos do scanner; campos do lead.

Em toda tela de ação do Atendimento e da Documentação, o cartão "O que você deve fazer" traz três
atalhos: **Abrir a ficha do cliente**, **Entrevista e transcrições** (janela de gravações, com
resumo, informações extraídas e transcrição) e **Parecer médico** (janela com o parecer da IA,
conclusão "Suficiente / Insuficiente", documentos analisados e quem confirmou, G17). Na tela
D1.24 "Liberar o caso ao Jurídico", as linhas Ficha, Entrevista e Parecer médico do "Resumo do que
foi coletado" também abrem esses mesmos destinos.

## Transcrições: sempre à mão ao abrir um processo
A entrevista gravada é a fonte primária do caso. Toda página do processo (e a ficha do cliente)
tem no topo, em destaque, o botão **"▶ Transcrições (n)"**, que abre a janela de transcrições:
- **lista de gravações e registros** do cliente (pode haver várias: entrevista com a advogada,
  telefone com o Atendimento, registro manual sem áudio);
- para a selecionada, **resumo pela IA**, **informações extraídas** (cada uma marcada com o
  destino: ficha, processo, cofre ou pendência para a Documentação) e a **transcrição** completa
  com busca, player e trechos marcados como prova.
Regras que aparecem na tela: aviso de gravação no início (G10); a senha do gov.br dita na conversa
vai ao cofre e não consta na transcrição (G9); a IA só muda na ficha o que foi dito, o valor antigo
fica no histórico e o Jurídico pode desfazer (G14).

## Tarefas do setor e atribuição
- **Todo mundo vê as tarefas do setor.** Cada Central tem duas abas: **Minhas tarefas** (o que
  está atribuído a mim) e **Tarefas do setor** (tudo do Atendimento ou do Jurídico, com o
  responsável em cada linha e filtro por pessoa e por "sem responsável").
- **Só o líder atribui.** O responsável pelo Atendimento (perfil "Atendimento · líder") e a
  sênior (líder do Jurídico) veem a mesma lista com o botão **Atribuir / Reatribuir** em cada
  tarefa. O colaborador vê a lista só para leitura e pede ao líder no chat se quiser pegar uma
  tarefa sem responsável.
- **Popup Atribuir tarefa**: pessoas do setor com a carga de hoje (barra e contagem), prazo
  sugerido, prioridade, recado, aviso no chat e na Central de quem recebe; "Deixar sem
  responsável" e "Abrir a tarefa". Quem atribuiu fica no histórico (quem, quando, para quem).
  Tarefa sem responsável ou com prazo estourado sobe para o líder (G15).

## Glossário e fluxos do BPMN numerados
No seletor de função há a entrada **"? Glossário"**. A página explica cada código que aparece no
portal e nas histórias do Jira:
- **G1 a G22**: os portões de governança de `docs/requisitos/portoes-governanca.md`, uma linha
  cada, com os diagramas em que valem.
- **D1.01, D2.03, DP.07…**: os passos do BPMN, agrupados por diagrama, na ordem do fluxo. Clicar
  num passo (ex.: D1.13) abre o **fluxo daquele diagrama** dentro do Figma: uma tela por diagrama
  (D1, D2, D3, D3a, D3b, D4, D5, DP) com cada passo numerado, o tipo (pessoa, IA, sistema,
  scanner, decisão, fluxo) e a raia. Os botões "Abrir no Miro" foram removidos do protótipo: o
  BPMN é lido dentro do portal; o Miro fica só como ferramenta de desenho (links em `docs/bpmn/`).
- Os mesmos códigos foram **escritos nos cartões do Miro** (frames "revisão BPMN"; os códigos com E dos passos
  externos ainda não): cada caixa
  começa com o código (ex.: "D1.13 · Calcular tempo e pontos"; nas decisões, "D2.03 · Precisa de
  perícia?"). Assim Figma, Miro, `docs/bpmn/` e o Jira usam a mesma referência.
- **Passar o mouse sobre o código** de uma tela (o chip "D1.24" no topo das 46 telas de ação e os 14
  códigos da linha do tempo da página do processo) mostra uma dica: código e nome do passo, tipo,
  raia, diagrama e a descrição de `docs/bpmn/`. **Clicar no código** (ou na própria dica) abre o
  **desenho do BPMN** daquele diagrama em **tela cheia** (desde 29/09, imagem gerada a partir do conteúdo do board, com o desenho novo; as de
  `docs/bpmn/img/` continuam as de 28/09), com arraste horizontal e vertical; "✕ Fechar" volta à tela anterior. O D5,
  apagado do Miro em 28/09, abre pelo glossário marcado como removido. A dica é um
  overlay do Figma, por isso a área clicável dela cobre o chip: o clique funciona tanto com a dica
  aberta quanto fechada. As variantes da página do processo (tema escuro, fonte grande, por
  tarefa) ainda não têm a dica.
- **BPMN dentro do portal** (ver `docs/bpmn/README.md`): decisão do PO, abrir **fora do Miro**. Hoje
  é a imagem exportada por frame; o alvo é o diagrama desenhado pelo próprio portal a partir de
  `docs/bpmn/`.

## Clientes, Processos, Gestão e Financeiro (29/09)
O texto da marca no topo de toda tela é **"GGV Previdenciário"** (era "Central de trabalho"; o nome
"Central" continua neste documento só para designar a tela inicial de cada função). O primeiro botão
do topo é **"⌂ Início"**, que volta à tela inicial da função logada (na própria Central ele aparece
aceso). Todo link "‹ Voltar" (telas de ação, processo, cliente, minuta, glossário) usa a ação **Voltar do
histórico** do Figma: retorna à tela de onde a pessoa veio, seja a Central, a lista de Processos, a
Agenda ou outra. A barra de botões aparece em
**toda tela** da função (Central, Agenda, Clientes, Processos, Gestão, Financeiro, telas de ação,
processo, cliente, minuta, novo cliente e reunião); a Agenda tem uma cópia por função, porque os
botões mudam por função. Depois de "Início" vem "Agenda" e, por função, os botões:
- **Atendimento:** só "Agenda". **Atendimento · líder e Advogada:** "Clientes" e "Processos".
  **Sênior:** "Clientes", "Processos" e "Gestão". **Financeiro:** "Clientes", "Processos", "Gestão" e
  "Financeiro". Cada função tem a sua cópia das telas (o cabeçalho e o "Voltar" são os da função).
- **Clientes**: a base de todos os clientes e leads, com busca por nome ou CPF e filtros por benefício,
  localização, êxito e situação. Colunas: cliente, CPF, benefício, cidade, processos, situação/êxito,
  último contato. Clicar num cliente abre a ficha (a variante da função). "+ Novo cliente" só no
  Atendimento.
- **Processos**: todos os processos, administrativos e judiciais, com busca por autor, nº ou CPF e
  filtros por tribunal/foro, juiz, perito, benefício, êxito e fase. Colunas: processo (CNJ), autor,
  benefício, foro, juiz, perito, desfecho (Êxito, Acordo, Perdido no mérito, Extinto sem mérito, Em
  andamento, como no Raio-X), ajuizamento. Clicar na linha abre o processo completo; clicar no nome
  do autor abre a ficha do cliente. Vale o mesmo nas tabelas de Clientes (a contagem de processos
  abre a lista) e do Financeiro (cliente → ficha, nº do processo → processo).
- **Gestão**: painel de resultados do escritório, montado a partir do **Raio-X Previdenciário GGV**
  (leitura integral de 979 processos, gerado em 21/09/2026): seis indicadores com a variação entre
  safras (êxito nos decididos 9% → 25% → 36%; falha nossa provada 52% → 38% → 30%; laudo médico
  favorável 44%; extinção por não cumprir determinação 24% → 2%; cliente faltou à perícia 3% → 6%;
  recurso provido 5–8%), gráfico de linhas do desfecho por safra, barras da falha por safra, êxito por
  tipo de benefício, o que o cartório mais cobra na inicial, onde julgam, "a perícia decide", listas
  Melhorou / Piorou e "O que mudar" com o passo do BPMN que cobra cada ajuste. O bloco "Operação
  2026" (novos casos por mês) é fictício até o portal estar no ar. O arquivo do Raio-X **não entra no
  repositório**: tem nome de cliente e dado de saúde processo a processo; só os agregados estão no
  painel.
- **Financeiro**: no modelo do Financeiro do portal antigo. Indicadores (recebido no mês, a receber
  em RPV/precatório/acordos, prestações de contas a lançar, mensalidades em atraso, honorários de
  êxito previstos), receita por mês (recebido × previsto), receita por origem, prestações de contas
  pendentes e a tabela de lançamentos com filtros por tipo, status, responsável e vencimento. Status:
  Recebido, A receber, Atrasado, Aguardando OK (da advogada, G8) e Lançar. Valores fictícios.
- **Painel retirado:** Documentação · ADM não tem mais Central própria. As tarefas de documentação
  (D1.02, D1.18, D2.05, DP.03) aparecem na Central do Atendimento. O painel do Estagiário, retirado na
  mesma tarde, voltou à noite por decisão do Lucas (ver "Ajustes de 29/09 à noite"): o protocolo no Meu
  INSS (D2.02) saiu da Central da Advogada e foi para a do Estagiário, junto com a perícia. As telas de
  ação continuam as mesmas; só o "Voltar" muda de destino. O seletor de função ficou com Atendimento,
  Atendimento · líder, Advogada, Estagiário (Jurídico adm.), Sênior, Financeiro e Glossário.

## Suporte interno nas telas
Aba "✦ Suporte" na borda direita dos artboards do desktop, menos nas Centrais: desde 29/09 à noite, nelas
o chat fica embaixo da busca (ver "Ajustes de 29/09 à noite"). A aba abre uma janela à direita com
o chatbot do escritório (Chatwoot embutido, ver `docs/arquitetura/chatwoot-no-portal.md`). O chat
herda o perfil de quem está logado e não contorna portão (GGVP-82); um humano entra se precisar.

## Cor, tema escuro e fonte maior
- Paleta: acento **laranja escuro** `#B4531A`, tinta suave `#FBEADB`; fundo `#F6F7F8`, texto
  `#15171C`, texto suave `#616875`, linha `#E4E7EB`. Perfis: Advogada azul, Sênior roxo,
  Financeiro âmbar. As cores de **status** (verde "Cumprida", âmbar "Pendente", vermelho urgente)
  foram mantidas para não perder o significado. **A confirmar com o PO** se os status também
  devem virar laranja.
- **Variáveis do Figma**: coleção `Tema` (modos Claro/Escuro) com 29 cores e coleção
  `Acessibilidade` (modos Padrão/Fonte grande, +25%) com 17 tamanhos. Toda cor e todo tamanho de
  fonte do arquivo estão ligados a elas; trocar o modo de um frame troca a tela inteira.
- No protótipo, os botões "☾ Escuro / ☀ Claro" e "A+ / A−" (Central da Advogada e página completa
  do processo) navegam entre as variantes. No portal real, é a preferência do usuário.
- Dados, processos, contatos e documentos são **fictícios**, só para apresentação.

## Como apresentar
1. Abrir a página, Present (▶). Na Central: clicar em uma notificação, ou na busca, e voltar.
2. Trocar de função pelo seletor. Na Central, usar o chat embaixo da busca; nas outras telas, abrir o
   Suporte pela aba da direita.
3. Na Central da Advogada: clicar numa tarefa abre o processo completo; clicar no nome do cliente
   abre a ficha com todos os processos; da página, a próxima ação e a minuta; testar ☾ e A+.
4. Na Central do Atendimento: "+ Novo cliente" → salvar e marcar reunião → iniciar agora → reunião
   com transcrição → encerrar (volta à ficha do cliente).
5. Numa tela de ação do Atendimento (ex.: D1.24): abrir a ficha, a entrevista e o parecer médico
   pelos atalhos do cartão. Passar o mouse no chip "D1.24" (dica) e clicar (fluxo D1 em tela
   cheia) → "✕ Fechar" volta. No seletor: "? Glossário" → clicar num código → fluxo numerado.

## Limitações do protótipo
- Overlays (histórico, seletor, chat) usam uma moldura transparente do tamanho da tela, porque a
  API do Figma não permite posicionar overlay por código.
- O mobile (versão do atendente) ainda está na primeira rodada, sem estas revisões.
- "Jurídico (simulação)" e "Page 1" ficaram como referência da rodada anterior. A página
  "Advogada (workspace)" foi absorvida pela página da Central.

## Revisão de usabilidade (29/09)
Percurso por persona executando as funções do BPMN, com 287 achados e plano: `revisao-usabilidade-2026-09-29.md`.

## Ajustes de 29/09 à noite (Lucas, Fernando e Pedro)
Aplicados no Figma na noite de 29/09/2026, junto com o ajuste do BPMN no Miro (ver `docs/bpmn/`).

- **Central do Estagiário (Jurídico administrativo) de volta.** Por decisão do Lucas, a perícia fica toda com
  o Jurídico administrativo (marcar no INSS, subir o comprovante, orientar e remarcar), e o protocolo no Meu
  INSS (D2.02) saiu da Central da Advogada para a do Estagiário. O seletor de função tem Atendimento,
  Atendimento · líder, Advogada, Estagiário (Jurídico adm.), Sênior, Financeiro e Glossário. A Documentação
  continua dentro da Central do Atendimento.
- **Títulos padronizados.** O título de toda tarefa é o nome do cliente em negrito mais uma ação de uma lista
  fixa; o detalhe vai na linha de baixo. A lista está em `docs/requisitos/titulos-de-tarefa.md` e no quadro
  "Glossário · títulos das tarefas" do Figma.
- **Chat embaixo da busca em todas as Centrais**, inclusive nas abas do setor e nas variantes escura e de
  fonte grande. São 10 respostas que só orientam e 5 cards de confirmar: o Atendimento sobe o laudo novo, a
  Advogada cria tarefa, o Estagiário sobe o comprovante do INSS, a Sênior cria tarefa e o Financeiro lança
  comprovante. Nas outras telas, o Suporte continua na aba da direita.
- **Telas novas:** D1.20 (entregar a cópia do contrato), D1.23 (cobrar documento do checklist), D3.04
  (cumprir pendência do despacho) e "Laudo novo · resumo e comparação da IA".
- **Overlay · Registrar conversa** (tela nova). Os botões "Registrar contato com o cliente" (página do
  processo e fichas do cliente) e "Registrar nova conversa" (transcrições) levavam à tela do D5.01, que foi
  apagada, e agora abrem esse formulário: canal, com quem falou, gravação (com o aviso de gravação, G10),
  resumo que a IA escreve e a pessoa confere, e os botões Cancelar e Salvar no processo.
- **Botão principal de cada tela de tarefa:** leva ao próximo passo ou volta à Central da função.
- **Listas do BPMN:** cada passo abre a tela dele. As listas mostram 18 passos externos tracejados, com a
  proposta de códigos com E (`D1.E1`, `DP.E3`…, ver `docs/bpmn/README.md`), que ainda não foi gravada no Miro.
- **BPMN em tela cheia com o desenho de 29/09.** As telas "BPMN · tela cheia" (D1, D2, D3, D3a, D3b, D4, DP)
  ganharam o desenho novo do Miro, com as raias externas e o laudo novo no D1. Não é o "Exportar imagem" do
  Miro: a imagem foi gerada a partir do conteúdo do board (mesmas posições, cores e textos), e o cabeçalho diz
  "gerado do Miro em 29/09". As imagens de `docs/bpmn/img/` continuam as de 28/09 até alguém reexportar pelo
  Miro.
- **Tarefas da Advogada e da Sênior** continuam abrindo a página do processo, com duas exceções que abrem a
  tela da ação: D2.03 "Decidir perícia" e D1.21M "Analisar laudo novo".
- **Telas antigas sem uso** ganharam o selo "Substituída": Advogada · Meus processos e os dois "Suporte IA
  fixo".
- **Conferência:** os links de protótipo foram conferidos por script: 2.143 links para telas (2.259 ações,
  contando Fechar e Voltar), nenhum quebrado, nenhuma tela sem entrada e nenhum link para tela removida,
  fora os do glossário, que abrem o D5 marcado como removido. O modo Apresentar não foi rodado.

## Próximos passos
Validar com o PO as 6 Centrais, Clientes, Processos, Gestão e Financeiro; aplicar o mesmo nível de
detalhe do Atendimento nas telas de Sênior e Financeiro; atualizar o mobile; depois Railway.
