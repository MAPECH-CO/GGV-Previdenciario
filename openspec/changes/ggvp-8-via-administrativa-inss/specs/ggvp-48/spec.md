# Spec Delta · ggvp-48

## Purpose

Indeferido segue para a Justiça: o indeferimento registrado na vigília abre a judicialização com a carta e o motivo do INSS, sem redigitar. A Sênior pode encerrar o caso com motivo registrado (resposta do revisor de 05/10).

## ADDED Requirements

### Requirement: CA1 · Indeferido passa para a Justiça com "Registrar indeferimento"
Registrar "Indeferido" SHALL passar o caso para a fase judicial, com a primeira tarefa "Registrar indeferimento" para a advogada responsável. A Sênior SHALL poder encerrar o caso em vez de judicializar, com o motivo obrigatório e registrado.

#### Scenario: CA1 · Registrar o indeferimento
- **Dado** "Indeferido"
- **Quando** registro a decisão
- **Então** o caso passa para a Justiça e a primeira tarefa é "Registrar indeferimento"

### Requirement: CA2 · Carta de indeferimento obrigatória
Registrar "Indeferido" MUST exigir a carta de indeferimento anexada; sem ela, o portal não deixa concluir.

#### Scenario: CA2 · Sem a carta
- **Dado** "Indeferido"
- **Quando** registro a decisão na vigília sem a carta
- **Então** o portal não deixa concluir

### Requirement: CA3 · A tarefa já traz a carta e o motivo do INSS
A tarefa "Registrar indeferimento" SHALL trazer a carta anexada e o motivo que consta no sistema do INSS, sem redigitar; o motivo com as palavras de quem viu continua obrigatório na tela da GGVP-52.

#### Scenario: CA3 · Abrir a tarefa
- **Dado** o caso que passou para a Justiça
- **Quando** a tarefa "Registrar indeferimento" abre
- **Então** já traz a carta anexada e o motivo do INSS
