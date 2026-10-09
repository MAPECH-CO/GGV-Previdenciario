# Spec Delta · ggvp-140

## Purpose

IA de verdade no Relacionamento: depois da transcrição de verdade da conversa (GGVP-133), o motor de IA do portal sugere o resumo e o que foi dito; a comparação com a ficha e com os campos do processo continua sendo código, e nada vai para a ficha sem quem conversou conferir, item por item (G14). Regra de dados de 08/10 (Pedro): quem fez a conversa vê a transcrição e o resumo; só o conteúdo médico fica com o Jurídico, sem filtro por palavra; a conversa da advogada continua só para o Jurídico. Passo D5.02.

## ADDED Requirements

### Requirement: CA1 · O resumo e a lista do que mudou vêm da IA
Com a conversa transcrita, o motor de IA SHALL sugerir o resumo e o que foi dito; cada item da lista do que mudou SHALL vir marcado como "ficha do cliente" ou "campos do processo", com o trecho da conversa de onde saiu.

#### Scenario: CA1 · A IA analisa
- **Dado** uma conversa transcrita
- **Quando** a IA analisa
- **Então** sugere o resumo e a lista do que mudou, cada item marcado como "ficha do cliente" ou "campos do processo", com o trecho da conversa de onde saiu

### Requirement: CA2 · Nada vai para a ficha sem conferir
A comparação com a ficha MUST ser código; nada SHALL ir para a ficha antes de quem conversou conferir, item por item (G14).

#### Scenario: CA2 · A lista aparece
- **Dado** a lista
- **Quando** aparece
- **Então** nada vai para a ficha antes de quem conversou conferir, item por item; a comparação com a ficha continua sendo código

### Requirement: CA3 · Senha não aparece (G9)
A senha dita MUST NOT aparecer em nenhum texto da análise; ela vai para o cofre.

#### Scenario: CA3 · Senha dita
- **Dado** uma senha dita
- **Quando** a análise sai
- **Então** ela não aparece em nenhum texto e vai para o cofre (G9)

### Requirement: CA4 · Fala com instrução para a IA
A fala com instrução para a IA SHALL vir com o alerta do motor; nada MUST mudar sozinho (GGVP-110 CA9).

#### Scenario: CA4 · Instrução na fala
- **Dado** uma fala com instrução para a IA
- **Quando** é analisada
- **Então** vem com o alerta do motor e nada muda sozinho

### Requirement: CA5 · IA desligada ou fora do formato
Com a IA desligada, recusada ou com a saída fora do formato, a tela SHALL mostrar o motivo e seguir manual.

#### Scenario: CA5 · Sem a leitura da IA
- **Dado** a IA desligada ou uma saída fora do formato
- **Quando** a tela abre
- **Então** mostra o motivo e segue manual

### Requirement: CA6 · Testes com fetch falso
Os testes SHALL usar `fetch` falso e cobrir o roteiro mínimo do guia do motor.

#### Scenario: CA6 · Testes
- **Dado** os testes
- **Quando** rodam
- **Então** usam `fetch` falso e cobrem o roteiro mínimo do guia
