# Spec Delta · ggvp-54

## Purpose

A parte de IA da GGVP-54 (a história foi feita sem IA, "até o épico IA jurídica"; Mateus, 07/10, item 2). Na tela "Despachar caso", a análise da IA sobre o indeferimento chega pronta: a IA lê o motivo do INSS, o motivo escrito, o parecer médico e os documentos do caso, consulta o acervo (indeferimentos parecidos e como a casa respondeu) e sugere o que falta, por setor e perícia, ou "nada falta". Quem despacha continua sendo a Sênior (G4): a sugestão só preenche o formulário, e o despacho guarda a chamada da IA à parte. A análise é preparada em segundo plano assim que o despacho fica esperando e aparece quando a Sênior abre a tarefa, sem botão (CA1 do cartão; Mateus, 07/10).

## ADDED Requirements

### Requirement: CA1 · A Sênior recebe a análise da IA com o histórico do caso
`POST /api/casos/:id/despacho/analise` SHALL devolver, como sugestão, a análise do indeferimento e o que falta (Atendimento e Documentação, cada um com o que obter; perícia médica ou social; ou "nada falta"), com as fontes (indeferimento, parecer, acervo). Só quem despacha pode pedir, e só com o despacho esperando. Resposta fora do formato MUST virar "sem sugestão", com o motivo.

#### Scenario: CA1 · Análise sugerida
- **Dado** um caso indeferido esperando o despacho
- **Quando** a Sênior abre "Despachar caso"
- **Então** vê a análise, o que falta por setor e as fontes, marcados como sugestão, e o formulário preenchido com a sugestão

#### Scenario: CA1 · Atendimento pede a análise
- **Dado** o perfil Atendimento
- **Quando** chama a rota da análise
- **Então** é recusado

### Requirement: CA4 · O despacho da Sênior vale; a sugestão fica no histórico (G4)
A sugestão SHALL só preencher o formulário; a Sênior responde o prazo e muda o que quiser. O despacho enviado com a chamada da IA SHALL guardar `sugestao_ia` com a chamada, separado do que a Sênior decidiu.

#### Scenario: CA4 · Despacho diferente da sugestão
- **Dado** a IA sugeriu acionar a Documentação
- **Quando** a Sênior despacha "nada falta" com a chamada da IA
- **Então** o despacho é "nada falta" e a decisão guarda a chamada da IA à parte
