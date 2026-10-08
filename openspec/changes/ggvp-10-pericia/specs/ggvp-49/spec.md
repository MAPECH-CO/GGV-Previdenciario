# Spec Delta · ggvp-49 · Iniciar a tarefa de perícia

## Purpose

Quando a perícia é pedida em qualquer diagrama (no D2, pela decisão da advogada no D2.03 ou pela exigência do INSS; no D3, pelo despacho da sênior; no D3a, pelo pedido do juiz), o sistema abre sozinho a tarefa de perícia para o Jurídico administrativo, para a perícia seguir um fluxo só e voltar para quem pediu (Lucas, 29/09). Passo DP.01 do Miro. Figma: step_DP.01 `14:534` (com o pedido do Lucas de 02/10: a próxima ação clara, a data em que a tarefa foi aberta, os prazos máximos e o botão até a tarefa), Central de trabalho · Estagiário `2051:173`, chat "perícias para marcar" `2107:892`, Processo do cliente · perícia marcada `2179:2`. Contrato na `design.md`, seção GGVP-49.

## ADDED Requirements

### Requirement: CA1 · O sistema abre a tarefa e o caso mostra "Em perícia"
Registrado o pedido de perícia em D2, D3 ou D3a, o sistema SHALL abrir sozinho a tarefa de perícia para o Jurídico administrativo, e o caso SHALL mostrar "Em perícia" ligado ao diagrama de origem.

#### Scenario: CA1 · Perícia pedida
- **Dado** uma perícia pedida em D2, D3 ou D3a
- **Quando** o pedido é registrado (no D2, a decisão da advogada no D2.03)
- **Então** o sistema abre sozinho a tarefa de perícia para o Jurídico administrativo e o caso mostra "Em perícia" ligado ao diagrama de origem

### Requirement: CA2 · No D2, a tarefa aparece quando o INSS libera o agendamento
Pedida no D2, a tarefa SHALL aparecer na Central do Jurídico administrativo com o título "<nome do cliente> · Marcar perícia" só depois de o INSS liberar o agendamento (espera `D2.E1`). No D3 ela SHALL nascer do despacho da sênior; no D3a, do pedido do juiz.

#### Scenario: CA2 · O INSS liberou o agendamento
- **Dado** a perícia pedida no D2
- **Quando** o requerimento é protocolado e o INSS libera o agendamento (espera externa `D2.E1`)
- **Então** a tarefa aparece na Central do Jurídico administrativo com o título **nome do cliente** · Marcar perícia; no D3, ela nasce do despacho da sênior, e no D3a, do pedido do juiz

### Requirement: CA3 · A tarefa vem preenchida pelo sistema
A tarefa SHALL trazer, preenchidos pelo sistema, quem pediu, o tipo (perícia médica ou avaliação social), a instância (INSS ou juízo) e o que a perícia pede, quando se sabe.

#### Scenario: CA3 · Abrir a tarefa
- **Dado** a tarefa aberta pelo sistema
- **Quando** o Jurídico administrativo a abre
- **Então** ela já traz, preenchidos pelo sistema, quem pediu (D2 · necessidade inicial, D2 · exigência do INSS, D3 · despacho da sênior ou D3a · pedido do juiz), o tipo (perícia médica ou avaliação social), a instância (INSS ou juízo) e o que a perícia pede, quando se sabe

### Requirement: CA4 · O histórico diz que foi o sistema, quando e por qual decisão
O histórico SHALL mostrar que foi o sistema que abriu a tarefa, quando, e qual decisão (e de quem) a originou.

#### Scenario: CA4 · Consultar o histórico
- **Dado** a tarefa aberta
- **Quando** alguém consulta o histórico
- **Então** vê que foi o sistema que abriu, quando, e qual decisão (e de quem) a originou
