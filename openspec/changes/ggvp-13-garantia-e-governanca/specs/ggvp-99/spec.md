# Spec Delta · ggvp-99

## Purpose

Histórico de quem fez o quê: cada caso tem a linha do processo montada do histórico, com quem fez (pessoa ou sistema), quando, o passo e o que foi feito. O histórico não se altera nem se apaga: no banco já havia a trava (GGVP-2), e agora a API também recusa e registra a tentativa. Respostas do Lucas (01/10): guarda de pelo menos 5 anos, e caso vivo nunca descarta (nada apaga o histórico); só o Jurídico desfaz o que a IA mudou; ninguém exporta sem a autorização da direção, e o pedido e a exportação ficam no histórico; toda rodada de automação fica registrada; só os devs da MAPECH acessam o banco direto. A IA, o chat com ação, a atribuição pelo líder e a conversa gravada (D5) entram com os épicos deles: até lá, não há evento deles a registrar.

## ADDED Requirements

### Requirement: CA1 · Campo mudado pela IA, com Desfazer
O campo alterado pela IA SHALL aparecer no histórico com o valor antigo, o novo, a origem e o Desfazer para o Jurídico. Entra com o épico IA jurídica; até lá, a IA não muda campo.

#### Scenario: CA1 · Mudança da IA
- **Dado** um campo alterado pela IA
- **Quando** abro o histórico
- **Então** vejo o valor antigo, o novo, a origem (por exemplo "transcrição da conversa de 12/10") e o botão Desfazer para o Jurídico. A conversa com o cliente é a do D5 (GGVP-76, 80 e 84), registrada pela tela "Registrar conversa" (`2144:2`).

### Requirement: CA2 · Sugestão da IA recusada
A sugestão da IA recusada pela pessoa SHALL aparecer no histórico com a recusa. Entra com o épico IA jurídica.

#### Scenario: CA2 · Recusa
- **Dado** uma sugestão da IA que a pessoa recusou
- **Quando** abro o histórico
- **Então** a sugestão e a recusa aparecem

### Requirement: CA3 · Quem cumpriu cada portão
Cada passo com portão cumprido SHALL ficar no histórico com quem cumpriu e quando: as decisões de pessoa (OK, aprovação, despacho, dispensa, decisão do laço) entram na linha do processo.

#### Scenario: CA3 · Portão cumprido
- **Dado** qualquer passo com portão (`docs/requisitos/portoes-governanca.md`)
- **Quando** ele é cumprido
- **Então** fica registrado quem cumpriu e quando

### Requirement: CA4 · Ação feita pelo chat
A ação confirmada no card do chat SHALL ficar no histórico com quem confirmou, quando, o que o card dizia e "feito pelo chat". Até 09/10 o chat só consulta, então não há ação pelo chat.

#### Scenario: CA4 · Card do chat
- **Dado** uma ação feita pelo chat
- **Quando** a pessoa confirma o card
- **Então** o histórico registra quem confirmou, quando, o que o card dizia e a indicação "feito pelo chat"

### Requirement: CA5 · Atribuição pelo líder
A atribuição ou reatribuição de tarefa pelo líder SHALL ficar no histórico com quem atribuiu, quando e para quem. A atribuição pelo líder ainda não existe no portal (ficou fora dos épicos entregues); quando entrar, grava no histórico.

#### Scenario: CA5 · Atribuir
- **Dado** uma tarefa atribuída pelo líder do setor
- **Quando** ele atribui ou reatribui
- **Então** o histórico guarda quem atribuiu, quando e para quem (proposta do Figma, confirmar com o PO)

### Requirement: CA6 · Conversa gravada
Nada da conversa gravada SHALL ir para a ficha sem a pessoa conferir, e cada mudança aceita entra no histórico com a origem. Entra com a conversa do D5 e o épico IA jurídica.

#### Scenario: CA6 · Resumo da conversa
- **Dado** uma conversa registrada com gravação
- **Quando** a IA resume e marca o que muda na ficha
- **Então** nada vai para a ficha sem a pessoa conferir, e cada mudança aceita entra no histórico com a origem

### Requirement: CA7 · Cada evento completo
Cada evento da linha do processo SHALL ter quem fez (pessoa ou sistema), a data e a hora com fuso, o caso, o passo do BPMN quando houver, e a descrição em palavras da equipe.

#### Scenario: CA7 · Evento registrado
- **Dado** qualquer evento do caso
- **Quando** é registrado
- **Então** tem quem fez (pessoa, sistema ou IA), data e hora com fuso, o caso, o passo do BPMN e a descrição

### Requirement: CA8 · Antes e depois; segredo só o fato
A alteração de um dado SHALL guardar o valor anterior e o novo; segredo, como a senha do gov.br, MUST registrar só o fato, nunca o valor.

#### Scenario: CA8 · Alteração
- **Dado** a alteração de um dado
- **Quando** é registrada
- **Então** guarda o valor anterior e o novo; segredos (como a senha do gov.br) registram só o fato, nunca o valor

### Requirement: CA9 · Ninguém edita nem apaga
Editar ou apagar um evento do histórico, pela tela ou pela API, MUST ser recusado no servidor, e a tentativa SHALL ficar registrada; nenhum perfil tem essa ação, e o banco também recusa.

#### Scenario: CA9 · Tentar apagar
- **Dado** alguém que tenta editar ou apagar um evento do histórico, pela tela ou pela API
- **Quando** tenta
- **Então** a ação é recusada no servidor e a tentativa fica registrada; nenhum perfil tem essa ação

### Requirement: CA10 · Correção é evento novo
Desfazer ou corrigir SHALL entrar como evento novo que aponta para o anterior, e nada MUST ser apagado. As correções do portal já entram como evento novo (nova versão, nova prestação); o Desfazer da IA entra com o épico IA jurídica.

#### Scenario: CA10 · Desfazer
- **Dado** um "Desfazer" ou a correção de um registro
- **Quando** é feito
- **Então** entra como evento novo que aponta para o anterior; nada é apagado

### Requirement: CA11 · A linha do processo
A linha do processo SHALL ser montada a partir do histórico, em ordem cronológica, para quem vê o caso (`caso.ver`), sem dado de saúde.

#### Scenario: CA11 · Abrir a linha
- **Dado** o caso
- **Quando** abro a linha do processo
- **Então** ela é montada a partir do histórico, em ordem cronológica

### Requirement: CA12 · Exportação só com a autorização da direção
A gestão SHALL pedir a exportação do histórico de um caso com o motivo; só a direção (o Sócio) MUST autorizar; autorizada, quem pediu exporta a trilha completa. O pedido, a autorização e a exportação SHALL ficar no histórico (Lucas, 01/10).

#### Scenario: CA12 · Pedido de auditoria
- **Dado** um pedido de auditoria ou do titular dos dados
- **Quando** a gestão exporta
- **Então** a trilha do caso sai completa (proposta, LGPD)

### Requirement: CA13 · Ação direta no banco
O histórico MUST NOT poder ser alterado nem por ação direta no banco (a trava do banco recusa); só os devs da MAPECH acessam o banco, e cada ação direta é revista pelos registros do banco (Lucas, 01/10).

#### Scenario: CA13 · Ação direta
- **Dado** uma ação administrativa direta no banco, se existir
- **Quando** acontece
- **Então** fica registrada e é revisada

### Requirement: CA14 · Relatório de prazos
O relatório de prazos cumpridos e perdidos SHALL vir do histórico: as exigências respondidas ou manifestadas e as perdidas, com o caso e a data, para a gestão.

#### Scenario: CA14 · Gerar o relatório
- **Dado** o relatório de prazos cumpridos e perdidos
- **Quando** é gerado
- **Então** vem do histórico
