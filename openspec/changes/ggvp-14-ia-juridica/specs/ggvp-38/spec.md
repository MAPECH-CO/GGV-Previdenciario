# Spec Delta · ggvp-38

## Purpose

Recomendação sobre a perícia (DP.00; Mateus, 07/10, item 6 da análise do BPMN com as histórias). Antes de marcar a perícia, a IA prepara para a advogada responsável, sozinha e em segundo plano (sugestão pronta), o que levar, os pontos fortes e fracos da prova e, na perícia pedida pelo juiz, os quesitos sugeridos e se vale indicar assistente técnico. A advogada recebe "Conferir a recomendação da perícia", edita e aprova; a aprovação fica registrada, e a IA não marca nada. Recorte: sem a jurimetria do perito (CA2), que depende de identificar o perito (GGVP-59, pendente): a recomendação sai sem ela, como no CA6, e a pergunta de um clique para identificar o perito fica com a GGVP-59. CA5 (o comprovante do INSS não traz o perito) não muda nada aqui. Perícia judicial é a pedida pelo juiz (exigência do juiz); as pedidas pela advogada no INSS, pela exigência do INSS e pelo despacho da Sênior não têm quesitos.

## ADDED Requirements

### Requirement: CA1 · A recomendação chega pronta quando a perícia é pedida
Para cada perícia pedida e ainda sem resultado nem recomendação aprovada, a IA SHALL preparar em segundo plano a recomendação, com o benefício, o tipo e a origem da perícia, o parecer médico, a matriz de documentos do benefício, os documentos do caso, o motivo do indeferimento, a ordem do juiz (quando houver) e o acervo: o que levar (sem CID, diagnóstico nem conclusão médica, porque vai para a orientação do cliente), os pontos fortes e os pontos fracos. Feita a recomendação, SHALL nascer para a advogada "Conferir a recomendação da perícia", uma por caso, que abre a tela de perícias do caso já com a recomendação preenchida. Resposta fora do formato MUST NOT virar recomendação.

#### Scenario: CA1 · Perícia pedida no INSS
- **Dado** uma perícia médica pedida pela advogada no INSS, com o parecer registrado
- **Quando** o sistema faz a rodada de preparo
- **Então** a advogada tem "Conferir a recomendação da perícia" e, ao abrir, vê o que levar e os pontos fortes e fracos, sem nova chamada à IA

### Requirement: CA3 · Na perícia judicial, quesitos e assistente técnico
Na perícia pedida pelo juiz, a recomendação SHALL trazer quesitos sugeridos e se vale indicar assistente técnico, com o porquê, para a advogada aprovar, editar ou descartar. Nas outras perícias, MUST NOT trazer quesitos nem assistente técnico.

#### Scenario: CA3 · Perícia do juiz
- **Dado** uma perícia médica determinada pelo juiz
- **Quando** a advogada abre a recomendação
- **Então** vê os quesitos sugeridos e a sugestão sobre o assistente técnico, e pode editar ou apagar cada quesito

### Requirement: CA4 · A advogada aprova; a IA não marca nada
"Aprovar a recomendação" SHALL gravar o que a advogada aprovou (o que levar, quesitos, assistente técnico), com quem e quando e com a chamada da IA à parte, e fechar a tarefa quando não houver outra recomendação esperando no caso. Só a advogada aprova (`pericia.decidir`); o Jurídico vê (`dado_saude.ver_detalhe`); o Atendimento não vê. A recomendação MUST NOT marcar a perícia nem mexer na tarefa do Jurídico administrativo.

#### Scenario: CA4 · Aprovar editando
- **Dado** a recomendação pronta
- **Quando** a advogada apaga um item de "O que levar" e aprova
- **Então** a aprovação guarda a lista dela, com o nome dela, e a tarefa "Marcar perícia" do Jurídico administrativo continua como estava

#### Scenario: CA4 · Jurídico administrativo vê, não aprova
- **Dado** o perfil Jurídico administrativo
- **Quando** tenta aprovar a recomendação
- **Então** é recusado, e continua vendo a recomendação aprovada para orientar o cliente
