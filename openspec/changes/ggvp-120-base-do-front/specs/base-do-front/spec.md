# Spec Delta · base-do-front

## Purpose

Base visual do portal em `apps/web`: tokens do Figma, tema claro e escuro, fonte padrão e grande, e as peças comuns das Centrais, para que as telas de cada história nasçam sobre a mesma base.

## ADDED Requirements

### Requirement: CA1 · Tokens do Figma viram o CSS do portal
O portal SHALL gerar o `tokens.css` a partir de `figma-tokens.json`, o retrato das variáveis do Figma (coleção `Tema`: 29 cores, modos Claro e Escuro; coleção `Acessibilidade`: 17 tamanhos de fonte, modos Padrão e Fonte grande), com os nomes do Figma (`cor/fundo` vira `--cor-fundo`). A verificação MUST falhar se o CSS ficar fora de dia com o JSON ou se algum `var(--x)` do código apontar para token que não existe.

#### Scenario: CA1 · Gerar o CSS a partir do retrato do Figma
- **Dado** o retrato das variáveis do Figma em `figma-tokens.json` (coleção `Tema`: 29 cores, modos Claro e Escuro; coleção `Acessibilidade`: 17 tamanhos de fonte, modos Padrão e Fonte grande)
- **Quando** rodo `npm run tokens`
- **Então** sai o `tokens.css` com os nomes do Figma (`cor/fundo` vira `--cor-fundo`)
- **E** um teste falha se o CSS ficar fora de dia com o JSON ou se algum `var(--x)` do código apontar para token que não existe

### Requirement: CA2 · Tema e fonte valem para a tela inteira e ficam guardados
O portal SHALL trocar a tela inteira de tema (claro ou escuro) e de tamanho de fonte (padrão ou grande) quando a pessoa clica em "☾ Escuro" ou "A+", e MUST guardar a escolha no navegador. `?tema=escuro&fonte=grande` no endereço MUST vencer a escolha guardada; valor inválido no endereço, ou navegador sem armazenamento, MUST seguir o padrão (claro, fonte padrão).

#### Scenario: CA2 · Trocar tema e fonte
- **Dado** qualquer tela
- **Quando** clico em "☾ Escuro" ou "A+"
- **Então** a tela inteira troca de tema ou de tamanho de fonte e a escolha fica guardada no navegador
- **E** `?tema=escuro&fonte=grande` no endereço vence a escolha guardada
- **E** valor inválido no endereço, ou navegador sem armazenamento, segue o padrão (claro, fonte padrão)

### Requirement: CA3 · Barra do topo
A barra do topo SHALL mostrar a marca "GGV Previdenciário", os botões da função com o da página atual aceso, a ação principal da função (no Atendimento, "+ Novo cliente"), os botões de tema e de fonte e o nome da função de quem está logado, como no Figma `11:2`.

#### Scenario: CA3 · Abrir uma tela com a barra do topo
- **Dado** a barra do topo
- **Quando** abro uma tela
- **Então** vejo a marca "GGV Previdenciário", os botões da função com o da página atual aceso, a ação principal da função (no Atendimento, "+ Novo cliente"), os botões de tema e de fonte e o nome da função de quem está logado (Figma `11:2`)

### Requirement: CA4 · Linha da tarefa na fila
Cada tarefa de uma fila SHALL mostrar o código do passo do BPMN, o nome do cliente (ou o contexto, quando não há cliente), a ação, o detalhe na linha de baixo e o prazo. A linha MUST abrir o passo e o nome MUST abrir a ficha, em links separados. Tarefa urgente MUST vir com a cor de ação e avisar o leitor de tela.

#### Scenario: CA4 · Ver uma tarefa na fila
- **Dado** uma tarefa numa fila
- **Quando** ela aparece
- **Então** mostra o código do passo do BPMN, o nome do cliente (ou o contexto, quando não há cliente), a ação, o detalhe na linha de baixo e o prazo
- **E** a linha abre o passo e o nome abre a ficha, em links separados
- **E** tarefa urgente vem com a cor de ação e avisa o leitor de tela

### Requirement: CA5 · Central do Atendimento como vitrine das peças
A raiz `/` SHALL abrir a Central do Atendimento montada com as peças, como no Figma `11:2`, com dados fictícios: busca com nome acessível; chat "✦ Pergunte ou peça" com sugestões, em que clicar na sugestão MUST preencher o campo sem enviar e enviar sem servidor MUST avisar e manter o texto; abas "Minhas tarefas" e "Tarefas do setor", que trocam no clique e nas setas do teclado; a fila; a aba "✦ Suporte".

#### Scenario: CA5 · Abrir a raiz do portal
- **Dado** a raiz `/`
- **Quando** abro
- **Então** vejo a Central do Atendimento montada com as peças, como no Figma `11:2`, com dados fictícios: busca com nome acessível; chat "✦ Pergunte ou peça" com sugestões (clicar preenche e não envia; enviar sem servidor avisa e mantém o texto); abas "Minhas tarefas" e "Tarefas do setor", que trocam no clique e nas setas do teclado; a fila; a aba "✦ Suporte"

### Requirement: CA6 · Guia vivo dos tokens em /tokens
`/tokens` SHALL mostrar as 29 cores, os 17 tamanhos de fonte e os raios, e eles MUST reagir à troca de tema e de fonte, para comparar com o Figma.

#### Scenario: CA6 · Abrir o guia dos tokens
- **Dado** `/tokens`
- **Quando** abro
- **Então** vejo as 29 cores, os 17 tamanhos de fonte e os raios, e eles reagem à troca de tema e de fonte, para comparar com o Figma

### Requirement: CA7 · Caminho que ainda não tem tela
Um caminho que ainda não tem tela SHALL mostrar "Esta tela ainda não foi construída", o caminho e "Voltar ao início".

#### Scenario: CA7 · Abrir um caminho sem tela
- **Dado** um caminho que ainda não tem tela
- **Quando** abro
- **Então** vejo "Esta tela ainda não foi construída", o caminho e "Voltar ao início"

### Requirement: CA8 · Botão ainda não ligado avisa que está indisponível
Os botões que ainda não estão ligados ("Atendimento ⌄", "✦ Suporte", "+ Anexar arquivo" e "Gravar áudio") MUST se anunciar como indisponíveis e MUST NOT prometer menu nem janela que não abre; o visual SHALL continuar o mesmo.

#### Scenario: CA8 · Chegar num botão ainda não ligado
- **Dado** um botão que ainda não está ligado ("Atendimento ⌄", "✦ Suporte", "+ Anexar arquivo" e "Gravar áudio")
- **Quando** chego nele pelo teclado ou pelo leitor de tela
- **Então** ele avisa que está indisponível e não promete menu nem janela que não abre, sem mudar o visual

### Requirement: CA9 · Cada tela tem título próprio
Cada tela SHALL mostrar o próprio título na aba do navegador: "Início · GGV Previdenciário" em `/`, "Tokens do Figma · GGV Previdenciário" em `/tokens` e "Tela não construída · GGV Previdenciário" num caminho sem tela.

#### Scenario: CA9 · Abrir uma tela
- **Dado** cada tela (`/`, `/tokens` e um caminho sem tela)
- **Quando** abro
- **Então** a aba do navegador mostra o título dela: "Início · GGV Previdenciário", "Tokens do Figma · GGV Previdenciário" e "Tela não construída · GGV Previdenciário"

### Requirement: CA10 · Data mostrada é o dia de Brasília
Toda data de um momento (aprovado em, concluído em, enviado em) SHALL aparecer no dia de Brasília, também das 21h à meia-noite, quando em UTC já é o dia seguinte. Data pura (prazo, data de pagamento) SHALL aparecer como está, sem conversão de fuso. Regra única  em  (revisão de 08/10, M1).

#### Scenario: CA10 · Concluído às 22h30
- **Dado** uma prestação concluída em 08/10 às 22h30 de Brasília (09/10 01h30 em UTC)
- **Quando** abro a tela
- **Então** aparece 08/10, e o prazo de pagamento 20/10 continua 20/10
