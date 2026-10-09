# Spec Delta · ggvp-102 · Mensagens ao cliente com modelo e registro

## Purpose

O Atendimento manda ao cliente mensagens padrão (boas-vindas, cobrança, aviso de resultado, convite) já preenchidas, para
falar de forma simples e deixar cada contato registrado; o Jurídico administrativo usa os mesmos modelos na perícia.
Transversal no BPMN. Respostas de 06 e 07/10: o canal é a central do Chatwoot, e o envio tem de estar ligado a ele (Lucas);
o portal acha o contato e a conversa, copia a mensagem e oferece "Abrir a conversa", com a de mais mensagens primeiro; a
falha aparece na tela em que a pessoa está e fica no histórico (Pedro). Figma: Marcar reunião `73:459`, Novo cliente
`73:371`, Prestação de contas `1578:316`, step_D3b.03 `10:320`, step_D3b.06 `1818:206`, step_DP.06 `10:405`; onde as
telas dizem WhatsApp, vale o Chatwoot. Contrato na `design.md`, seção GGVP-102.

## ADDED Requirements

### Requirement: CA1 · O modelo vem preenchido e a pessoa revisa
Ao enviar um modelo de mensagem, os dados do cliente e do caso SHALL vir preenchidos, e a pessoa SHALL poder revisar antes.

#### Scenario: CA1 · Enviar um modelo
- **Dado** um modelo de mensagem
- **Quando** envio
- **Então** os dados do cliente e do caso vêm preenchidos e eu posso revisar antes

### Requirement: CA2 · No card, a data, o canal e o texto
A mensagem enviada SHALL aparecer no card do cliente com data, canal e texto.

#### Scenario: CA2 · Abrir o card
- **Dado** uma mensagem enviada
- **Quando** abro o card
- **Então** vejo data, canal e texto

### Requirement: CA3 · Frases curtas, sem termos jurídicos
O texto sugerido pela IA SHALL usar frases curtas e sem termos jurídicos; o termo jurídico que a pessoa escrever SHALL ser apontado, com a palavra simples.

#### Scenario: CA3 · A IA sugere o texto
- **Dado** uma mensagem com linguagem técnica
- **Quando** a IA sugere o texto
- **Então** ela usa frases curtas e sem termos jurídicos

### Requirement: CA4 · O registro do envio
Terminado o envio, SHALL ficar o texto final, o canal, a data, a hora e o status de entrega, quando o canal informar.

#### Scenario: CA4 · O envio termina
- **Dado** uma mensagem enviada
- **Quando** o envio termina
- **Então** ficam o texto final, o canal, a data, a hora e o status de entrega, quando o canal informar

### Requirement: CA5 · A falha na tela e no histórico, sem reenvio duplicado
Quando o canal devolver erro, o erro SHALL aparecer na tela em que a pessoa está e SHALL ficar no histórico; o sistema MUST NOT reenviar sozinho.

#### Scenario: CA5 · O canal devolve erro
- **Dado** uma falha no envio
- **Quando** o canal devolve erro
- **Então** o erro aparece na tela em que a pessoa está e fica registrado no histórico, sem reenvio automático duplicado

### Requirement: CA6 · Pela central do Chatwoot, com "Abrir a conversa"
O envio SHALL sair pela central do Chatwoot, na conversa do cliente: o portal SHALL achar o contato e a conversa, copiar a mensagem e oferecer "Abrir a conversa"; com mais de uma conversa, SHALL mostrar a lista com a de mais mensagens primeiro.

#### Scenario: CA6 · Vou enviar
- **Dado** uma mensagem pronta
- **Quando** vou enviar
- **Então** o envio sai pela central do Chatwoot, na conversa do cliente; o portal acha o contato e a conversa, copia a mensagem e oferece "Abrir a conversa"; com mais de uma conversa, mostra a lista com a de mais mensagens primeiro

### Requirement: CA7 · Resultado favorável só depois do OK da advogada
O aviso de resultado favorável SHALL sair só depois do OK da advogada na prestação de contas, com o texto que ela revisou (G8).

#### Scenario: CA7 · O Atendimento vai enviar o aviso favorável
- **Dado** o aviso de resultado favorável
- **Quando** o Atendimento vai enviar
- **Então** ele só sai depois do OK da advogada na prestação de contas, com o texto que ela revisou (G8)

### Requirement: CA8 · Resultado desfavorável com o texto aprovado
O aviso de resultado desfavorável SHALL usar o texto aprovado pelo Jurídico, sem estratégia interna.

#### Scenario: CA8 · O Atendimento vai explicar
- **Dado** o aviso de resultado desfavorável
- **Quando** o Atendimento vai explicar
- **Então** usa o texto aprovado pelo Jurídico, sem estratégia interna

### Requirement: CA9 · As mensagens da perícia, sem esconder nem diagnóstico
As mensagens da perícia (data, o que levar, orientação, confirmação de presença) SHALL usar os mesmos modelos e MUST NOT orientar a esconder ou mudar a situação real (G11) nem sugerir diagnóstico, CID ou frase pronta (G20).

#### Scenario: CA9 · O Jurídico administrativo envia
- **Dado** as mensagens da perícia
- **Quando** o Jurídico administrativo as envia
- **Então** usa os mesmos modelos, sem orientar a esconder ou mudar a situação real (G11) e sem sugerir diagnóstico, CID ou frase pronta (G20)

### Requirement: CA10 · Convite e lembrete pelo Chatwoot com o modelo
O convite e o lembrete da entrevista marcada SHALL sair pelo Chatwoot com o modelo desta história.

#### Scenario: CA10 · O Atendimento envia o convite
- **Dado** a entrevista marcada
- **Quando** o Atendimento envia o convite
- **Então** o convite e o lembrete saem pelo Chatwoot com o modelo desta história
