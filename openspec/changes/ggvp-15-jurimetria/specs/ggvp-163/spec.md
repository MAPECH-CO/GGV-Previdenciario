# Spec Delta · ggvp-163

## Purpose

A jurimetria do acervo histórico no portal e a chance por etapa do caso (GGVP-163; a regra da chance é decisão do
Lucas, PO, em 16/10/2026). O escritório leu a fundo os autos de 979 processos (679 página a página), e o que eles
ensinam está no banco do portal, no schema `conhecimento`, separado do `public`. O portal passa a ler essa base só
pelas vistas `conhecimento.portal_*`, sem escrever nela: o perfil do perito, os entendimentos do juízo, a busca do
acervo e a IA das etapas, a página de cada benefício e a chance de êxito, que vira por etapa do caso. O importador do
Raio-X ganha a coluna `estudo_social`. Toda taxa sai com o número de casos e a data da base (G22); o número é código
com teste (G19); a IA só resume e sugere.

**Antes de importar:** a Sênior só importa o CSV do Raio-X depois que a regra nova da chance estiver publicada. Com a
regra de hoje, que ignora o acordo e conta a extinção como derrota, a base inteira mostraria 8% para todo LOAS
deficiente. A confirmação da Sênior é o que torna os desfechos conferidos (GGVP-41 CA5). Os critérios CA1 a CA3 e CA6
a CA9 valem com o CSV de 16/10 importado e conferido.

## ADDED Requirements

### Requirement: R1 · O portal lê a base histórica só pelas vistas, sem escrever nela
O portal SHALL ler a base histórica só pelas vistas `conhecimento.portal_trecho`, `portal_perito`,
`portal_juizo_fundamento`, `portal_indicador` e `portal_sintese`, e a data da base em `conhecimento.base`
(chave `data_da_base`). O portal MUST NOT escrever no schema `conhecimento`, MUST NOT gerar migração nele, e o
`schemaFilter` do Drizzle fica só em `public`. Sem o schema (a máquina do dev, os testes sem a base), nada quebra: as
telas mostram "sem base histórica" e as contas seguem só com o acervo do portal.

#### Scenario: CA4 · A base recarregada aparece sem deploy
- **Dado** a base histórica carregada com a data 16/10/2026
- **Quando** a base é recarregada inteira com a data 20/10/2026 e as vistas continuam de pé
- **Então** a página do benefício mostra a data nova sem o portal subir de novo

#### Scenario: CA5 · A API pública não lê o schema
- **Dado** os papéis `anon` e `authenticated` do Supabase
- **Quando** alguém tenta ler qualquer vista do `conhecimento` por eles
- **Então** não há acesso: as vistas são `security_invoker`, sem GRANT para esses papéis, e o portal entra como `postgres`

#### Scenario: Sem a base histórica
- **Dado** um banco sem o schema `conhecimento`
- **Quando** o perito, o juízo, a busca do acervo, a página do benefício ou a chance são pedidos
- **Então** cada um responde só com o que o portal tem, sem erro, e a página do benefício diz que não há base histórica

### Requirement: R2 · O perfil do perito traz os laudos históricos
O perfil do perito (GGVP-152) SHALL juntar aos laudos do portal os laudos históricos de `portal_perito`, casando pelo
nome normalizado ou por uma das grafias, com o número de laudos e de favoráveis contados em código, e o registro
(CRM ou CRESS) quando a base o tem. O laudo histórico entra uma vez só (pelo processo), nunca sobrescreve um laudo do
portal, e fica fora do tempo até o laudo, que a base não tem. Fora do Jurídico, os números seguem escondidos
(GGVP-156 CA2).

#### Scenario: CA1 · O perito de CRM 190.895
- **Dado** a base histórica com o perito de registro 190895, 38 laudos e 11 favoráveis, e o perito nomeado numa perícia do caso
- **Quando** a advogada abre o perfil do perito
- **Então** vê 38 laudos e 11 favoráveis, com a data da base

#### Scenario: Casa pela grafia
- **Dado** o perito do portal gravado como "Dr. Ricardo Zuza" e a base com a grafia "Ricardo Zuza" entre as dele
- **Quando** o perfil é montado
- **Então** os laudos históricos entram no perfil dele

### Requirement: R3 · Os entendimentos do juízo consideram os fundamentos históricos
Os entendimentos do juízo (GGVP-64) SHALL considerar os fundamentos de `portal_juizo_fundamento` do mesmo juízo: a
jurimetria do juízo traz os fundamentos históricos contados em código (quantos processos, por tipo e por benefício,
com processos de exemplo), e a IA, ao tirar os entendimentos recorrentes, lê também esses fundamentos e pode citar os
processos deles como exemplo. O juízo com fundamentos e sem entendimentos entra na rodada da IA.

#### Scenario: CA2 · O juízo "TRF3 · 6301"
- **Dado** a base histórica com fundamentos de 552 processos do juízo "TRF3 · 6301"
- **Quando** a advogada abre a jurimetria do juízo de um caso com número CNJ desse juízo
- **Então** vê "fundamentos de 552 processos", por tipo e por benefício, com processos de exemplo

### Requirement: R4 · Os trechos históricos entram na busca do acervo e na IA das etapas
A busca do acervo e a IA das etapas SHALL incluir os trechos de `portal_trecho`, pelo benefício, com a origem visível
("Base histórica · fundamento", "Base histórica · laudo"). O acervo que se alimenta sozinho SHALL gravar esses trechos
em `acervo_trecho` pelo `hash` da vista, sem duplicar, e o portal calcula o vetor deles como dos outros. O trecho só do
Jurídico (`so_juridico`) segue a mesma regra dos outros: fora do Jurídico, não entra.

#### Scenario: A busca acha o trecho histórico
- **Dado** a base histórica com um fundamento sobre renda per capita no LOAS deficiente
- **Quando** a IA busca "renda per capita" para um caso de LOAS deficiente
- **Então** o trecho vem entre as fontes, com a origem "Base histórica · fundamento" e a referência do processo

#### Scenario: Sem duplicar
- **Dado** o acervo já alimentado com os trechos históricos
- **Quando** a rodada de alimentar roda de novo
- **Então** nenhum trecho histórico entra duas vezes (pelo `hash`)

### Requirement: R5 · A página de cada benefício mostra a síntese e as taxas
A página de cada benefício SHALL mostrar a síntese de `portal_sintese` (em Markdown, na ordem) e as taxas de
`portal_indicador` do recorte geral e por ano, sempre com o número de casos e a data da base (G22). Só o Jurídico e
o Sócio veem (`estudo.ver`). Sem a base, a página diz que não há base histórica.

#### Scenario: CA3 · LOAS deficiente, êxito com laudo desfavorável
- **Dado** a base histórica com o indicador de êxito com laudo desfavorável do LOAS deficiente em 4 de 115
- **Quando** a advogada abre a página do LOAS deficiente
- **Então** vê "êxito com laudo desfavorável: 4 de 115" e a data da base

#### Scenario: Quem não vê
- **Dado** o Atendimento
- **Quando** pede a página de um benefício
- **Então** recebe 403, e a tela não oferece o link

### Requirement: R6 · A chance de êxito é por etapa do caso
A chance de êxito (GGVP-131, GGVP-150, GGVP-151) SHALL ser por etapa do caso, sobre os desfechos conferidos do acervo
com o mesmo benefício. Antes da perícia é o êxito no mérito: ganho é procedente, procedente em parte, deferido e
acordo; perda é improcedente; extinção sem mérito e desistência ficam fora da conta. Depois do laudo é a mesma conta,
só entre os casos com o mesmo resultado de laudo (favorável ou desfavorável); no LOAS idoso quem decide é o estudo
social, que faz o papel do laudo. Se o recorte da etapa não tem caso, a chance é a da etapa anterior, com aviso. O
benefício "outro" não tem chance, porque mistura matérias.

#### Scenario: CA6 · Antes da perícia
- **Dado** o acervo conferido com os 192 decididos no mérito do LOAS deficiente (63 ganhos, com 38 acordos; 159 extinções fora), os 81 do LOAS idoso (31 ganhos) e os 33 do auxílio por incapacidade (9 ganhos)
- **Quando** a chance é pedida antes da perícia
- **Então** dá 33% (63 de 192) no LOAS deficiente, 38% (31 de 81) no LOAS idoso e 27% (9 de 33) no auxílio por incapacidade

#### Scenario: CA7 · Depois do laudo
- **Dado** o acervo conferido com o resultado do laudo de cada caso
- **Quando** a chance é pedida num caso com laudo favorável e num caso com laudo desfavorável
- **Então** dá 76% (55 de 72) e 3% (4 de 115) no LOAS deficiente, e 90% (9 de 10) e 0% (0 de 22) no auxílio por incapacidade

#### Scenario: CA8 · O estudo social no LOAS idoso
- **Dado** o acervo conferido com o resultado do estudo social de cada caso de LOAS idoso
- **Quando** a chance é pedida num caso com estudo favorável e num caso com estudo desfavorável
- **Então** dá 65% (28 de 43) e 0% (0 de 35)

#### Scenario: CA9 · A regra antiga sumiu
- **Dado** o acervo conferido do LOAS deficiente
- **Quando** a chance é pedida em qualquer caso de LOAS deficiente
- **Então** nenhum mostra os 8% da regra antiga (extinção como derrota, acordo fora)

#### Scenario: O recorte vazio cai na etapa anterior
- **Dado** um benefício com decididos no mérito, mas nenhum com laudo desfavorável
- **Quando** a chance é pedida num caso com laudo desfavorável
- **Então** mostra a taxa de antes da perícia, com o aviso de que não há caso com o mesmo laudo

#### Scenario: O benefício "outro"
- **Dado** um caso com benefício "outro"
- **Quando** a chance é pedida
- **Então** não há porcentagem, e a regra diz que "outro" mistura matérias

### Requirement: R7 · O importador do Raio-X aceita a coluna estudo_social
O importador do Raio-X (GGVP-148) SHALL aceitar a coluna `estudo_social` (sim ou não), que o CSV já traz, e guardar
no acervo junto com o laudo (`estudo_social_favoravel`). Os indicadores do Raio-X ganham a taxa do estudo social
favorável, com o número de casos.

#### Scenario: A coluna entra
- **Dado** uma planilha com a coluna `estudo_social`
- **Quando** a Sênior simula e confirma
- **Então** cada processo guarda o estudo social (sim, não ou vazio), e a coluna não aparece entre as ignoradas

#### Scenario: Valor fora de sim ou não
- **Dado** uma linha com `estudo_social` = "talvez"
- **Quando** a Sênior simula
- **Então** a linha sai com o erro "estudo social: use sim ou não"
