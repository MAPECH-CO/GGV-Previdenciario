# Spec Delta · ggvp-100

## Purpose

Improcedente: decidir se recorre (passo D3b.04). Depois da sentença improcedente confirmada na "Confirmar desfecho" (D4.02), nasce "Decidir recurso" para a Sênior, que decide com justificativa (Lucas, 07/10); a advogada responsável e o Sócio só leem. Recorrer: o processo segue na vigília (D3a) e nasce "Elaborar e protocolar o recurso". Não recorrer: o caso vai ao estudo de caso (GGVP-19) e à explicação ao cliente (GGVP-22). Quem elabora e protocola o recurso são as Sêniores (dúvida Q26, Lucas, 09/10; `QUEM_FAZ_O_RECURSO`).

## ADDED Requirements

### Requirement: CA1 · "Recorrer" mantém o processo na vigília
Com "Sim, recorrer" registrado, o processo SHALL seguir na vigília do D3a e SHALL nascer a tarefa "Elaborar e protocolar o recurso", com o prazo recursal. O estudo de caso MUST NOT nascer.

#### Scenario: CA1 · Marcar "Recorrer"
- **Dado** uma decisão improcedente
- **Quando** a Sênior marca "Sim, recorrer" e registra
- **Então** nasce "Elaborar e protocolar o recurso" e o estudo de caso não nasce

### Requirement: CA2 · "Não recorrer" faz nascer o estudo de caso
Com "Não recorrer" registrado, o caso SHALL entrar na rodada do estudo de caso (GGVP-19) e SHALL abrir "Aprovar o resumo para o cliente" (GGVP-22). Enquanto a decisão espera, o estudo MUST NOT nascer.

#### Scenario: CA2 · Confirmar "Não recorrer"
- **Dado** a decisão esperando
- **Quando** a Sênior confirma "Não recorrer"
- **Então** o resumo ao cliente abre e o estudo de caso nasce na rodada da IA

### Requirement: CA3 · Justificativa obrigatória e quem decidiu
A decisão SHALL exigir a escolha e a justificativa; "Registrar" SHALL habilitar só com as duas. Quem decidiu e quando SHALL ficar registrados. Só a Sênior decide; a advogada responsável e o Sócio só leem; os outros perfis MUST NOT ver. Decisão repetida SHALL ser recusada.

#### Scenario: CA3 · Sem justificativa
- **Dado** a tarefa aberta
- **Quando** a Sênior escolhe sem escrever a justificativa
- **Então** "Registrar" fica desabilitado e o servidor recusa

### Requirement: CA4 · Prazo recursal contado pelo sistema, pelo lado seguro
A tela SHALL mostrar o prazo recursal contado em código a partir da sentença: 10 dias úteis (o menor entre o recurso inominado do JEF e a apelação), com os feriados do tribunal; se a publicação foi classificada com prazo menor, vale o menor (G12).

#### Scenario: CA4 · Abrir a tarefa
- **Dado** a sentença disponibilizada em 05/10/2026
- **Quando** a Sênior abre a decisão
- **Então** vê o prazo de 20/10/2026, contado pelo sistema

### Requirement: CA5 · Quem elabora e protocola é a Sênior
Com "Sim, recorrer", a tarefa do recurso SHALL ir para a Sênior (`QUEM_FAZ_O_RECURSO`; dúvida Q26, Lucas, 09/10).

#### Scenario: CA5 · A tarefa do recurso
- **Dado** "Sim, recorrer" registrado
- **Quando** a Sênior abre a Central
- **Então** vê "Elaborar e protocolar o recurso" com o prazo

### Requirement: CA6 · Recurso e contrarrazões na Minuta só depois da sentença
Com a sentença publicada, a Minuta da IA SHALL oferecer "Recurso e contrarrazões" entre os tipos de peça; antes da sentença, MUST NOT oferecer.

#### Scenario: CA6 · Pedir peça
- **Dado** a sentença publicada
- **Quando** peço uma peça na Minuta da IA
- **Então** "Recurso e contrarrazões" aparecem entre os tipos

### Requirement: CA7 · O título na Central
A tarefa SHALL aparecer na Central da Sênior com o nome do cliente e "Decidir recurso", e SHALL abrir a tela da decisão.

#### Scenario: CA7 · Ver a Central
- **Dado** a tarefa aberta
- **Quando** a Sênior abre a Central
- **Então** vê o nome do cliente e "Decidir recurso"

### Requirement: CA8 · A chance vem da jurimetria, calculada por código
A porcentagem de chance SHALL vir da jurimetria calculada por código; a IA MUST NOT dar número. Sem a jurimetria do juízo, a tela SHALL dizer que a chance ainda não está disponível.

#### Scenario: CA8 · Sem jurimetria do juízo
- **Dado** a decisão aberta e nenhuma jurimetria do juízo
- **Quando** a Sênior abre a tarefa
- **Então** lê "A chance pela jurimetria ainda não está disponível para este juízo"
