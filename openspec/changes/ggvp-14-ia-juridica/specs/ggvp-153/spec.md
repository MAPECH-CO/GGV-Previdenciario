# Spec Delta · ggvp-153

## Purpose

Pergunta de um clique para juiz, vara e tese (continua a GGVP-41, nasceu da conferência da jurimetria de 09/10). O
processo do acervo já conferido e ligado a um caso, mas sem vara, juiz ou tese, fica fora daquele recorte da Gestão. Na
conferência, a Sênior vê a pergunta de um clique, com as opções que o portal já conhece, e responde; o caso volta a
contar. Sem resposta, nada trava.

Quem vê e responde: a Sênior (`acervo.conferir_desfecho`).

## ADDED Requirements

### Requirement: CA1 · A pergunta de um clique
A conferência do acervo SHALL listar, à parte dos desfechos pendentes, os processos conferidos e ligados a um caso que
não têm vara, juiz ou tese, cada um com o que falta. Para cada campo que falta, a tela SHALL oferecer as opções que o
portal já conhece (as varas e os juízes dos casos e as teses do acervo conferido), em um clique, e um campo para escrever
uma nova, com até 120 caracteres para vara e juiz e 80 para a tese.

#### Scenario: CA1 · Abrir a conferência
- **Dado** um caso do acervo sem juiz, vara ou tese
- **Quando** a Sênior abre a conferência
- **Então** vê a pergunta de um clique com as opções que o portal já conhece, e pode escrever uma nova

### Requirement: CA2 · A resposta põe o caso no recorte
Ao responder, o servidor SHALL gravar a vara e o juiz no caso e a vara e a tese no processo do acervo, e o caso SHALL
passar a contar no recorte. O histórico SHALL guardar quem respondeu, quando, o campo e o valor de antes e o de depois.
Campo já preenchido MUST NOT ser trocado por esta pergunta: ela só completa o que falta.

#### Scenario: CA2 · Confirmar a resposta
- **Dado** a resposta
- **Quando** ela confirma
- **Então** o caso passa a contar no recorte, e o histórico guarda quem respondeu e quando

### Requirement: CA3 · Nada trava
A pergunta sem resposta MUST NOT bloquear nenhum passo do caso nem a conferência dos desfechos.

#### Scenario: CA3 · Sem resposta
- **Dado** a pergunta sem resposta
- **Quando** o restante do fluxo anda
- **Então** nada trava
