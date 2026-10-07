# Spec Delta · ggvp-75

## Purpose

Painel de resultado para os sócios: a Gestão mostra os indicadores do escritório no período, calculados em código a partir dos desfechos gravados, cada um com o número de casos.
- **Recortes:** benefício, perito, juízo e advogada.
- **Destaques:** as extinções sem mérito, com a causa; e os pareceres dispensados comparados aos suficientes.
- **Valores:** os totais em dinheiro aparecem só para o Sócio e o Financeiro.
- **Amostra:** toda taxa aparece com o número de casos ao lado e a data da base; não há amostra mínima (G22, regra de 07/10).
- **Referências:** o Raio-X de 979 processos entra como referência. A operação de 2026 e a base do acervo mostram "sem dados ainda" enquanto não houver dado.

Quem vê: a Gestão (Sócio, Sênior, líder do Atendimento e Financeiro). Q20: o Sócio é perfil do portal; o Pedro levou a confirmação ao Lucas em 07/10.

## ADDED Requirements

### Requirement: CA1 · Cada indicador com o número de casos
O painel SHALL mostrar, no período, os seguintes indicadores, cada um com o número de casos que o compõe:
- a taxa de deferimento no INSS;
- a procedência na Justiça;
- as extinções sem mérito;
- as exigências cumpridas no prazo;
- os pareceres dispensados;
- o tempo até o dinheiro.

O painel SHALL ter o recorte por benefício, perito, juízo e advogada.

#### Scenario: CA1 · Abrir o painel
- **Dado** casos encerrados no período
- **Quando** abro o painel
- **Então** vejo cada indicador com o número de casos que o compõe

### Requirement: CA2 · Extinção sem mérito em destaque
A extinção sem mérito registrada no "Confirmar desfecho" (GGVP-37 CA5) SHALL aparecer em destaque no painel, com a causa registrada. A meta é zero.

#### Scenario: CA2 · Extinção registrada
- **Dado** uma extinção sem mérito
- **Quando** a advogada a registra no "Confirmar desfecho" (GGVP-37 CA5), com a causa
- **Então** ela aparece em destaque no painel, com a causa registrada (meta: zero)

### Requirement: CA3 · Pareceres dispensados comparados aos suficientes
O painel SHALL mostrar quantos pareceres médicos a Sênior dispensou. Também SHALL mostrar o resultado desses casos comparado aos casos com parecer "Suficiente".

#### Scenario: CA3 · Abrir o painel
- **Dado** pareceres médicos dispensados pela sênior
- **Quando** abro o painel
- **Então** vejo quantos, e o resultado desses casos comparado aos com parecer "Suficiente"

### Requirement: CA4 · Valores só para o Financeiro e o Sócio
Os honorários recebidos e o tempo até o recebimento SHALL aparecer só para o Financeiro e o Sócio, em total do escritório. Os demais perfis MUST NOT ver valores: o servidor não os manda.

#### Scenario: CA4 · Financeiro ou Sócio
- **Dado** o perfil Financeiro ou sócio
- **Quando** abro o painel
- **Então** vejo honorários recebidos e tempo até o recebimento; os demais perfis não veem valores

### Requirement: CA5 · Raio-X e operação só com dado real
A Gestão SHALL mostrar os indicadores do Raio-X Previdenciário (979 processos lidos) como referência. A operação de 2026 MUST aparecer só com dados reais. Enquanto não houver casos, ela SHALL mostrar "sem dados ainda".

#### Scenario: CA5 · Abrir a Gestão
- **Dado** a Gestão
- **Quando** abro
- **Então** vejo também os indicadores do Raio-X Previdenciário (979 processos lidos): êxito dos decididos por safra, falha nossa provada, laudo médico favorável, extinção por não cumprir determinação, cliente que faltou à perícia, recurso provido, o que o cartório mais cobra e onde julgam; a operação de 2026 aparece só com dados reais e, enquanto não houver casos, mostra "sem dados ainda"

### Requirement: CA6 · Base do acervo
A Gestão SHALL mostrar a linha "Base do acervo", com os totais e a data da base em uso (decisão do Pedro de 30/09, a confirmar com o PO). Sem acervo (GGVP-55), a linha mostra "sem dados ainda".

#### Scenario: CA6 · Abrir a Gestão
- **Dado** a Gestão
- **Quando** abro
- **Então** vejo a linha "Base do acervo", com os totais e a data da base em uso

### Requirement: CA7 · Cálculo em código, dado incerto fora
Cada indicador MUST vir de cálculo em código a partir dos desfechos gravados. O caso com dado incerto SHALL ficar fora das contas, e nada trava.

#### Scenario: CA7 · Mostrar um indicador
- **Dado** cada indicador
- **Quando** é mostrado
- **Então** vem de cálculo em código a partir dos desfechos gravados; caso com dado incerto fica fora das contas e nada trava

### Requirement: CA8 · Toda taxa com os casos e a data da base (G22)
Um recorte com poucos casos SHALL mostrar a taxa com o número de casos ao lado e a data da base. Não há amostra mínima: toda carteira MUST aparecer (G22; Lucas, 06/10; Pedro, 07/10).

#### Scenario: CA8 · Poucos casos
- **Dado** um recorte com poucos casos
- **Quando** aparece
- **Então** mostra a taxa com o número de casos ao lado e a data da base; não há amostra mínima, toda carteira aparece (G22; Lucas, 06/10; Pedro, 07/10)
