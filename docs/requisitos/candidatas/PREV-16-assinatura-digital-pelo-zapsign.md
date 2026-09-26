# PREV-16 · Assinatura digital pelo ZapSign

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** gerar o documento no ZapSign e receber a tarefa com o link para acompanhar a assinatura\
**para** o cliente assinar pelo celular e o documento voltar sozinho para o card.

**Passo BPMN:** `D1.17` · **Épico:** Contratação · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** o documento conferido e "Digital" escolhido, **quando** envio, **então** o ZapSign monta o documento pelo modelo e eu recebo a tarefa com o link.
2. **Dado** o cliente sem assinar, **quando** o intervalo passa, **então** a tarefa me lembra de tentar contato de novo (T-04).
3. **Dado** o documento assinado, **quando** o ZapSign devolve, **então** ele é anexado no card e segue para a leitura (PREV-18).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
