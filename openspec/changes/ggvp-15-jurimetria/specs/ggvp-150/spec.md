# Spec Delta · ggvp-150

## Purpose

Chance de êxito pelos casos parecidos (continua a GGVP-131, nasceu da conferência da jurimetria de 09/10): a chance da
conferência ganha a cor por faixa, o aviso abaixo de 15% sem bloquear, o que falta saber, o histórico com os casos usados
e a decisão, e passa a aparecer também para a advogada responsável e o Sócio. O número continua vindo de código (G19), com
o número de casos e a data da base (G22).

**Travado (CA1, parte):** como contar um caso do acervo que não tem o fator registrado (perito, parecer, motivo). A
pergunta está no cartão para o Lucas (09/10). Até a resposta, os casos parecidos são os conferidos com o mesmo benefício.

Quem vê: advogada, Sênior e Sócio (`chance.ver`). O Atendimento e o Jurídico administrativo não veem (GGVP-131 CA10; a
dúvida do Jurídico administrativo está na GGVP-156).

## ADDED Requirements

### Requirement: CA1 · Casos parecidos
A chance SHALL contar os casos conferidos do acervo com o mesmo benefício, por código com teste. As mesmas provas, o mesmo
perito ou juízo e os motivos de indeferimento parecidos (fatores da GGVP-131, Lucas, 07/10) MUST entrar depois da resposta
do Lucas sobre o caso do acervo sem o fator registrado.

#### Scenario: CA1 · Calcular a chance
- **Dado** um caso
- **Quando** a chance é calculada
- **Então** conta os casos conferidos do acervo com o mesmo benefício, as mesmas provas presentes ou ausentes (parecer médico, itens do checklist, documentos da época), o mesmo perito ou juízo quando já conhecidos e os motivos de indeferimento parecidos, por código com teste

### Requirement: CA2 · Número de casos, data da base e cor
A chance SHALL vir com o número de casos parecidos, a data da base e a cor: vermelho abaixo de 15%, amarelo de 15% a 50%
(os dois limites incluídos), verde acima de 50%. Sem caso parecido, não há número nem cor.

#### Scenario: CA2 · A chance aparece
- **Dado** a chance
- **Quando** aparece
- **Então** vem com o número de casos parecidos, a data da base e a cor: vermelho abaixo de 15%, amarelo de 15% a 50%, verde acima de 50%

### Requirement: CA3 · Abaixo de 15%, sugestão sem bloqueio
Com a chance abaixo de 15%, a tela SHALL mostrar a sugestão de não pegar o caso, e MUST NOT bloquear nenhuma decisão: o
Jurídico decide.

#### Scenario: CA3 · Chance vermelha
- **Dado** uma chance abaixo de 15%
- **Quando** aparece
- **Então** o portal sugere não pegar o caso, sem bloquear: o Jurídico decide

### Requirement: CA4 · O que falta saber
A chance SHALL listar, por código, os fatores do caso ainda desconhecidos: o perito (nenhuma perícia com perito
identificado), o juízo (sem número de processo judicial), o parecer médico (nenhum parecer) e os documentos que faltam no
checklist.

#### Scenario: CA4 · Fator desconhecido
- **Dado** um fator ainda desconhecido (perito, juízo, prova)
- **Quando** a chance aparece
- **Então** diz o que falta saber para ela ficar mais certa

### Requirement: CA5 · O histórico da chance e da decisão
Ao mostrar a chance, o histórico SHALL guardar a porcentagem, os casos usados (os identificadores do acervo, sem dado de
cliente), a data da base e quem viu. Ao decidir a conferência, o histórico da decisão SHALL guardar a mesma chance, quem
decidiu e o que decidiu.

#### Scenario: CA5 · A pessoa decide
- **Dado** a chance mostrada
- **Quando** a pessoa decide
- **Então** o histórico guarda a chance, os casos usados, a data da base, quem decidiu e o que decidiu

### Requirement: CA6 · A advogada e o Sócio também veem
A chance SHALL sair para a advogada, a Sênior e o Sócio (ação nova `chance.ver`, matriz versão 26). O Atendimento MUST NOT
receber a chance, nem pela tela nem pela API.

#### Scenario: CA6 · Abrir a conferência
- **Dado** a advogada responsável ou o Sócio
- **Quando** abrem a conferência do caso
- **Então** também veem a chance; o Atendimento não vê
