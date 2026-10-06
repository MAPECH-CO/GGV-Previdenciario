# Spec Delta · ggvp-46 · Transcrever a entrevista

## Purpose

O áudio vira texto no histórico do caso, para a advogada consultar o que o cliente disse sem ouvir tudo de novo. Telas do Figma: Overlay · Transcrições do processo `1626:2`, com a Reunião com transcrição `73:560` e as fichas do cliente `73:199` e `73:2`. Passo D1.11 do Miro (sem tela própria). Portão G9.

## ADDED Requirements

### Requirement: CA1 · O texto no card com a data
Terminada a transcrição, o texto SHALL aparecer no card com a data da entrevista.

#### Scenario: CA1 · Transcrição pronta
- **Dado** um áudio salvo
- **Quando** a transcrição termina
- **Então** o texto aparece no card com a data da entrevista

### Requirement: CA2 · Buscar uma palavra
A busca de uma palavra SHALL mostrar o trecho.

#### Scenario: CA2 · Buscar
- **Dado** uma transcrição
- **Quando** busco uma palavra
- **Então** o portal mostra o trecho

### Requirement: CA3 · Falha e tentar de novo
Com a transcrição falhada, o card SHALL mostrar o aviso de falha e o botão para tentar de novo.

#### Scenario: CA3 · A transcrição falhou
- **Dado** que a transcrição falhou
- **Quando** abro o card
- **Então** vejo o aviso de falha e o botão para tentar de novo

### Requirement: CA4 · Lista com data, participantes e duração
A lista de transcrições do caso SHALL mostrar a data, os participantes e a duração de cada uma.

#### Scenario: CA4 · Abrir a lista
- **Dado** uma transcrição pronta
- **Quando** abro a lista de transcrições do caso
- **Então** cada uma mostra a data, os participantes e a duração

### Requirement: CA5 · Nada é apagado
Áudio e transcrição SHALL ficar guardados para sempre no portal.

#### Scenario: CA5 · O tempo passa
- **Dado** um áudio ou uma transcrição guardados
- **Quando** o tempo passa
- **Então** nada é apagado

### Requirement: CA6 · Resumo, informações com destino e conferência
A transcrição pronta SHALL mostrar o resumo da IA e as informações extraídas com o destino (ficha, pendência para a Documentação, cofre ou processo), que MUST ir para a ficha só depois de conferidas; também marcar trecho como prova, abrir o áudio, exportar em PDF e registrar conversa sem áudio.

#### Scenario: CA6 · Conferir e levar à ficha
- **Dado** uma transcrição pronta
- **Quando** abro
- **Então** vejo o resumo e as informações com o destino, que só vão para a ficha depois de conferidas

### Requirement: CA7 · Documentos para o checklist
A IA SHALL montar a lista de documentos que o cliente precisa trazer, que MUST ir para o checklist do benefício (GGVP-91) só depois de a advogada conferir.

#### Scenario: CA7 · A IA lista os documentos
- **Dado** a entrevista transcrita
- **Quando** a IA analisa
- **Então** monta a lista de documentos, que vai ao checklist depois de conferida

### Requirement: CA8 · Quem fala
A transcrição SHALL separar quem fala: advogada e cliente.

#### Scenario: CA8 · Gerar a transcrição
- **Dado** a transcrição
- **Quando** é gerada
- **Então** separa a advogada e o cliente
