# GGVP-54 · A IA analisa o motivo e a sênior despacha

> Candidata a história, diagrama **D3 · Judicialização**. Cartão no Jira: [GGVP-54](https://mapech.atlassian.net/browse/GGVP-54), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-54. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** receber a análise da IA sobre o indeferimento com uma sugestão do que falta e, a partir dela, criar as tarefas de cada setor\
**para** despachar rápido sem deixar a IA decidir por mim.

**Passo BPMN:** `D3.02`, `D3.03` · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** sênior\
**Portões:** G4

## Critérios de aceite
1. **Dado** o motivo registrado, **quando** a IA termina a análise, **então** recebo a tarefa com o histórico do caso, a análise e os critérios sugeridos.
2. **Dado** a análise, **quando** marco o que falta (Atendimento, Documentação, perícia), **então** cada setor recebe a própria tarefa; posso marcar mais de um.
3. **Dado** "nada falta", **quando** confirmo, **então** o caso vai direto para "Pedir a petição".
4. **Dado** a sugestão da IA, **quando** despacho diferente, **então** o despacho vale e a sugestão fica no histórico (G4).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: sênior. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G4**: A IA analisa o indeferimento e sugere, mas quem despacha é a sênior

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
