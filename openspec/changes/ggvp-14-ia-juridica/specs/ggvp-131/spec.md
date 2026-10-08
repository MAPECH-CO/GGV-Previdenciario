# Spec Delta · ggvp-131

## Purpose

Primeiro recorte da chance de êxito do caso (Mateus, 07/10), só na conferência da Sênior antes do INSS, depois do parecer. A porcentagem vem de código, a partir dos desfechos conferidos do acervo (mesmo benefício), sempre com o número de casos e a data da base (G22); sem casos parecidos, não há número. A IA lê o caso e explica os fatores que puxam para cima e para baixo e o que fazer para subir; ela não calcula. As dúvidas abertas do cartão (fatores, momento, o que se fala ao cliente) seguem com o Lucas: o que está aqui é proposta até a resposta. Fora deste recorte: entrevista, perícia, recurso, petição, perito e juízo como fatores.

## ADDED Requirements

### Requirement: CA2 · A porcentagem vem de código, com o número de casos e a data da base
A chance SHALL ser calculada por código a partir dos desfechos conferidos do acervo com o mesmo benefício (proposta): favoráveis (deferido, procedente total ou parcial) sobre favoráveis e desfavoráveis (improcedente, extinto sem mérito); desistência não conta. A tela SHALL mostrar a porcentagem com o número de casos e a data da base; sem casos parecidos, MUST NOT mostrar número.

#### Scenario: CA2 · Acervo com casos parecidos
- **Dado** 4 desfechos conferidos do mesmo benefício, 3 favoráveis
- **Quando** a Sênior pede a chance
- **Então** vê "75% em 4 casos parecidos · base de <data>"

#### Scenario: CA2 · Acervo sem casos parecidos
- **Dado** nenhum desfecho conferido do mesmo benefício
- **Quando** a Sênior pede a chance
- **Então** vê "sem casos parecidos na casa ainda", sem porcentagem

### Requirement: CA4 · Na conferência da Sênior, com o parecer e o checklist
A chance SHALL aparecer na conferência da Sênior antes do INSS, com os fatores que a IA lê do caso (parecer, checklist, laudo novo esperando, motivo do indeferimento quando houver) e o que fazer para subir, marcados como sugestão. Cada fato vai à IA em frase inteira (por exemplo, "Nenhum laudo médico novo esperando conferência"), não em "sim/não", para ela não ler ao contrário.

#### Scenario: CA4 · Ver a chance
- **Dado** um caso na conferência da Sênior
- **Quando** ela abre a conferência
- **Então** vê o número (ou a falta dele) e os fatores sugeridos pela IA

### Requirement: CA9 · O Atendimento não vê a chance
A chance e os fatores MUST NOT ir a quem não pode aprovar para o INSS; a rota recusa e registra.

#### Scenario: CA9 · Atendimento pede a chance
- **Dado** o perfil Atendimento
- **Quando** chama a rota da chance
- **Então** é recusado

### Requirement: CA10 · A chance mostrada fica no histórico
Cada chance mostrada SHALL ficar no histórico do caso com o número, os casos usados, a data da base e a chamada da IA.

#### Scenario: CA10 · Histórico
- **Dado** a chance mostrada à Sênior
- **Quando** ela abre o histórico do caso
- **Então** está lá, com o número, os casos e a data da base
