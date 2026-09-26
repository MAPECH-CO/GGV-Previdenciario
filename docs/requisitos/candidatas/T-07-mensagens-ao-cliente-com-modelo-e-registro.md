# T-07 · Mensagens ao cliente com modelo e registro

> Candidata a história, diagrama **Histórias transversais**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** enviar ao cliente mensagens padrão (boas-vindas, cobrança, confirmação de perícia, aviso de resultado) já preenchidas\
**para** falar com o cliente de forma simples e deixar cada contato registrado.\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** um modelo de mensagem, **quando** envio, **então** os dados do cliente e do caso vêm preenchidos e eu posso revisar antes.
2. **Dado** uma mensagem enviada, **quando** abro o card, **então** vejo data, canal e texto.
3. **Dado** uma mensagem com linguagem técnica, **quando** a IA sugere o texto, **então** ela usa frases curtas e sem termos jurídicos, porque a operação relatou dificuldade dos clientes com leitura e tecnologia.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Qual o canal oficial (WhatsApp, SMS, ligação) e se o envio é automático ou sempre revisado.
- Q5: Qual o canal oficial das mensagens ao cliente, e o envio é automático ou sempre revisado?

## Dúvidas respondidas pelo PO
- (vazio)
