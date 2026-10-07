# Spec Delta · ggvp-104

## Purpose

Configuração do escritório: a gestão (Sócio e Sênior) mantém numa tela só os limites dos laços, os kits de documentos de cada benefício (o checklist do G1) e as mensagens padrão, sem pedir mudança no código. Toda mudança fica no histórico com quem mudou, o antes e o depois. O kit tem versão: muda para os casos novos, e o caso aberto continua com o kit da época. Respostas do Lucas (02/10):
- Limites: cobrança de documento com 3 tentativas a cada 3 dias úteis, e passou disso sobe para a Sênior. Cliente sumido com 3 tentativas em 10 dias. Remarcação de perícia com 1 e sobe para a advogada responsável. Com prazo do juiz ou do INSS, o prazo manda.
- Contratos: os 7 Contratos Completos convertidos podem ser ativados com as regras do portal.
- Kit do LOAS: a ficha de grupo familiar é obrigatória em todo LOAS, e as três declarações são condicionais.

Os modelos de contrato (ativação, campos `{{...}}`, representante e versão no ZapSign) e a liberação ao Jurídico com checklist aprovado são do épico Abertura e documentação (Pedro) e do ZapSign real, que não entra até 09/10.

## ADDED Requirements

### Requirement: CA1 · Kit novo para os casos novos
Editar o kit de um benefício SHALL publicar uma versão nova, que vale para os casos novos; o caso já aberto MUST continuar com o kit da época (a versão vigente quando o caso foi aberto).

#### Scenario: CA1 · Editar o kit
- **Dado** um benefício
- **Quando** edito o kit
- **Então** a mudança vale para os casos novos e os casos já abertos continuam com o kit da época

### Requirement: CA2 · Modelo sem campos não ativa
O modelo de contrato sem campos `{{...}}` MUST NOT ser ativado. A ativação dos modelos de contrato é do épico Abertura e documentação, com a geração do contrato e o ZapSign.

#### Scenario: CA2 · Ativar o modelo
- **Dado** um modelo de contrato sem campos `{{...}}`
- **Quando** tento ativar
- **Então** o portal recusa e mostra que o modelo ainda traz dados de um cliente de exemplo (alerta do D1)

### Requirement: CA3 · Toda mudança no histórico
Qualquer mudança de configuração SHALL ficar no histórico com quem mudou, o valor anterior e o novo.

#### Scenario: CA3 · Salvar
- **Dado** qualquer mudança de configuração
- **Quando** salvo
- **Então** fica no histórico com quem mudou

### Requirement: CA4 · Cada laço com o seu limite
A gestão SHALL definir os limites de cada laço, e cada laço MUST usar o seu: a cobrança de documento (3 tentativas, a cada 3 dias úteis) sobe para a Sênior; o contato com o cliente sumido (3 tentativas em 10 dias); a remarcação de perícia (1) sobe para a advogada responsável. Os limites do alerta do cofre (GGVP-103) ficam na mesma tela. Valores do Lucas (02/10), editáveis.

#### Scenario: CA4 · Definir os limites
- **Dado** os limites de cobrança e de remarcação
- **Quando** a gestão os define
- **Então** cada laço usa o seu: cobrança que passa do limite sobe para a sênior; remarcação de perícia que passa do limite sobe para a advogada responsável. Os valores seguem "a definir" (Q1).

### Requirement: CA5 · Um catálogo de benefícios
O catálogo de benefícios SHALL ser um só, nos contratos, e servir ao banco, à configuração e às telas.

#### Scenario: CA5 · Usar o catálogo
- **Dado** o catálogo de benefícios (kit, modelo de contrato e checklist de cada um)
- **Quando** é usado
- **Então** é o mesmo em novo cliente, ficha, definição do benefício, kit, checklist e Centrais

### Requirement: CA6 · O caso mantém a versão aplicada
Publicada uma versão nova do kit, o caso em andamento SHALL manter a versão aplicada. A atualização do caso por decisão de alguém dele é proposta e não entra nesta entrega.

#### Scenario: CA6 · Versão nova
- **Dado** um caso em andamento com a versão antiga do kit ou do checklist
- **Quando** a gestão publica uma versão nova
- **Então** o caso mantém a versão aplicada e pode ser atualizado por decisão de alguém do caso (proposta)

### Requirement: CA7 · Sem checklist aprovado, não libera
O caso de benefício sem checklist aprovado MUST NOT ser liberado. A liberação ao Jurídico (D1.24) é do épico Abertura e documentação; a conferência da Sênior já recusa o checklist incompleto (G1).

#### Scenario: CA7 · Liberar sem checklist
- **Dado** um benefício sem checklist aprovado
- **Quando** alguém tenta liberar o caso
- **Então** o portal não deixa e a tela explica o bloqueio

### Requirement: CA8 · Sem sobra do cliente de exemplo
O kit gerado com um cliente de teste a partir do Contrato Completo convertido MUST NOT ter dado do cliente de exemplo. Entra com a geração do contrato (épico Abertura e documentação).

#### Scenario: CA8 · Gerar com cliente de teste
- **Dado** um Contrato Completo convertido em modelo
- **Quando** o kit é gerado com um cliente de teste
- **Então** não sobra nenhum dado do cliente de exemplo (verificação automática pelo texto do exemplo)

### Requirement: CA9 · Campos de representante
Sem representante no caso, os campos de representante do modelo MUST NOT aparecer. Entra com a geração do contrato (épico Abertura e documentação).

#### Scenario: CA9 · Sem representante
- **Dado** um modelo com campos de representante
- **Quando** o caso não tem representante
- **Então** esses campos não aparecem

### Requirement: CA10 · Modelos versionados com o ZapSign
Os modelos de contrato SHALL ficar versionados na pasta "MODELOS ZAPSIGN -- PREV" e no ZapSign com o mesmo identificador. Entra com o ZapSign real, que não entra até 09/10.

#### Scenario: CA10 · Mudar o modelo
- **Dado** os modelos de contrato
- **Quando** mudam
- **Então** ficam versionados na pasta "MODELOS ZAPSIGN -- PREV" e no ZapSign com o mesmo identificador
