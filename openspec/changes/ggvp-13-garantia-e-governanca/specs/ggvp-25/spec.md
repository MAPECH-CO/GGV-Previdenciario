# Spec Delta · ggvp-25

## Purpose

Regras objetivas calculadas por código (G19): as quatro regras numéricas do roteiro de laudos saem de funções puras, versionadas e com teste, nunca da IA. A tela médica que confere a documentação ou a perícia (épico do Pedro) chama o cálculo e guarda o resultado com a versão. Valores com a lei citada: 24 meses (Lei 8.742, art. 20, §10); mais de 15 dias e janela de 60 dias (Decreto 3.048, art. 75, §§ 4º e 5º); carência de 12 contribuições, 6 depois de perder a qualidade, isenção marcada pela advogada (Lei 8.213, arts. 25, I, 26, II e 27-A); qualidade de segurado por 12 meses, mais 12 com mais de 120 contribuições sem perda, mais 12 com desemprego comprovado, até o dia 15 do segundo mês depois do fim da graça (Lei 8.213, art. 15; Decreto 3.048, art. 14).

## ADDED Requirements

### Requirement: CA1 · BPC/LOAS Deficiente: 24 meses
Com a data de início do impedimento e o prognóstico, o sistema SHALL mostrar a duração em meses e sinalizar se alcança 24 meses. A duração vai do início até a maior data entre a cessação prevista e hoje, se o impedimento ainda persiste; com prognóstico permanente, alcança.

#### Scenario: CA1 · Impedimento de longo prazo
- **Dado** um caso de BPC/LOAS Deficiente com data de início do impedimento e prognóstico
- **Quando** o sistema calcula
- **Então** mostra a duração em meses e sinaliza se alcança 24 meses (por exemplo, início em 2024 e ainda presente; ou diagnóstico em 2026 com prognóstico até pelo menos 2028)

### Requirement: CA2 · Incapacidade temporária: mais de 15 dias na janela de 60 dias
O sistema SHALL somar só os atestados que a advogada marcou como clinicamente correlacionados, encadeados quando o seguinte começa até 60 dias depois do fim do anterior, e MUST sinalizar se a soma passa de 15 dias. O atestado sem correlação fica de fora, listado.

#### Scenario: CA2 · Somar afastamentos
- **Dado** um caso de Auxílio por Incapacidade Temporária
- **Quando** o sistema soma os afastamentos
- **Então** só soma atestados cujas doenças a advogada marcou como clinicamente correlacionadas e dentro de 60 dias, e sinaliza se passa de 15 dias

### Requirement: CA3 · Aposentadoria PCD: períodos na condição
Cruzando a data de início da deficiência (e a de fim, se transitória) com os vínculos do CNIS, o sistema SHALL mostrar os períodos de cada vínculo que contam como tempo na condição de PCD e o total.

#### Scenario: CA3 · Cruzar com o CNIS
- **Dado** uma Aposentadoria PCD
- **Quando** o sistema cruza a data de início da deficiência com os vínculos do CNIS
- **Então** mostra quais períodos contam como tempo na condição de PCD (GGVP-42)

### Requirement: CA4 · Dado que falta: não calculável (G19)
Faltando um dado de entrada, o resultado MUST ser "não calculável: falta X", com o que falta, e MUST NOT ser um palpite.

#### Scenario: CA4 · Entrada incompleta
- **Dado** qualquer regra
- **Quando** um dado de entrada falta
- **Então** o resultado é "não calculável: falta X", nunca um palpite (G19)

### Requirement: CA5 · DII com carência e qualidade de segurado
Com a DII e as competências contribuídas, o sistema SHALL mostrar se a DII é compatível com a carência (12 contribuições antes da DII; 6 desde a nova filiação, se perdeu a qualidade antes; nenhuma, se a advogada marcou a isenção) e com a qualidade de segurado (mantida até o dia 15 do segundo mês depois do fim do período de graça), calculado por código.

#### Scenario: CA5 · Conferir a DII
- **Dado** um caso de incapacidade com a data de início da incapacidade (DII)
- **Quando** a advogada confere o resultado da perícia ou a documentação
- **Então** o sistema mostra se a DII é compatível com a carência e a qualidade de segurado, calculado por código

### Requirement: CA6 · Entradas, regra e versão à vista
Cada resultado SHALL trazer os dados de entrada usados, a regra aplicada com o fundamento e a versão. Mudar a regra MUST subir a versão; quem guarda o resultado no caso guarda a versão junto.

#### Scenario: CA6 · Resultado na tela
- **Dado** um resultado calculado
- **Quando** aparece na tela
- **Então** mostra os dados de entrada usados e a regra aplicada; uma mudança de regra gera nova versão, e o caso mostra a versão usada

### Requirement: CA7 · O número vem do código
O número exibido MUST vir do cálculo em código, nunca do modelo. Sem IA até o épico IA jurídica, só o código calcula; quando a IA explicar, ela lê o resultado deste cálculo.

#### Scenario: CA7 · A IA explica um número
- **Dado** que a IA explica um número (no chat ou num resumo)
- **Quando** responde
- **Então** o número exibido vem do cálculo em código, nunca do modelo

### Requirement: CA8 · Mesmo insumo, mesmo resultado
O cálculo MUST ser determinístico (a data de referência entra como dado), e SHALL haver teste automatizado para cada regra: 24 meses, 15 dias, janela de 60 dias, períodos PCD e DII × carência.

#### Scenario: CA8 · Recalcular
- **Dado** o mesmo insumo
- **Quando** o cálculo roda de novo
- **Então** o resultado é o mesmo; há teste automatizado para cada regra do roteiro (24 meses, 15 dias, janela de 60 dias, períodos PCD, DII × carência)
