# Spec Delta · ggvp-33 · Portão: sem parecer, o caso não anda

## Purpose

O caso só é liberado ao Jurídico, aprovado para o INSS ou tem petição pedida com o parecer médico "Suficiente" confirmado por pessoa, ou com a dispensa justificada pela sênior, para nenhum pedido sair com prova médica fraca por pressa (G17). A dispensa pede duas sêniores de acordo, com justificativa, e as duas aprovações ficam no histórico (resposta do Lucas de 01/10, Q14). O roteiro vale igual na via administrativa e na judicial (Q15). No D1.24, quem aperta o OK é a Documentação · ADM. Passos D1.24, D2.01 e D3.05 do Miro. Figma: step_D1.24 `10:264`, step_D2.01 `16:2`, step_D3.05 `14:311`, Overlay · Parecer médico `1654:2`; não há quadro da dispensa. As telas do D2.01 (GGVP-23) e do D3.05 (GGVP-63) são de outras histórias e usam a mesma regra. Fora do escopo: a validação de todos os portões no servidor contra chamada direta (GGVP-109). Contrato na `design.md`, seção GGVP-33.

## ADDED Requirements

### Requirement: CA1 · Sem parecer em ordem, as três ações travam e dizem o que falta (G17)
Com o parecer "Insuficiente", "Contraditório" ou sem confirmação humana, liberar ao Jurídico (D1.24), aprovar para o INSS (D2.01) e pedir a petição (D3.05) MUST ficar bloqueados, e o portal SHALL mostrar o que falta.

#### Scenario: CA1 · Tentar seguir sem parecer
- **Dado** um parecer "Insuficiente", "Contraditório" ou sem confirmação humana
- **Quando** alguém tenta liberar ao Jurídico (o OK da Documentação no `D1.24`), aprovar para o INSS ou pedir a petição
- **Então** a ação fica bloqueada e mostra o que falta (G17)

### Requirement: CA2 · A dispensa da sênior exige justificativa e aparece no card
A dispensa do parecer MUST exigir a justificativa e duas sêniores de acordo (Q14); a justificativa SHALL aparecer no card e ficar registrada para o painel de indicadores (GGVP-75).

#### Scenario: CA2 · Dispensar o parecer
- **Dado** que sou sênior
- **Quando** dispenso o parecer
- **Então** o portal exige a justificativa, e ela aparece no card e no painel de indicadores (GGVP-75)

### Requirement: CA3 · O chat recusa pular o parecer
O pedido no chat para pular o parecer MUST ser recusado: sem card de confirmação, o chat SHALL responder com o portão que falta.

#### Scenario: CA3 · Pedido no chat
- **Dado** o chat (GGVP-82)
- **Quando** alguém pede para pular o parecer
- **Então** o pedido é recusado. O chat só executa algo com card de confirmação; aqui não há card: ele recusa e diz o portão que falta

### Requirement: CA4 · No D1.24, "Liberar ao Jurídico" pede o parecer Suficiente
Na tela do D1.24, "Liberar ao Jurídico" SHALL habilitar só com os itens de "Conferir" marcados, entre eles "Parecer médico Suficiente (G17)".

#### Scenario: CA4 · A Documentação confere
- **Dado** a tela do `D1.24`
- **Quando** a Documentação confere o caso
- **Então** "Liberar ao Jurídico" só habilita com os itens de "Conferir" marcados, entre eles "Parecer médico Suficiente (G17)"

### Requirement: CA5 · O parecer refeito vale nos passos seguintes
Registrado o parecer novo depois de um laudo novo, a trava do G17 SHALL considerar o parecer novo nos passos seguintes (D2.01, D3.05).

#### Scenario: CA5 · Parecer refeito
- **Dado** um laudo novo que leva a advogada a refazer o parecer (`D1.21M`)
- **Quando** o parecer novo é registrado
- **Então** a trava do G17 passa a considerar o parecer novo nos passos seguintes (`D2.01`, `D3.05`)
