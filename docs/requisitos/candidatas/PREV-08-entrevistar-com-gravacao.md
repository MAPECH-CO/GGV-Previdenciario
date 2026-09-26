# PREV-08 · Entrevistar com gravação

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** gravar o áudio da entrevista no próprio portal\
**para** não depender de anotação e deixar a IA trabalhar sobre o que foi dito.

**Passo BPMN:** `D1.09` · **Épico:** Entrevista · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G9

## Critérios de aceite
1. **Dado** uma entrevista aberta, **quando** clico em Gravar, **então** o portal lembra de avisar o cliente que a conversa será gravada.
2. **Dado** a gravação encerrada, **quando** salvo, **então** o áudio fica no card do cliente.
3. **Dado** que a senha do gov.br foi dita, **quando** a transcrição é gerada, **então** a senha vai para o cofre e não fica no texto (G9).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G9**: A senha do gov.br vai para o cofre; nunca fica em texto transcrito nem em campo de texto

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q11: Retenção do áudio das entrevistas e conversas, e do perfil do perito (LGPD)

## Dúvidas respondidas pelo PO
- (vazio)
