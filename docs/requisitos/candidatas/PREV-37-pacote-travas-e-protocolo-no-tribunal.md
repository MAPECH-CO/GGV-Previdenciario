# PREV-37 · Pacote, travas e protocolo no tribunal

> Candidata a história, diagrama **D3 · Judicialização**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que o sistema salve a petição, monte o pacote e só libere o botão de protocolo quando as três travas passarem\
**para** protocolar no tribunal sem erro de pacote ou de parte.

**Passo BPMN:** `D3.07` · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G7

## Critérios de aceite
1. **Dado** a petição aprovada, **quando** o sistema monta o pacote, **então** salva no Drive e prepara o protocolo.
2. **Dado** o pacote, **quando** abro, **então** vejo as três travas: Tema 350, pacote completo e CPF conferido, cada uma com status (G7).
3. **Dado** uma trava falhando, **quando** tento protocolar, **então** o botão fica bloqueado e diz qual trava falta.
4. **Dado** o protocolo feito, **quando** registro, **então** o caso passa para D3a com número do processo e data.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G7**: Três travas antes de protocolar na Justiça: Tema 350, pacote completo e CPF conferido

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- O que exatamente a trava "Tema 350" confere, e qual é o "botão do tribunal" (sistema de peticionamento de cada tribunal).
- Q8: O que a trava "Tema 350" confere exatamente, e qual sistema de peticionamento está por trás do "botão do tribunal"?
- Q10: Onde ficam os arquivos: Drive (como no board) ou armazenamento do próprio portal?

## Dúvidas respondidas pelo PO
- (vazio)
