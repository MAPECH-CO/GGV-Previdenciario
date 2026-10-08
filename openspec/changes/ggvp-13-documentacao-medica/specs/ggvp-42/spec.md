# Spec Delta · ggvp-42 · Aposentadoria PCD: linha do tempo da deficiência

## Purpose

A advogada responsável vê numa linha do tempo os vínculos do CNIS, a data de início da deficiência, o grau em cada período e os documentos contemporâneos de cada vínculo, para provar a deficiência durante os períodos de contribuição e o grau certo em cada um. Resposta do Lucas de 01/10: o sistema mostra os indicadores de PCD do CNIS e se há insalubridade nos períodos com deficiência. O enquadramento (grau e tempo) é cálculo em código (G19). Resposta do Lucas de 07/10: na entrevista aparecem todos os cenários (leve, moderada e grave) e o tempo como pessoa com deficiência contra o mínimo de 15 anos. Passos D1.13 e D1.21M do Miro. Figma: não há quadro da linha do tempo; os mais próximos são a exigência do INSS da Aposentadoria PCD (`1581:764`, `1581:418`) e o step_D1.13 `14:159`. Contrato na `design.md`, seção GGVP-42.

## ADDED Requirements

### Requirement: CA1 · Cada período com ou sem deficiência
Com os vínculos do CNIS e a data de início da deficiência, a linha do tempo SHALL mostrar cada período como "com deficiência" ou "sem deficiência".

#### Scenario: CA1 · Abrir a linha do tempo
- **Dado** os vínculos do CNIS e a data de início da deficiência
- **Quando** abro a linha do tempo
- **Então** cada período aparece como "com deficiência" ou "sem deficiência"

### Requirement: CA2 · O agravamento muda o grau a partir da data
Registrado um agravamento com data, o grau SHALL mudar a partir dessa data.

#### Scenario: CA2 · Registrar o agravamento
- **Dado** um agravamento com data
- **Quando** o registro
- **Então** o grau muda a partir dessa data

### Requirement: CA3 · Sem prova da época, em cor de ação
O período com deficiência de um vínculo sem documento contemporâneo (laudo, atestado, ASO, contratação por cota) SHALL aparecer em cor de ação, com "sem prova da época".

#### Scenario: CA3 · Vínculo sem documento da época
- **Dado** um vínculo sem documento contemporâneo (laudo, atestado, ASO, contratação por cota)
- **Quando** abro a linha do tempo
- **Então** o período aparece em cor de ação com "sem prova da época"

### Requirement: CA4 · O enquadramento vem do cálculo em código (G19)
O enquadramento dos períodos PCD (grau e tempo) MUST vir do cálculo em código, com teste, em qualquer tela em que aparecer; nunca da IA.

#### Scenario: CA4 · Enquadramento
- **Dado** o enquadramento dos períodos PCD (grau e tempo)
- **Quando** aparece em qualquer tela (por exemplo, na resposta à exigência do INSS)
- **Então** vem do cálculo em código (G19), como mostra a tela `1581:764`
