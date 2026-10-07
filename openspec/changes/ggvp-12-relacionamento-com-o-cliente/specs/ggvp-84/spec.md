# Spec Delta · ggvp-84 · Atualizar ficha e processo com desfazer

## Purpose

Quem fez a conversa com o cliente (Atendimento ou advogada) confere na hora, antes de gravar, o que a IA preparou para a
ficha (contato, endereço, grupo familiar) e para os campos do processo (fatos novos, datas, documentos citados), para
manter o caso atualizado sem digitação e sem perder o valor antigo. Passos D5.03 e D5.04 do Miro. Respostas de 07/10: a IA
entrega o que atualizou para conferência (Lucas); quem confere é quem conversou, na hora, e a Sênior tem o histórico com
"Voltar para esta versão"; o Ctrl+Z vale em todo campo de escrita (Pedro). Figma: step_D5.04 `2282:2`, Transcrições
`1626:2`, Histórico do processo `59:11`. Contrato na `design.md`, seção GGVP-84.

## ADDED Requirements

### Requirement: CA1 · Só muda o que foi dito
A atualização preparada pela IA SHALL mudar só o que foi dito na conversa (G14).

#### Scenario: CA1 · A IA prepara a atualização
- **Dado** as mudanças identificadas
- **Quando** a IA prepara a atualização
- **Então** só muda o que foi dito na conversa (G14)

### Requirement: CA2 · A Sênior volta a versão
No histórico de um campo alterado, a Sênior SHALL ver cada versão com quem mudou e quando, e SHALL ter "Voltar para esta versão". Outro perfil MUST NOT voltar a versão.

#### Scenario: CA2 · A Sênior abre o histórico
- **Dado** um campo alterado
- **Quando** a Sênior abre o histórico
- **Então** vê cada versão com quem mudou e quando, e tem "Voltar para esta versão"

### Requirement: CA3 · O caso volta para onde estava
Ao confirmar ou corrigir, o caso SHALL voltar para onde estava: a etapa e a próxima ação do processo não mudam.

#### Scenario: CA3 · Confirmar ou corrigir
- **Dado** que confiro
- **Quando** confirmo ou corrijo
- **Então** o caso volta para onde estava

### Requirement: CA4 · Quem conversou vê antes de editar
Finalizada a conversa, a tela SHALL mostrar a quem fez a conversa o que vai ser editado na ficha do cliente, nos campos do processo ou nos dois, antes de editar. MUST NOT nascer tarefa para outra pessoa.

#### Scenario: CA4 · A conversa é finalizada
- **Dado** a lista do que mudou (GGVP-80)
- **Quando** a conversa é finalizada
- **Então** a tela mostra a quem fez a conversa o que vai ser editado na ficha, nos campos do processo ou nos dois, antes de editar; não nasce tarefa para outra pessoa

### Requirement: CA5 · Campo por campo, com Confirmar e Desfazer
Na conferência, a pessoa SHALL ver o que a IA quer mudar pela conversa de hoje, campo por campo, com "Confirmar" e "Desfazer".

#### Scenario: CA5 · Abrir a conferência
- **Dado** a conferência na hora
- **Quando** abro
- **Então** vejo o que a IA quer mudar pela conversa de hoje, campo por campo, e tenho "Confirmar" e "Desfazer"

### Requirement: CA6 · Antes de conferir, nada entra na ficha
As informações que a IA extraiu MUST NOT entrar na ficha antes de conferidas; SHALL entrar só depois (G14).

#### Scenario: CA6 · Ainda não conferi
- **Dado** as informações que a IA extraiu da conversa
- **Quando** ainda não conferi
- **Então** elas não entram na ficha; entram só depois de conferidas (G14)

### Requirement: CA7 · Depois de confirmar, "Surgiu pendência?"
Ao terminar a confirmação, o fluxo SHALL seguir para "Surgiu pendência?" (GGVP-88) e depois voltar ao D1, "o caso segue de onde parou".

#### Scenario: CA7 · Termino de confirmar
- **Dado** que confirmo
- **Quando** termino
- **Então** o fluxo segue para "Surgiu pendência?" e depois volta ao D1, "o caso segue de onde parou"

### Requirement: CA8 · O que o perfil não pode, sem Confirmar
A mudança num campo que o perfil não pode mudar SHALL aparecer sem o "Confirmar" e com quem pode fazer. O servidor MUST recusar a confirmação desse campo.

#### Scenario: CA8 · A IA propõe mudar um campo de outro perfil
- **Dado** um campo que o meu perfil não pode mudar
- **Quando** a IA propõe mudar
- **Então** a mudança aparece sem o "Confirmar" e com quem pode fazer

### Requirement: CA9 · Ctrl+Z em todo campo
Em qualquer campo de escrita do portal, Ctrl+Z SHALL voltar o texto digitado, também nos campos com máscara.

#### Scenario: CA9 · Digitar e apertar Ctrl+Z
- **Dado** qualquer campo de escrita do portal
- **Quando** a pessoa digita e aperta Ctrl+Z
- **Então** o texto volta, como em todo sistema
