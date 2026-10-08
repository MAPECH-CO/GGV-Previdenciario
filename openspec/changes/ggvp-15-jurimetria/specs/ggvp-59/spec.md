# Spec Delta · ggvp-59

## Purpose

Perito nomeado: quando a publicação nomeia o perito, o sistema identifica quem é, abre para a advogada a tarefa dos quesitos com o prazo contado e mostra a jurimetria do perito, com os números calculados em código e a regra do G22.
- **Parte 1 (08/10):**
  - a nomeação como classe da leitura da publicação;
  - a tarefa "Quesitos e assistente técnico", com o prazo;
  - o perito reconhecido no texto, ou a pergunta de um clique.
- **Já coberto pela Perícia no servidor (GGVP-61, GGVP-73 e GGVP-139, PR #8):**
  - o perfil por laudo, sem sobrescrever nem duplicar;
  - o comprovante do INSS sem o perito;
  - a pergunta de um clique;
  - a orientação pelo perfil;
  - os números do perito em código.
- **Parte 2:**
  - ligar o perito na perícia judicial a partir da publicação;
  - a sobreposição da página do caso lendo do servidor;
  - a taxa por benefício e por CID;
  - o chat.

Quem vê os números: só o Jurídico. A dica sem números pode ir ao cliente na ligação.

## ADDED Requirements

### Requirement: CA1 · A nomeação liga o perito e abre os quesitos com o prazo
Quando a publicação de nomeação de perito for classificada, o perito SHALL ficar ligado ao processo, a advogada SHALL receber o aviso de perito nomeado e SHALL nascer para ela a tarefa "Quesitos e assistente técnico".
- O prazo MUST ser o do despacho ou, sem ele, 15 dias (CPC, art. 465, §1º), contado em código; na dúvida, a data mais cedo (G12).
- **Parte 1:** a classe "Nomeação de perito"; a tarefa com o prazo; o perito reconhecido no texto vai ao histórico do caso, e o não reconhecido segue para a pergunta de um clique (CA6).
- **Parte 2:** ligar o perito direto na perícia judicial.

#### Scenario: CA1 · Nomeação de perito
- **Dado** uma publicação de nomeação de perito
- **Quando** a IA classifica
- **Então** o perito fica ligado ao processo, a advogada recebe o aviso "perito nomeado" e nasce para ela a tarefa "Quesitos e assistente técnico", com o prazo contado (GGVP-34): o do despacho ou, sem ele, o da lei (15 dias no CPC, art. 465, §1º, para quesitos, assistente técnico e impugnação do perito); na dúvida, a data mais cedo (G12)

### Requirement: CA2 · A sobreposição do perito com os laudos e as taxas
A sobreposição de jurimetria do perito SHALL mostrar o número de laudos, a taxa de favoráveis por benefício e por CID, e a data da base.
- **Coberto pela Perícia:** os números do perito em código, por assunto.
- **Parte 2:** a taxa por benefício e por CID, e a sobreposição da página do caso lendo do servidor.

#### Scenario: CA2 · Perito na base
- **Dado** um perito na base
- **Quando** clico no nome do perito na página do processo (ou na tarefa, ou pergunto no chat) e abre a sobreposição de jurimetria dele
- **Então** vejo o número de laudos, a taxa de favoráveis por benefício e por CID, e a data da base

### Requirement: CA3 · Toda taxa com o número de laudos e a data da base
Cada taxa do perito MUST aparecer com o número de laudos ao lado e a data da base, como "71% em 34 laudos · base de 07/10". Não há amostra mínima (G22). **Coberto pela Perícia.**

#### Scenario: CA3 · Poucos laudos
- **Dado** um perito com poucos laudos na base
- **Quando** abro a sobreposição
- **Então** vejo cada taxa com o número de laudos ao lado e a data da base, como "71% em 34 laudos · base de 07/10"; não há amostra mínima (G22)

### Requirement: CA4 · O laudo conferido entra na base do perito
Quando a advogada conferir o resultado da perícia (DP.08), o caso SHALL entrar na base do perito. **Coberto pela Perícia (GGVP-73).**

#### Scenario: CA4 · Resultado conferido
- **Dado** o laudo que o perito entregar neste caso
- **Quando** a advogada confere o resultado (DP.08)
- **Então** o caso entra na base do perito (GGVP-73)

### Requirement: CA5 · O comprovante do INSS não traz o perito
A leitura do comprovante do INSS MUST NOT tirar dele o perito. O perito vem do processo ou do acervo. **Coberto pela Perícia (GGVP-139).**

#### Scenario: CA5 · Comprovante lido
- **Dado** o comprovante do agendamento do INSS (PDF)
- **Quando** o sistema o lê
- **Então** não tira dele o perito: o PDF traz data, hora, local e tipo, sem o perito; o perito vem do processo ou do acervo

### Requirement: CA6 · Perito não reconhecido: a pergunta de um clique
Perito que o sistema não reconhece SHALL gerar a pergunta de um clique para identificá-lo. Até a resposta, os dados dele MUST ficar fora das contas, e nada trava. **Coberto pela Perícia (GGVP-61 CA6)**; na parte 1, a nomeação não reconhecida segue para essa pergunta.

#### Scenario: CA6 · Não reconhecido
- **Dado** um perito que o sistema não reconhece
- **Quando** a página do processo abre
- **Então** aparece uma pergunta de um clique para identificar o perito; até a resposta, os dados dele ficam fora das contas e nada trava

### Requirement: CA7 · Números de código; a IA só resume
Os números do perito MUST vir de código, a partir do acervo; a IA SHALL só resumir os laudos e citar as fontes. Toda porcentagem vem com o número de casos ao lado e a data da base (G22). **Coberto pela Perícia.**

#### Scenario: CA7 · Números do perito
- **Dado** os números do perito (na sobreposição, na tarefa ou no chat)
- **Quando** aparecem
- **Então** vêm de código a partir do acervo; a IA só resume os laudos e cita as fontes, e toda porcentagem vem com o número de casos ao lado e a data da base (G22)

### Requirement: CA8 · O perfil guarda o histórico por laudo
Quando um laudo novo entrar, o perfil do perito SHALL guardar o histórico por laudo, sem sobrescrever, e mostrar quantos laudos o formam. **Coberto pela Perícia (GGVP-73).**

#### Scenario: CA8 · Laudo novo
- **Dado** o perfil do perito
- **Quando** um laudo novo entra
- **Então** o perfil guarda o histórico por laudo, sem sobrescrever, e mostra quantos laudos o formam

### Requirement: CA9 · O mesmo laudo não duplica
O mesmo laudo processado de novo MUST NOT duplicar a informação na base do perito. **Coberto pela Perícia (GGVP-73).**

#### Scenario: CA9 · Processado de novo
- **Dado** o mesmo laudo processado de novo
- **Quando** entra na base do perito
- **Então** não duplica a informação

### Requirement: CA10 · A orientação usa o perfil do perito na Justiça
Na Justiça, com perito nomeado e com perfil na base, a orientação ao cliente (DP.05) SHALL usar o perfil do perito, na perícia médica e na social. No INSS, onde o perito não é informado, ou com perito sem perfil, SHALL usar a orientação padrão e registrar o motivo. **Coberto pela Perícia (GGVP-61, GGVP-139).**

#### Scenario: CA10 · Orientação
- **Dado** uma perícia
- **Quando** a orientação ao cliente é montada (DP.05)
- **Então** na Justiça, com perito nomeado e com perfil na base, ela usa o perfil do perito, na perícia médica e na social; no INSS, onde o perito não é informado (CA5), ou com perito sem perfil, usa a orientação padrão e registra o motivo
