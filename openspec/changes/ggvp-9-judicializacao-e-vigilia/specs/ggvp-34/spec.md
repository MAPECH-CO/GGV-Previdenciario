# Spec Delta · ggvp-34

## Purpose

Classificar o ato e contar o prazo: a pessoa classifica o ato (até o épico IA, resposta do revisor de 06/10) e o sistema conta o prazo em código, pela Lei 11.419 e pelo CPC, pelo lado mais seguro (G12, G19). A contagem do prazo do INSS (CA11) já existe desde a GGVP-39.

## ADDED Requirements

### Requirement: CA1 · O tipo de ato aparece e pode ser corrigido
A classificação do ato (só andamento, exigência ou decisão de mérito) SHALL aparecer na publicação e SHALL poder ser corrigida pelo Jurídico. Até o épico IA, quem classifica é a pessoa.

#### Scenario: CA1 · Publicação casada
- **Dado** uma publicação casada
- **Quando** é classificada
- **Então** o tipo de ato aparece e pode ser corrigido pelo Jurídico

### Requirement: CA2 · Contagem pela Lei 11.419 e pelo CPC, pelo lado seguro
A contagem MUST considerar a publicação feita no primeiro dia útil depois da disponibilização e começar no dia útil seguinte (Lei 11.419, art. 4º); MUST contar em dias úteis (CPC, art. 219; JEF, Lei 9.099, art. 12-A); sem prazo na decisão, MUST usar 5 dias (CPC, art. 218, §3º); e, na dúvida, MUST ficar com a data mais cedo (G12).

#### Scenario: CA2 · Contar o prazo
- **Dado** o tipo de ato
- **Quando** o sistema conta o prazo
- **Então** considera a publicação no primeiro dia útil depois da disponibilização, começa no dia útil seguinte, conta em dias úteis, usa 5 dias sem prazo na decisão e, na dúvida, a data mais cedo

### Requirement: CA3 · Data inicial, final e regra visíveis
A publicação SHALL mostrar a data inicial, a data final e a regra usada.

#### Scenario: CA3 · Abrir a publicação
- **Dado** o prazo contado
- **Quando** abro a publicação
- **Então** vejo a data inicial, a final e a regra usada

### Requirement: CA4 · Classificação com quem e justificativa
Enquanto não há IA, a classificação SHALL registrar quem classificou e quando; a confiança e a justificativa da IA ficam para o épico IA.

#### Scenario: CA4 · Classificação registrada
- **Dado** uma publicação classificada
- **Quando** a classificação termina
- **Então** ficam quem classificou e quando

### Requirement: CA5 · Confirmar ou reclassificar
A pessoa SHALL confirmar "A classificação está certa?" ou reclassificar (só andamento, exigência, decisão de mérito), e a tela SHALL lembrar que o prazo foi contado pelo lado seguro (G12).

#### Scenario: CA5 · Reclassificar
- **Dado** a leitura
- **Quando** abro a publicação
- **Então** confirmo a classificação ou reclassifico, e a tela lembra que o prazo foi contado pelo lado seguro

### Requirement: CA6 · Regra versionada
Cada prazo MUST guardar a regra e a versão da regra usadas; mudar a regra SHALL subir a versão.

#### Scenario: CA6 · Regra muda
- **Dado** uma regra de contagem de prazo
- **Quando** ela muda
- **Então** a mudança é versionada e o prazo mostra qual versão da regra usou

### Requirement: CA7 · Testes com feriado, fim de semana e suspensão
Os testes da contagem MUST cobrir publicação em véspera de feriado, em fim de semana e em suspensão, sempre com o resultado pelo lado seguro.

#### Scenario: CA7 · Testes rodam
- **Dado** os testes da contagem
- **Quando** rodam
- **Então** cobrem véspera de feriado, fim de semana e suspensão, pelo lado seguro

### Requirement: CA8 · O número vem do código
O prazo exibido MUST vir sempre do cálculo em código, e o mesmo insumo MUST gerar sempre o mesmo resultado.

#### Scenario: CA8 · Prazo exibido
- **Dado** um prazo exibido
- **Quando** é explicado
- **Então** o número vem do cálculo em código, e o mesmo insumo gera sempre o mesmo resultado

### Requirement: CA9 · Calendário do tribunal entra na conta
Os feriados e suspensões cadastrados para o tribunal do processo (tirado do número CNJ) e os nacionais SHALL entrar na contagem; sem cadastro, só o fim de semana conta e a tela avisa.

#### Scenario: CA9 · Calendário
- **Dado** o calendário de feriados e de suspensões de cada tribunal
- **Quando** o prazo é contado
- **Então** o calendário entra na conta

### Requirement: CA10 · Reclassificações contadas
Cada reclassificação SHALL ficar registrada, para medir o acerto da IA quando ela existir.

#### Scenario: CA10 · Reclassificações
- **Dado** as reclassificações feitas pela advogada
- **Quando** somadas
- **Então** servem como medida de acerto da IA

### Requirement: CA11 · Prazo do INSS em dias corridos
O prazo do INSS SHALL ser contado em dias corridos e, se o fim cair em dia sem expediente, passar para o próximo dia útil (Lei 9.784, art. 66). Já entregue com a GGVP-39.

#### Scenario: CA11 · Exigência do INSS
- **Dado** um prazo do INSS
- **Quando** o sistema conta
- **Então** usa dias corridos e, se o fim cair em dia sem expediente, passa para o próximo dia útil

### Requirement: CA12 · Os feriados da lei já vêm cadastrados
Com banco de verdade (homologação e produção) e a tabela de feriados vazia, a API SHALL carregar ao subir os feriados e as suspensões da lei de 2026 e 2027 (os mesmos do "carregar" da Configuração, GGVP-146 parte 3), com o registro no histórico; com algum feriado já na tabela, MUST NOT mexer, para não refazer o que a Sênior tirou ou acrescentou (P17 do roteiro; orquestrador, 09/10).

#### Scenario: CA12 · Primeira subida
- **Dado** a homologação com a tabela de feriados vazia
- **Quando** a API sobe
- **Então** os feriados da lei de 2026 e 2027 entram, e o prazo passa a pular os feriados

#### Scenario: CA12 · Lista já mexida
- **Dado** a tabela com algum feriado
- **Quando** a API sobe de novo
- **Então** nada muda
