# Spec Delta · ggvp-50 · BPC/LOAS de menor de 16 anos

## Purpose

A advogada responsável não monta o caso da criança com o roteiro do adulto: no LOAS Deficiente de beneficiário menor de 16 anos, a matriz troca a incapacidade para o trabalho pelo impacto na participação social e nas atividades da idade, e pede os relatórios que provam o caso. Resposta do Lucas de 01/10: o checklist infantil é por condição. O relatório escolar vale para todas; o do CAPS só na saúde mental; o da neurologia na paralisia cerebral, na má formação e nos casos parecidos; fono, terapia ocupacional e psicologia conforme a terapia que a criança faz; e o item da necessidade de cuidados que limitam o trabalho dos responsáveis continua valendo. Passo D1.21M do Miro. Figma: não há quadro do roteiro infantil; o parecer (step_D1.21M `14:195`, Overlay · Parecer médico `1654:2`) só mostra exemplos de adulto. Contrato na `design.md`, seção GGVP-50.

## ADDED Requirements

### Requirement: CA1 · Menor de 16 anos usa o roteiro infantil
No LOAS Deficiente com beneficiário menor de 16 anos pela data de nascimento, a análise SHALL usar o roteiro infantil, calculado por código a partir da data de nascimento e do dia da análise.

#### Scenario: CA1 · A análise roda
- **Dado** um LOAS Deficiente com beneficiário menor de 16 anos pela data de nascimento
- **Quando** a análise roda
- **Então** usa o roteiro infantil

### Requirement: CA2 · Os relatórios por condição e o item dos cuidados
Com o roteiro infantil, o checklist SHALL mostrar os relatórios pela condição da criança (escolar só para quem frequenta escola ou creche, resposta do Lucas de 07/10; CAPS na saúde mental; neurologia na paralisia cerebral, na má formação e parecidos; fonoaudiologia, terapia ocupacional e psicologia conforme a terapia) e o roteiro SHALL ter o item "necessidade de cuidados que limitam o trabalho dos responsáveis". A condição é dado de saúde: só o Jurídico a marca e a vê.

#### Scenario: CA2 · Abrir o checklist
- **Dado** o roteiro infantil
- **Quando** abro o checklist
- **Então** aparecem relatórios escolares, de fonoaudiologia, terapia ocupacional, psicologia e CAPS, e o item "necessidade de cuidados que limitam o trabalho dos responsáveis"
