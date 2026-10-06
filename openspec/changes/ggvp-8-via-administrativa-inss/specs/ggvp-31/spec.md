# Spec Delta · ggvp-31

## Purpose

Mandar para perícia quando o benefício pede: a advogada decide se o caso precisa de perícia médica, avaliação social ou as duas; o sistema abre sozinho a tarefa de perícia para o Jurídico administrativo; a decisão corre junto com o protocolo.

## ADDED Requirements

### Requirement: CA1 · Com perícia, o sistema abre a tarefa
Marcar perícia médica, avaliação social ou as duas SHALL fazer o sistema abrir sozinho a tarefa de perícia para o Jurídico administrativo.

#### Scenario: CA1 · Marcar perícia
- **Dado** o caso aprovado
- **Quando** marco "perícia médica", "avaliação social" ou as duas
- **Então** o sistema abre sozinho a tarefa de perícia para o Jurídico administrativo

### Requirement: CA2 · Sem perícia, só espera o protocolo
Marcar "sem perícia" SHALL deixar o caso esperando só o protocolo para entrar na vigília.

#### Scenario: CA2 · Sem perícia
- **Dado** "sem perícia"
- **Quando** marco
- **Então** o caso só espera o protocolo para entrar na vigília

### Requirement: CA3 · Os dois prontos, o caso entra na vigília
Com o protocolo feito e a perícia resolvida (ou sem perícia), o caso SHALL entrar na vigília.

#### Scenario: CA3 · Junção completa
- **Dado** o protocolo feito e a perícia resolvida (ou sem perícia)
- **Quando** os dois terminam
- **Então** o caso entra na vigília

### Requirement: CA4 · Recomendação sobre a perícia (v2, espera o desenho)
A recomendação sobre a perícia SHALL ser gerada antes de o Jurídico administrativo marcar, quando o passo estiver desenhado no Miro. Fora deste grupo.

#### Scenario: CA4 · Precisa de perícia
- **Dado** "precisa de perícia"
- **Quando** marco
- **Então** a recomendação sobre a perícia é gerada antes da marcação (quando o passo existir)

### Requirement: CA5 · Sem resposta, não segue
"Definir" MUST só habilitar com "Precisa de perícia?" respondida; o servidor MUST recusar decisão sem resposta ou "sim" sem tipo.

#### Scenario: CA5 · Seguir sem responder
- **Dado** o caso aprovado
- **Quando** tento seguir sem responder "Precisa de perícia?"
- **Então** o portal não deixa, e a junção não se completa

### Requirement: CA6 · Autora e horário registrados
A decisão SHALL ficar registrada com a autora e o horário.

#### Scenario: CA6 · Registrar a decisão
- **Dado** que decido
- **Quando** registro
- **Então** ficam registrados a autora e o horário da decisão

### Requirement: CA7 · Resultado favorável ou não completa a junção
A perícia devolvida com resultado, favorável ou desfavorável, SHALL completar a junção do mesmo jeito.

#### Scenario: CA7 · Resultado volta ao card
- **Dado** a perícia devolvida, favorável ou desfavorável
- **Quando** o resultado volta ao card
- **Então** a junção se completa do mesmo jeito
