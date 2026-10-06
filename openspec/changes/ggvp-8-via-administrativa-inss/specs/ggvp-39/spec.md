# Spec Delta · ggvp-39

## Purpose

Tratar exigência do INSS: a advogada decide o que a exigência pede e o sistema transforma cada pedido em tarefa com prazo; a Documentação cobra o cliente, junta a prova de cada item e responde no portal do INSS; a perícia pedida abre a tarefa do Jurídico administrativo. Respostas do revisor de 05/10: limites de cobrança são configuração do escritório (Q1, GGVP-104); a resposta redigida pela IA é opcional e fica fora deste grupo; prazo vencido com item pendente sobe para a Sênior com "pedir dilação ou registrar a perda". Ajuste do Mateus na homologação local de 05/10: quem acessa o portal do INSS do cliente é o Jurídico, então a Documentação entrega as provas e a advogada responde.

## ADDED Requirements

### Requirement: CA1 · Card da Documentação com o prazo de entrega da advogada
Criar a tarefa de uma exigência de documentos SHALL entregar à Documentação o card com o que foi pedido e o prazo de entrega definido pela advogada. O prazo de entrega MUST ser informado e MUST NOT passar do prazo do INSS.

#### Scenario: CA1 · Exigência de documentos
- **Dado** uma exigência de documentos
- **Quando** crio a tarefa
- **Então** a Documentação recebe o card com o que foi pedido e o prazo de entrega que eu defino; o prazo é obrigatório e não passa do prazo do INSS

### Requirement: CA2 · Perícia abre a tarefa do Jurídico administrativo
Escolher "Perícia" SHALL abrir sozinho a tarefa de perícia para o Jurídico administrativo. Com o resultado de todas as perícias no card, o caso SHALL voltar para a vigília.

#### Scenario: CA2 · Exigência de perícia
- **Dado** uma exigência de perícia ou avaliação social
- **Quando** escolho "Perícia"
- **Então** o sistema abre sozinho a tarefa de perícia para o Jurídico administrativo, e com o resultado no card o caso volta para a vigília

### Requirement: CA3 · A Documentação entrega; o Jurídico responde no portal
Com o documento de cada item no card, a Documentação SHALL entregar as provas ao Jurídico, e a advogada SHALL responder a exigência no portal do INSS com esses documentos (ajuste de 05/10: só o Jurídico acessa o portal do cliente). Se a exigência também pede perícia, a resposta SHALL abrir a tarefa de perícia para o Jurídico administrativo.

#### Scenario: CA3 · Documento conseguido
- **Dado** o documento conseguido
- **Quando** a Documentação sobe no card e entrega ao Jurídico
- **Então** a advogada responde a exigência no portal do INSS, anexando o documento; se a exigência também pede perícia, o caso entra na perícia e o Jurídico administrativo marca

### Requirement: CA4 · Resposta registrada devolve o caso à vigília
Registrar a resposta, pela advogada, MUST exigir a data da resposta no portal e o comprovante anexado, e SHALL devolver o caso à vigília, esperando o INSS analisar a resposta (espera externa `D2.E4`, código proposto).

#### Scenario: CA4 · Resposta enviada
- **Dado** a resposta enviada
- **Quando** a advogada registra a data da resposta no portal e anexa o comprovante
- **Então** o caso volta para a vigília e espera o INSS analisar a resposta

### Requirement: CA5 · Limite de cobranças sobe para a Sênior
Atingido o limite de cobranças (parâmetro do escritório, Q1), a última tentativa sem sucesso SHALL subir a tarefa para a Sênior.

#### Scenario: CA5 · Última tentativa falha
- **Dado** o limite de cobranças atingido
- **Quando** a última tentativa falha
- **Então** a tarefa sobe para a Sênior

### Requirement: CA6 · Perícia e documentos: primeiro os documentos
Escolher "Perícia e documentos" SHALL entregar primeiro o card da Documentação; a tarefa de perícia SHALL abrir só quando os documentos chegarem.

#### Scenario: CA6 · Exigência de perícia e documentos
- **Dado** uma exigência que pede documentos e perícia
- **Quando** escolho "Perícia e documentos"
- **Então** a Documentação recebe primeiro o card; quando os documentos chegam, o sistema abre a tarefa de perícia e o Jurídico administrativo marca a perícia

### Requirement: CA7 · Texto, data e prazo calculado pelo lado seguro
Abrir a tarefa SHALL mostrar o texto integral da exigência, a data e o prazo calculado pelo sistema: dias corridos a partir do dia seguinte ao da exigência, e o fim em dia sem expediente passa para o próximo dia útil (Lei 9.784, art. 66); na dúvida, a data mais cedo (G12). O número de dias é o que consta na comunicação do INSS.

#### Scenario: CA7 · Exigência nova
- **Dado** uma exigência nova
- **Quando** abro a tarefa
- **Então** vejo o texto integral da exigência, a data e o prazo calculado pelo sistema, contado pelo lado mais seguro (G12)

### Requirement: CA8 · Escolha obrigatória do que a exigência pede
Decidir a exigência MUST exigir a escolha: "Documentos" pede ao menos um item; "Perícia" ou "Perícia e documentos" pedem o tipo (perícia médica ou avaliação social).

#### Scenario: CA8 · Decidir o que a exigência pede
- **Dado** a exigência aberta
- **Quando** decido o que ela pede
- **Então** a escolha é obrigatória: "Documentos" pede ao menos um item; "Perícia" ou "Perícia e documentos" pedem o tipo

### Requirement: CA9 · Card sai com itens, prazo e lembretes
Criar a tarefa de "Documentos" SHALL gerar o card da Documentação com os itens, o prazo na agenda e o próximo lembrete marcado pelo intervalo de cobrança configurado (Q1).

#### Scenario: CA9 · Criar a tarefa de documentos
- **Dado** "Documentos"
- **Quando** crio a tarefa
- **Então** o card da Documentação já sai com os itens, o prazo na agenda e os lembretes agendados

### Requirement: CA10 · Quem decide é a advogada (G5)
A classificação da exigência e o setor MUST ser definidos pela advogada; nenhuma sugestão automática SHALL valer sem a confirmação dela.

#### Scenario: CA10 · Sugestão da classificação
- **Dado** que a IA sugere a classificação
- **Quando** abro a tarefa
- **Então** a sugestão só vale depois que eu confirmo; quem define o que a exigência pede e o setor é o Jurídico, não a IA

### Requirement: CA11 · Card com itens, prazo e status
O card da Documentação SHALL mostrar cada item pedido, o prazo e o status de cada item: pendente, cumprido ou não cumprido.

#### Scenario: CA11 · A Documentação abre o card
- **Dado** o card da Documentação
- **Quando** ela abre
- **Então** vê cada item pedido, o prazo e o status de cada item

### Requirement: CA12 · Cada cobrança registra data, canal e resultado (G15)
Cada cobrança ao cliente SHALL registrar data, canal e resultado e contar no limite (G15); enquanto isso o caso espera o cliente entregar o documento (espera externa `D2.E3`, código proposto).

#### Scenario: CA12 · A Documentação cobra
- **Dado** a cobrança ao cliente
- **Quando** a Documentação cobra
- **Então** cada cobrança registra data, canal e resultado e conta no limite; o caso espera o cliente entregar o documento

### Requirement: CA13 · Só entrega e só responde com prova em todos os itens (G21)
Entregar ao Jurídico e responder a exigência no portal MUST exigir documento anexado em todos os itens; faltando um, o portal recusa.

#### Scenario: CA13 · Vários itens
- **Dado** uma exigência com vários itens
- **Quando** a Documentação tenta entregar ao Jurídico
- **Então** só consegue com documento anexado em todos os itens

### Requirement: CA14 · Perto do vencimento, a Sênior é avisada
Com item pendente, faltando 5 dias úteis para o prazo da exigência a Sênior SHALL receber o alerta; a 2 dias úteis, o caso SHALL subir ao topo da fila dela. Vencido o prazo com item pendente, a Sênior SHALL registrar "pedi dilação" ou "registrar a perda", com histórico (resposta do revisor de 05/10).

#### Scenario: CA14 · Prazo perto do vencimento
- **Dado** o prazo da exigência perto do vencimento com item pendente
- **Quando** faltam 5 dias úteis
- **Então** a Sênior recebe o alerta; a 2 dias úteis, o caso sobe ao topo da fila dela
