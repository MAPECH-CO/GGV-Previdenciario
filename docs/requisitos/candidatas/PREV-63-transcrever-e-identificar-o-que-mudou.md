# PREV-63 · Transcrever e identificar o que mudou

> Candidata a história, diagrama **D5 · Conversa com lead ou cliente em análise**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que a IA transcreva a conversa e compare com a ficha e o processo\
**para** saber o que mudou sem ouvir tudo.

**Passo BPMN:** `D5.02` · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G9

## Critérios de aceite
1. **Dado** o áudio salvo, **quando** a transcrição termina, **então** o texto vai para o histórico do card.
2. **Dado** a transcrição, **quando** a IA compara, **então** mostra a lista do que mudou (ficha e processo).
3. **Dado** uma senha dita na conversa, **quando** a transcrição sai, **então** a senha vai para o cofre (G9).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G9**: A senha do gov.br vai para o cofre; nunca fica em texto transcrito nem em campo de texto

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
