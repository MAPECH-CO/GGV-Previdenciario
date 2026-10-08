# Spec Delta · ggvp-88 · Pendência da conversa vira tarefa

## Purpose

O que ficou pendente na conversa vira tarefa no card, com responsável, para que nada combinado com o cliente fique
esquecido. Passo D5.05 do Miro (o sistema cria a tarefa no card; depois volta ao D1, de onde o caso parou), sem tela
própria. Figma: a decisão "Surgiu pendência?" do step_D5.04 `2282:2`, o chat da Advogada "criar tarefa (pergunta o
responsável)" `2052:186` e os cards de confirmação `2176:2`. Contrato na `design.md`, seção GGVP-88.

## ADDED Requirements

### Requirement: CA1 · Surgiu pendência: a tarefa nasce com responsável
Marcado "surgiu pendência", a tarefa SHALL ser criada com responsável, e o caso SHALL voltar ao D1 de onde parou.

#### Scenario: CA1 · Marcar "surgiu pendência"
- **Dado** "surgiu pendência"
- **Quando** marco
- **Então** a tarefa é criada com responsável e o caso volta ao D1 de onde parou

### Requirement: CA2 · Não surgiu: nenhuma tarefa
Marcado "não surgiu pendência", nenhuma tarefa SHALL nascer, e o caso SHALL voltar direto ao D1, de onde parou.

#### Scenario: CA2 · Marcar "não surgiu pendência"
- **Dado** "não surgiu pendência"
- **Quando** marco
- **Então** nenhuma tarefa nasce e o caso volta direto ao D1, de onde parou

### Requirement: CA3 · O responsável pela regra do chat
O responsável SHALL seguir a regra do chat de 30/09: citada a pessoa, é ela; citado só o setor, o sistema pergunta quem do setor; sem ninguém citado, pergunta quem é. O responsável MUST NOT ser presumido.

#### Scenario: CA3 · Indicar o responsável
- **Dado** a pendência
- **Quando** indico o responsável
- **Então** se cito a pessoa, é ela; se cito só o setor, o sistema pergunta quem do setor; se não cito ninguém, pergunta quem é

### Requirement: CA4 · O título na Central
A tarefa SHALL aparecer na Central do responsável com o nome do cliente em negrito e "Cumprir pendência", com o que ficou combinado na linha de baixo.

#### Scenario: CA4 · A tarefa aparece na Central
- **Dado** a tarefa criada
- **Quando** aparece na Central do responsável
- **Então** o título é o nome do cliente em negrito + "Cumprir pendência", com o que ficou combinado na linha de baixo

### Requirement: CA5 · O prazo passa: lembrete e escalonamento
Vencido o prazo sem a tarefa cumprida, ela SHALL seguir o laço, o lembrete e o escalonamento: até a régua geral da GGVP-94, o laço da cobrança (vencido, lembrete e urgente; 3 dias depois, a Sênior decide).

#### Scenario: CA5 · O prazo passa
- **Dado** a tarefa criada
- **Quando** o prazo passa sem ser cumprida
- **Então** ela segue o laço, o lembrete e o escalonamento
