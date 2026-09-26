# GGVP-61 · Orientação da perícia, padrão ou pelo perfil do perito

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-61](https://mapech.atlassian.net/browse/GGVP-61), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-61. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** receber um documento de orientação para o cliente, montado pela IA: padrão na perícia médica, e pelo perfil do perito nomeado na avaliação social\
**para** preparar o cliente sobre o que o perito costuma observar, perguntar e pedir.

**Passo BPMN:** `DP.05` · **Épico:** Perícia · **Prioridade:** 2 · **Estimativa:** G\
**Perfil:** Atendimento\
**Portões:** G11

## Critérios de aceite
1. **Dado** perícia médica, **quando** a data é registrada, **então** a IA monta a orientação padrão.
2. **Dado** avaliação social, **quando** a data é registrada, **então** o sistema identifica o perito nomeado no processo e, se ele tem perfil no acervo, a IA monta a orientação pelo perfil; se não tem, monta a padrão.
4. **[v2]** **Dado** um perito identificado, médico ou social, **quando** a orientação é montada, **então** usa também a jurimetria do perito (GGVP-59) e a recomendação do GGVP-38.
3. **Dado** qualquer orientação, **quando** é gerada, **então** não contém instrução para esconder ou mudar a situação real da casa, e uma revisão automática bloqueia texto assim (G11).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G11**: A orientação da perícia social nunca orienta a esconder ou mudar a situação real da casa

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
