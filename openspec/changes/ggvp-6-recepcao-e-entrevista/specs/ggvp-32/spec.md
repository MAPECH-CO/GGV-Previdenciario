# Spec Delta · ggvp-32 · Preparar a conversa lendo a ficha

## Purpose

Antes de o cliente entrar, a advogada responsável vê um resumo da ficha com os pontos de atenção (acidentário, senha do gov.br, benefício citado) para entrevistar com foco. Telas do Figma: step_D1.06 `14:2`, step_D1.07 `14:36` e Central de trabalho · Advogada `59:449`. Passos D1.06 e D1.07 do Miro.

## ADDED Requirements

### Requirement: CA1 · A fila mostra o resumo com os pontos de atenção
Com uma entrevista marcada para hoje, a fila da advogada SHALL mostrar o resumo da ficha com os pontos de atenção.

#### Scenario: CA1 · Abrir a fila
- **Dado** uma entrevista marcada para hoje
- **Quando** abro minha fila
- **Então** vejo a tarefa "Preparar entrevista" com o resumo da ficha e os pontos de atenção

### Requirement: CA2 · Sem senha, o alerta e a renovação
Com a ficha sem senha do gov.br, o resumo SHALL mostrar o alerta e se o Atendimento já tentou renovar.

#### Scenario: CA2 · Ficha sem senha
- **Dado** que a ficha não tem senha do gov.br
- **Quando** abro o resumo
- **Então** vejo o alerta e se o Atendimento já tentou renovar

### Requirement: CA3 · Leitura da IA para conferir
O resumo feito pela IA SHALL aparecer como leitura para conferir ("A IA sugere · você confere") e MUST dar acesso à ficha completa e à segunda ficha, quando houver; o resumo não substitui a leitura.

#### Scenario: CA3 · Abrir o resumo
- **Dado** o resumo da ficha feito pela IA
- **Quando** a advogada o abre
- **Então** a tela mostra "A IA sugere · você confere" e os links para a ficha completa e para a segunda ficha, quando houver

### Requirement: CA4 · Situação da senha, sem a senha
A advogada SHALL ver a situação da senha do gov.br sem ver a senha: "sem senha", "o escritório tem, mas ainda não está no cofre" ou "no cofre"; no cofre, MUST ver também a última vez em que a senha funcionou (G9).

#### Scenario: CA4 · Senha no cofre
- **Dado** a senha no cofre
- **Quando** a advogada abre o resumo
- **Então** vê "no cofre" e a última vez em que a senha funcionou, nunca a senha

### Requirement: CA5 · A anotação do primeiro contato
A preparação, aberta pela tarefa ou pelo compromisso da agenda, SHALL mostrar a anotação que o Atendimento fez no primeiro contato junto com o resumo.

#### Scenario: CA5 · Abrir pela agenda
- **Dado** a anotação do primeiro contato
- **Quando** a advogada abre a preparação pela tarefa ou pelo compromisso da agenda
- **Então** vê a anotação junto com o resumo da ficha
