# PREV-69 · Regras objetivas calculadas por código

> Candidata a história, diagrama **Governança da documentação médica por benefício**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que as regras numéricas do roteiro sejam calculadas pelo sistema, com teste, e não pela IA\
**para** confiar no resultado sem refazer a conta.

**Passo BPMN:** `D1.21M` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G19

## Critérios de aceite
1. **Dado** um caso de BPC/LOAS Deficiente com data de início do impedimento e prognóstico, **quando** o sistema calcula, **então** mostra a duração em meses e sinaliza se alcança 24 meses (por exemplo, início em 2024 e ainda presente; ou diagnóstico em 2026 com prognóstico até pelo menos 2028).
2. **Dado** um caso de Auxílio por Incapacidade Temporária, **quando** o sistema soma os afastamentos, **então** só soma atestados cujas doenças a advogada marcou como clinicamente correlacionadas e dentro de 60 dias, e sinaliza se passa de 15 dias.
3. **Dado** uma Aposentadoria PCD, **quando** o sistema cruza a data de início da deficiência com os vínculos do CNIS, **então** mostra quais períodos contam como tempo na condição de PCD (PREV-73).
4. **Dado** qualquer regra, **quando** um dado de entrada falta, **então** o resultado é "não calculável: falta X", nunca um palpite (G19).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G19**: Regras numéricas (24 meses no LOAS, mais de 15 dias e janela de 60 dias na incapacidade temporária, períodos PCD) são calculadas por código com teste, nunca pela IA

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
