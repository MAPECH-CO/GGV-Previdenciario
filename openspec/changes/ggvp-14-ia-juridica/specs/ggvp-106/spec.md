# Spec Delta · ggvp-106

## Purpose

A plataforma por onde passa toda chamada à IA: a OpenAI sugere e a Mistral lê documento; a IA só sugere, uma pessoa decide; toda chamada fica registrada para auditoria; sem chave, nada trava; dado de saúde só sai com autorização do escritório. Os critérios que são telas próprias (CA3, CA5, CA6, CA7) entram nas histórias dessas telas, e os cards do chat que executa (CA8, CA9, CA10, CA13) ficam fora até 09/10.

## ADDED Requirements

### Requirement: CA1 · A IA não passa portão
O módulo de IA MUST NOT gravar decisão, tarefa nem estado de caso. O portão só avança com a ação de uma pessoa com o perfil dele, verificada no servidor.

#### Scenario: CA1 · Sugestão não decide
- **Dado** uma sugestão da IA
- **Quando** ela é gerada
- **Então** nenhuma decisão, tarefa ou estado de caso muda

### Requirement: CA2 · Sugestão identificada, com fontes
Toda saída da IA SHALL chegar como sugestão (`sugestao: true`), com as fontes usadas, o modelo e o id da chamada.

#### Scenario: CA2 · Sugestão na tela
- **Dado** uma sugestão da IA
- **Quando** aparece
- **Então** vem marcada como sugestão, com as fontes

### Requirement: CA4 · Toda chamada registrada
Toda chamada à IA SHALL ficar registrada com a finalidade, o fornecedor, o modelo, a versão da instrução, o caso, quem pediu, a entrada resumida (tamanho e hash, nunca o conteúdo), as fontes, a saída e a situação. A auditoria do caso SHALL mostrar a saída só a quem vê dado de saúde, com o acesso registrado.

#### Scenario: CA4 · Auditar o caso
- **Dado** chamadas à IA num caso
- **Quando** alguém da gestão ou do Jurídico abre a auditoria
- **Então** vê cada chamada; a saída só aparece para o Jurídico, e a leitura fica registrada

### Requirement: Sem chave, a IA desliga e nada trava
Sem a chave do fornecedor, ou com o serviço fora do ar, a função SHALL devolver "sem sugestão", registrar a tentativa e deixar a pessoa seguir sem a IA.

#### Scenario: Sem chave
- **Dado** o ambiente sem a chave da OpenAI
- **Quando** uma função pede sugestão
- **Então** recebe "sem sugestão", a chamada fica como "desligada" e nenhum serviço de fora é chamado

### Requirement: Dado de saúde só com autorização
Finalidade que leva dado de saúde, ou documento marcado como sensível, MUST NOT ir à IA enquanto o escritório não autorizar (`IA_PERMITE_DADO_DE_SAUDE=sim`); a chamada fica como "recusada".

#### Scenario: Laudo sem autorização
- **Dado** um laudo marcado como sensível e o ambiente sem a autorização
- **Quando** alguém pede a leitura pela Mistral
- **Então** o serviço não é chamado e a chamada fica como "recusada"

### Requirement: CA11 · Números vêm de código
A instrução de sistema de toda finalidade SHALL mandar a IA não calcular e usar só os números que o sistema passa, com o número de casos ao lado (G22).

#### Scenario: CA11 · Instrução
- **Dado** qualquer finalidade
- **Quando** a chamada é montada
- **Então** a instrução de sistema traz a regra dos números
