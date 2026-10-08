# Spec Delta · ggvp-51 · Definir o benefício com apoio do acervo

## Purpose

A IA compara a entrevista com casos da casa e mostra o benefício, mantendo o que a advogada citou, para não perder um direito que o cliente tem. Tela do Figma: step_D1.12 `14:123`, com o Overlay · Entrevista `1581:348`. Passo D1.12 do Miro. Portões G3 e G19.

## ADDED Requirements

### Requirement: CA1 · O benefício citado prevalece
Com um benefício citado pela advogada na entrevista, o benefício do caso SHALL ser o dela, e o que o acervo indicar diferente MUST aparecer só como sugestão (G3).

#### Scenario: CA1 · A advogada citou
- **Dado** que citei um benefício na entrevista
- **Quando** a IA analisa
- **Então** o benefício do caso é o meu, e o do acervo fica só como sugestão

### Requirement: CA2 · Sem citado, a IA propõe com a base
Sem benefício citado, a IA SHALL propor um benefício com os casos da casa usados como base e uma frase do porquê, e a advogada confirma ou troca.

#### Scenario: CA2 · A advogada não citou
- **Dado** que não citei benefício
- **Quando** a IA analisa
- **Então** ela propõe um benefício, com os casos usados e o porquê

### Requirement: CA3 · Recusa no histórico
Recusar a sugestão da IA SHALL ficar no histórico.

#### Scenario: CA3 · Recusar
- **Dado** uma sugestão da IA
- **Quando** recuso
- **Então** a recusa fica no histórico

### Requirement: CA4 · Confirmar só com a conferência
"Confirmar benefício" SHALL habilitar só com o benefício definido e "Conferi a recomendação com a entrevista" marcada.

#### Scenario: CA4 · Finalizar sem conferir
- **Dado** que não citei benefício
- **Quando** tento finalizar sem conferir a recomendação
- **Então** não consigo

### Requirement: CA5 · O que a tela mostra
A tela SHALL mostrar o benefício citado (se houver), a sugestão com a base usada e MUST deixar escolher qualquer benefício da lista única do portal.

#### Scenario: CA5 · Definir
- **Dado** a tela do benefício
- **Quando** vou definir
- **Então** vejo o citado, a sugestão com a base e posso escolher qualquer benefício da lista

### Requirement: CA6 · O registro da decisão
Confirmado o benefício, SHALL ficar registrados o benefício final, quem decidiu, a sugestão exibida e as fontes do acervo consultadas.

#### Scenario: CA6 · Salvar a decisão
- **Dado** o benefício confirmado
- **Quando** salvo
- **Então** ficam o benefício, quem, a sugestão e as fontes

### Requirement: CA7 · Requisito numérico por código
Requisito numérico da sugestão (carência, afastamento de mais de 15 dias) SHALL vir de cálculo por código com teste, nunca da IA (G19).

#### Scenario: CA7 · A tela mostra o requisito
- **Dado** uma sugestão que depende de requisito numérico
- **Quando** a tela mostra o requisito
- **Então** o número vem do código

### Requirement: CA8 · Um benefício por processo
O caso SHALL ficar com um benefício só; outro benefício para o mesmo cliente MUST ser processo novo (GGVP-124).

#### Scenario: CA8 · Confirmar
- **Dado** o benefício confirmado
- **Quando** salvo
- **Então** o caso fica com um benefício só
