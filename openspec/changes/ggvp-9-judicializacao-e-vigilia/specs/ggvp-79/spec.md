# Spec Delta · ggvp-79

## Purpose

Analisar a exigência do juiz e criar a tarefa de cada setor: a advogada decide se é "só ciência" ou "precisa cumprir" e, se precisa, monta os itens com o setor, o que cumprir e o prazo interno. Respostas do revisor de 06/10: o Jurídico entra entre os setores; sem IA até o épico IA jurídica, quem monta os itens é a advogada; qualquer advogada trata, até existir a atribuição pela Sênior.

## ADDED Requirements

### Requirement: CA1 · "Precisa cumprir" distribui aos setores com o prazo
Marcar "precisa cumprir" SHALL permitir escolher os setores (Atendimento, Jurídico, Documentação, perícia), e cada setor SHALL receber a tarefa com o prazo.

#### Scenario: CA1 · Precisa cumprir
- **Dado** uma exigência
- **Quando** marco "precisa cumprir"
- **Então** escolho os setores e cada um recebe a tarefa com o prazo

### Requirement: CA2 · "Só ciência" volta para a vigília
Marcar "só ciência" SHALL devolver o processo para a vigília.

#### Scenario: CA2 · Só ciência
- **Dado** "só ciência"
- **Quando** marco
- **Então** o processo volta para a vigília

### Requirement: CA3 · Vale a escolha da advogada
A escolha de setores da advogada SHALL valer; sem IA, não há sugestão a confirmar (G5).

#### Scenario: CA3 · Escolha dos setores
- **Dado** as tarefas sugeridas
- **Quando** escolho setores diferentes
- **Então** vale a minha escolha

### Requirement: CA4 · Mais de um pedido vira lista de itens
Uma exigência com mais de um pedido SHALL virar a lista de itens com prazo, responsável e prova esperada (G21).

#### Scenario: CA4 · Vários pedidos
- **Dado** uma exigência com mais de um pedido
- **Quando** a analiso
- **Então** ela vira a lista de itens com prazo, responsável e prova

### Requirement: CA5 · A análise mostra o texto, o prazo e os itens
A análise SHALL mostrar o texto da publicação, o prazo contado pelo sistema com a regra usada e a lista de itens (G21).

#### Scenario: CA5 · Abrir a análise
- **Dado** uma exigência
- **Quando** abro a análise
- **Então** vejo o texto da publicação, o prazo contado com a regra e a lista de itens

### Requirement: CA6 · "Só ciência" fica registrada sem tarefa
A ciência SHALL ficar registrada, com quem e quando, e MUST NOT criar tarefa.

#### Scenario: CA6 · Registrar ciência
- **Dado** "só ciência"
- **Quando** marco
- **Então** a ciência fica registrada e nenhuma tarefa é criada

### Requirement: CA7 · Cada item com o que cumprir e prazo interno até o processual
Cada item MUST ter o que cumprir e o prazo interno; o prazo interno MUST NOT passar do prazo processual.

#### Scenario: CA7 · Montar os itens
- **Dado** "precisa cumprir"
- **Quando** marco os responsáveis
- **Então** descrevo para cada um o que cumprir, e o prazo interno é obrigatório e não passa do prazo processual

### Requirement: CA8 · Perícia abre a tarefa do Jurídico administrativo
"Perícia" entre os responsáveis SHALL abrir sozinho a tarefa de perícia, com a origem D3a, para o Jurídico administrativo.

#### Scenario: CA8 · Perícia pedida pelo juiz
- **Dado** "Perícia" entre os responsáveis
- **Quando** confirmo
- **Então** o sistema abre sozinho a tarefa de perícia com a origem D3a, para o Jurídico administrativo

### Requirement: CA9 · Só advogado confirma a distribuição
Nenhuma tarefa SHALL nascer sem a confirmação da advogada, e quem não tem perfil de advogado MUST ter a confirmação recusada no servidor, com registro (G5).

#### Scenario: CA9 · Sem permissão
- **Dado** alguém sem perfil de advogado
- **Quando** tenta confirmar a distribuição
- **Então** a ação é recusada no servidor e registrada

### Requirement: CA10 · As tarefas aparecem nas Centrais dos setores
As tarefas criadas SHALL aparecer na Central do perfil de cada setor, com o prazo interno e o título "Cumprir exigência do juiz".

#### Scenario: CA10 · Tarefas criadas
- **Dado** as tarefas criadas
- **Quando** confirmo
- **Então** aparecem nas Centrais dos responsáveis com o prazo e o título "Cumprir exigência do juiz"

### Requirement: CA11 · Protocolo travado até todos os itens terem prova
Enquanto houver item sem prova, o protocolo da manifestação MUST ficar travado (GGVP-87); a minuta da IA fica para o épico IA.

#### Scenario: CA11 · Adiantar a resposta
- **Dado** a análise
- **Quando** quero adiantar a resposta
- **Então** o protocolo continua travado até todos os itens terem prova

### Requirement: CA12 · Título "Analisar exigência do juiz"
A exigência na fila da advogada SHALL ter o nome do cliente e "Analisar exigência do juiz".

#### Scenario: CA12 · Na fila
- **Dado** a exigência na minha fila
- **Quando** aparece
- **Então** o título é o nome do cliente + "Analisar exigência do juiz"

### Requirement: CA13 · A advogada edita os itens antes de confirmar
A advogada SHALL poder trocar o setor, a prova esperada e o prazo de cada item, e incluir ou remover itens; nada MUST nascer sem a confirmação dela (G5, G21).

#### Scenario: CA13 · Editar os itens
- **Dado** os itens da exigência
- **Quando** analiso
- **Então** posso trocar o setor, a prova esperada e o prazo de cada item, e incluir ou remover itens
