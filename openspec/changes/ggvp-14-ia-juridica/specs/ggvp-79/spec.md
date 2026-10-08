# Spec Delta · ggvp-79

## Purpose

A parte de IA da GGVP-79 (Mateus, 07/10, item 4 da análise do BPMN com as histórias; dica do D3a: "a IA lê a decisão com o histórico do processo e já sugere as tarefas"). Na tela "Exigência do juiz", a sugestão da IA chega pronta, sem botão (Mateus, 07/10): a IA lê a publicação, o prazo, o benefício, os documentos do caso e o acervo, e sugere "só ciência" ou os itens por setor (Atendimento, Jurídico, Documentação), com o documento que comprova, e a perícia. Quem decide é a advogada (G5): a sugestão só preenche o formulário, o prazo interno continua com ela, e a decisão guarda a chamada da IA à parte.

## ADDED Requirements

### Requirement: CA3 · A IA sugere as tarefas; vale a escolha da advogada (G5)
`POST /api/casos/:id/exigencia-juiz/sugestao` SHALL devolver, como sugestão, o resumo da exigência e "só ciência" ou os itens por setor com a prova esperada e a perícia, com as fontes (publicação, acervo). Só quem distribui a exigência pode pedir, e só com a análise esperando; resposta fora do formato MUST virar "sem sugestão". A sugestão SHALL chegar pronta ao abrir e só preencher o formulário, sem prazo interno; a decisão enviada com a chamada SHALL guardar `sugestao_ia` separado do que a advogada escolheu.

#### Scenario: CA3 · Sugestão das tarefas
- **Dado** uma exigência do juiz esperando a análise
- **Quando** a advogada abre a exigência
- **Então** vê o resumo, os itens por setor com a prova esperada e a perícia, marcados como sugestão, o formulário preenchido, e nada é gravado

#### Scenario: CA3 · Escolha diferente da sugestão
- **Dado** a IA sugeriu acionar a Documentação
- **Quando** a advogada marca "só ciência" com a chamada da IA
- **Então** vale "só ciência", e a decisão guarda a chamada da IA à parte

#### Scenario: CA3 · Perfil sem distribuir
- **Dado** um perfil que não distribui a exigência
- **Quando** chama a rota da sugestão
- **Então** é recusado
