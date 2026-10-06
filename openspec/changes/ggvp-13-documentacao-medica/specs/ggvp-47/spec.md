# Spec Delta · ggvp-47 · Auxílio-Acidente: prova do acidente

## Purpose

A Documentação confere o checklist do Auxílio-Acidente (e do auxílio acidentário) com os documentos que provam o acidente, a consolidação e o nexo: CAT, boletim de ocorrência, ficha do pronto-socorro, prontuário da internação ou cirurgia e exames de imagem da época e posteriores à alta. Resposta do Lucas de 01/10, que fecha a Q19: cada documento é obrigatório (O), desejável (D) ou condicional (C) conforme a circunstância (trabalho, trajeto, doença ocupacional, trânsito ou doméstico), que também define a espécie (B94 ou B36); CAT e PPP têm válvula (o empregador recusa, vira pendência e não trava); contribuinte individual e facultativo travam na categoria; o empregado doméstico só tem direito a partir da LC 150/2015; o boletim de ocorrência é desejável em todas; o checklist fica completo com todos os O e os C que se aplicam, e os D não contam para o G1; laudo de lesão não consolidada ou sem redução da capacidade dispara o G18, e na lesão não consolidada o sistema sugere a troca para auxílio por incapacidade. Passos D1.21 e D1.24 do Miro. Figma: step_D1.21 `1818:2`, step_D1.24 `10:264` e o parecer médico `1654:2`; não há quadro da escolha da circunstância. Contrato na `design.md`, seção GGVP-47.

## ADDED Requirements

### Requirement: CA1 · Os complementares no checklist, cada um com o status próprio
No caso de Auxílio-Acidente, o checklist SHALL mostrar os documentos complementares da circunstância, cada um com a exigência (obrigatório, desejável ou condicional) e a situação própria.

#### Scenario: CA1 · Abrir o checklist do Auxílio-Acidente
- **Dado** um caso de Auxílio-Acidente
- **Quando** abro o checklist
- **Então** os documentos complementares aparecem, cada um com o status próprio

### Requirement: CA2 · A circunstância ajusta o que é obrigatório
Marcada a circunstância do acidente, o checklist SHALL ajustar o que é obrigatório: a CAT só com vínculo e acidente de trabalho, de trajeto ou doença ocupacional; o PPP só na doença ocupacional com vínculo. Contribuinte individual e facultativo MUST travar na categoria, e o empregado doméstico com acidente antes da LC 150/2015 também.

#### Scenario: CA2 · Marcar a circunstância
- **Dado** um acidente de trajeto, trânsito ou doméstico
- **Quando** marco a circunstância
- **Então** o checklist ajusta o que é obrigatório (por exemplo, CAT só quando há vínculo e acidente de trabalho ou trajeto)

### Requirement: CA3 · Completo calculado dos documentos; só libera completo (G1)
O sistema SHALL calcular "completo" ou "incompleto" a partir dos documentos classificados no caso: completo com todos os obrigatórios e os condicionais que se aplicam; os desejáveis não contam; a CAT ou o PPP recusados pelo empregador ficam como pendência que não trava. O caso MUST ser liberado ao Jurídico só com o checklist completo (G1).

#### Scenario: CA3 · Conferir o checklist
- **Dado** os documentos classificados no caso
- **Quando** o checklist do Auxílio-Acidente é conferido
- **Então** o sistema calcula "completo" ou "incompleto" a partir deles, e o caso só é liberado ao Jurídico com o checklist completo (G1)

### Requirement: CA4 · Lesão não consolidada trava (G18)
Um laudo que diga que a lesão ainda não está consolidada, ou que não aponte redução da capacidade (a redução mínima basta, Tema 416 do STJ), MUST travar o caso na conferência antes de liberar (G18). Na lesão não consolidada, a trava SHALL sugerir a troca para auxílio por incapacidade temporária. A trava vale enquanto uma pessoa do Jurídico não conferir a análise da IA no parecer.

#### Scenario: CA4 · Laudo de lesão não consolidada
- **Dado** um laudo que diga que a lesão ainda não está consolidada
- **Quando** a Documentação confere o caso antes de liberar (D1.24)
- **Então** o caso trava (G18)
