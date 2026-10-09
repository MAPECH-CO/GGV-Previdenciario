# Spec Delta · ggvp-82 · Conversar com o portal em linguagem natural

## Purpose

Qualquer pessoa da equipe pergunta e pede coisas ao portal por escrito ou por voz ("o que falta no caso da Maria?", "marca a perícia do João para terça"), para resolver o dia sem decorar telas. O chat só responde e orienta; para executar, mostra um cartão de confirmação. Ele herda exatamente as permissões do perfil de quem pergunta e não contorna nenhum portão. Transversal. Figma: Centrais `11:2`, `59:449`, `59:609`, `59:863`, `2051:173`; respostas e cards de cada perfil; Suporte `60:2` e `60:193`; títulos das tarefas `2110:2`. Contrato na `design.md`, seção GGVP-82.

## ADDED Requirements

### Requirement: CA1 · A resposta cita o caso e o passo
Uma pergunta sobre um caso que o perfil vê SHALL ter a resposta citando o caso e o passo onde ele está, com link para abrir.

#### Scenario: CA1 · Perguntar de um caso
- **Dado** uma pergunta sobre um caso que meu perfil pode ver
- **Quando** pergunto no chat
- **Então** a resposta cita o caso e o passo onde ele está, com link para abrir

### Requirement: CA2 · Sem acesso, sem o dado
Uma pergunta sobre algo que o perfil não vê SHALL ter como resposta que não há acesso, e o dado SHALL NOT aparecer.

#### Scenario: CA2 · O Atendimento pede o valor da prestação de contas
- **Dado** uma pergunta sobre algo que meu perfil não pode ver
- **Quando** pergunto
- **Então** o chat responde que não tenho acesso e não revela o dado

### Requirement: CA3 · Cartão de confirmação
Um pedido de ação (marcar, criar tarefa, anexar) SHALL virar um cartão com o resumo, o botão de confirmar e o de cancelar; nada SHALL acontecer sem o clique.

#### Scenario: CA3 · Pedir uma ação
- **Dado** um pedido de ação
- **Quando** peço no chat
- **Então** o portal mostra o resumo do que vai fazer e só executa depois que eu confirmo

### Requirement: CA4 · Portão de governança
Um pedido que atravessa um portão SHALL ser recusado, mostrando o portão que falta cumprir.

#### Scenario: CA4 · Protocolar sem o OK do sênior
- **Dado** um pedido que atravessa um portão de governança
- **Quando** peço pelo chat
- **Então** o portal recusa e mostra o portão que falta, por exemplo "falta o OK do sênior"

### Requirement: CA5 · "Feito pelo chat" no histórico
Uma ação feita pelo chat SHALL aparecer no histórico com o nome, a hora e "feito pelo chat".

#### Scenario: CA5 · Consultar o histórico
- **Dado** uma ação feita pelo chat
- **Quando** consulto o histórico do card
- **Então** ela aparece com o meu nome, a hora e "feito pelo chat"

### Requirement: CA6 · O lugar do chat
Na Central, o chat SHALL ficar abaixo da busca, com anexar arquivo, gravar áudio, enviar texto e as sugestões do perfil; nas outras telas, o Suporte SHALL ficar na aba da direita.

#### Scenario: CA6 · Abrir a Central e outra tela
- **Dado** a Central ou outra tela
- **Quando** abro
- **Então** o chat está abaixo da busca, ou o Suporte na aba da direita

### Requirement: CA7 · O responsável da tarefa
Ao criar tarefa, o responsável SHALL seguir a regra: cita a pessoa, é ela; cita só o setor, pergunta quem do setor; não cita ninguém, pergunta quem é; quem pediu só quando se indica. O cartão SHALL ter a linha "Responsável" e o botão "Trocar".

#### Scenario: CA7 · Criar tarefa pelo chat
- **Dado** um pedido para criar tarefa
- **Quando** o chat monta o cartão
- **Então** o responsável segue a regra, e o cartão tem "Responsável" e "Trocar"

### Requirement: CA8 · Fora do perfil
Um pedido fora do perfil SHALL ser recusado, com a explicação de quem é, e o chat SHALL oferecer o cartão "Criar tarefa para" quem pode.

#### Scenario: CA8 · O Atendimento pede uma petição
- **Dado** um pedido fora do meu perfil
- **Quando** peço no chat
- **Então** o chat recusa, explica de quem é e oferece "Criar tarefa para" quem pode

### Requirement: CA9 · O título da tarefa
O título da tarefa criada SHALL usar o nome do cliente e uma ação da lista fixa do perfil de quem vai fazer.

#### Scenario: CA9 · Confirmar a tarefa
- **Dado** que o chat cria uma tarefa
- **Quando** confirmo
- **Então** o título usa o nome do cliente e uma ação da lista fixa

### Requirement: CA10 · Jurimetria
Na pergunta de jurimetria, os números SHALL vir do sistema, a IA SHALL só resumir e citar as fontes, sem amostra mínima.

#### Scenario: CA10 · "Como o perito avalia?"
- **Dado** uma pergunta de jurimetria
- **Quando** o chat responde
- **Então** os números vêm do sistema, com as fontes, sem amostra mínima

### Requirement: CA11 · Perícias da semana
Em "quais perícias temos esta semana?", cada item SHALL abrir a página do processo com a perícia em destaque, não a Agenda.

#### Scenario: CA11 · Perícias da semana
- **Dado** a pergunta "quais perícias temos esta semana?"
- **Quando** o chat responde
- **Então** cada item abre a página do processo, com a perícia em destaque

### Requirement: CA12 · Arquivo anexado
Com um arquivo anexado (laudo novo, comprovante do INSS, comprovante de RPV, lote de PDFs para o acervo), o cartão SHALL listar em passos o que vai fazer e o que conferir, e lembrar as travas do caso.

#### Scenario: CA12 · Anexar no chat
- **Dado** um arquivo anexado no chat
- **Quando** o chat identifica o cliente e o pedido
- **Então** o cartão lista os passos, o que conferir e as travas: o Atendimento não vê o laudo; a IA não escolhe o perito; o valor vem do comprovante e a IA não calcula honorários (G19); o aviso ao cliente só depois do OK da advogada (G8)
