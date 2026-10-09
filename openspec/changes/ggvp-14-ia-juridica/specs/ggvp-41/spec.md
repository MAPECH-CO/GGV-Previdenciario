# Spec Delta · ggvp-41

## Purpose

Medir ganho e perda e gravar no acervo: cada desfecho do portal, bom ou ruim, entra no acervo com a ficha (matéria, vara, tese, resumo e lição), escrita pela IA sem dado pessoal e conferida pela Sênior; a Gestão mede o resultado por matéria, vara e tese, com os números calculados em código e a regra do G22.
- **Parte 1 (08/10):**
  - a ficha do desfecho no acervo, da IA em segundo plano;
  - o caso perdido entra no acervo pelo estudo de caso;
  - a Sênior confere a ficha e a tese em "Conferir desfechos";
  - o recorte por tese na Gestão;
  - a falha da IA visível e tentada de novo.
- **Já coberto:**
  - o caso ganho entra no acervo na ida ao banco (GGVP-98);
  - o motivo de indeferimento na busca do acervo, ligado ao benefício (GGVP-45);
  - o painel por benefício e por juízo, com o número de casos e a data da base (GGVP-75).
- **Parte 2:**
  - o caso perdido na Justiça registrado pelo próprio portal (com a GGVP-100);
  - a vara pelo nome (GGVP-64, parte 2);
  - a lição no acervo de trechos da busca por significado (GGVP-141).

Quem confere: a Sênior. A ficha não leva CPF, endereço, telefone nem CID.

## ADDED Requirements

### Requirement: CA1 · O desfecho bom ou ruim entra no acervo com resumo, resultado e lição
Quando um processo bom ou ruim for gravado, o acervo SHALL guardar o resumo, o resultado e a lição, e o texto de referência MUST NOT levar dado pessoal do cliente.
- **Parte 1:** o caso ganho já entra na ida ao banco e ganha a ficha da IA; o caso perdido entra quando o estudo de caso sai, com a ficha do estudo.
- **Parte 2:** o perdido na Justiça registrado pelo portal (GGVP-100).

#### Scenario: CA1 · Processo bom ou ruim
- **Dado** um processo bom ou ruim vindo do D3b
- **Quando** é gravado
- **Então** o acervo guarda resumo, resultado e lição, sem dado pessoal do cliente no texto de referência

### Requirement: CA2 · O motivo de indeferimento entra ligado ao benefício
O motivo de indeferimento SHALL entrar no acervo ligado ao benefício. **Coberto pela busca no acervo (GGVP-45).**

#### Scenario: CA2 · Motivo de indeferimento
- **Dado** um motivo de indeferimento vindo do D3
- **Quando** é gravado
- **Então** entra no acervo ligado ao benefício

### Requirement: CA3 · A Gestão mostra o resultado por matéria, vara e tese
A Gestão SHALL mostrar o resultado por matéria, vara e tese.
- **Parte 1:** o recorte novo "Tese", das fichas conferidas; a matéria é o recorte por benefício e a vara é o recorte por juízo (tribunal e unidade de origem), que já existem.
- **Parte 2:** a vara pelo nome.

#### Scenario: CA3 · Gestão
- **Dado** o acervo
- **Quando** abro a Gestão
- **Então** vejo o resultado por matéria, vara e tese

### Requirement: CA4 · O acervo se atualiza sozinho
Um desfecho novo SHALL entrar no acervo sozinho, sem tarefa de alimentar.
- **Parte 1:** o desfecho do portal ganha a ficha da IA em segundo plano, como a sugestão pronta.
- **Fora desta história:** documento do portal e arquivo do Drive (GGVP-141); a base histórica (GGVP-55).

#### Scenario: CA4 · Desfecho novo
- **Dado** um desfecho novo lido pela vigília (D4), um documento que entrou pelo portal ou um arquivo da pasta do Drive
- **Quando** entra
- **Então** o acervo se atualiza sozinho, sem tarefa de alimentar; a base histórica foi importada uma vez na implantação (GGVP-55)

### Requirement: CA5 · Dado incerto fica fora das contas
Desfecho sem tese, ou sem o dado do recorte, MUST ficar fora das contas daquele recorte, e nada trava.

#### Scenario: CA5 · Dado incerto
- **Dado** um desfecho com dado incerto (por exemplo, vara ou tese não identificada)
- **Quando** o sistema mede
- **Então** esse caso fica fora das contas e nada trava; se houver trabalho real a fazer, ele vira tarefa normal na Central de quem faz

### Requirement: CA6 · Cada desfecho guarda a ficha completa
Cada desfecho gravado SHALL guardar o tipo, a matéria, a vara, a tese, o resultado, o resumo e a lição, com a data e a referência do caso de origem.
- O tipo vem do resultado (bom ou ruim); a data e a referência são as do registro do acervo.

#### Scenario: CA6 · Desfecho gravado
- **Dado** cada desfecho gravado
- **Quando** entra no acervo
- **Então** guarda o tipo, a matéria, a vara, a tese, o resultado, o resumo e a lição, com a data e a referência do caso de origem

### Requirement: CA7 · Números de código; a Sênior confere; a IA só explica
Os indicadores de ganho e perda MUST ser calculados por código a partir dos desfechos gravados; a Sênior SHALL conferir a classificação (o resultado e a tese), e só o conferido entra nas contas. A IA só escreve a ficha.

#### Scenario: CA7 · Indicadores
- **Dado** os indicadores de ganho e perda
- **Quando** aparecem
- **Então** são calculados por código a partir dos desfechos gravados, automaticamente, e a Sênior confere a classificação; a IA só explica

### Requirement: CA8 · O tamanho da amostra ao lado
Cada indicador MUST mostrar o tamanho da amostra; não há amostra mínima (G22). **Coberto pelo painel (GGVP-75)**, também no recorte por tese.

#### Scenario: CA8 · Indicador
- **Dado** um indicador
- **Quando** aparece
- **Então** mostra o tamanho da amostra; não há amostra mínima, toda amostra soma

### Requirement: CA9 · O mesmo desfecho não duplica
O mesmo desfecho gravado de novo MUST NOT criar duplicata: um registro por caso, e a ficha pronta não é refeita.

#### Scenario: CA9 · Gravado de novo
- **Dado** o mesmo desfecho gravado de novo
- **Quando** o sistema grava
- **Então** não cria duplicata

### Requirement: CA10 · O texto do acervo sem dado pessoal
O texto que vai para o acervo MUST NOT levar CPF, endereço nem telefone; dado de saúde só entra quando necessário e com acesso do Jurídico.
- A ficha passa pela anonimização do acervo e não leva CID.

#### Scenario: CA10 · Texto gravado
- **Dado** o texto que vai para o acervo
- **Quando** é gravado
- **Então** não leva CPF, endereço nem telefone; dado de saúde só entra quando necessário e com acesso do Jurídico

### Requirement: CA11 · A falha ao gravar fica visível e é reprocessada
A falha ao gravar a ficha SHALL ficar visível na conferência ("a IA ainda não leu este desfecho") e SHALL ser tentada de novo na rodada seguinte, sem pessoa.

#### Scenario: CA11 · Falha
- **Dado** uma falha ao gravar no acervo
- **Quando** acontece
- **Então** fica visível e é reprocessada
