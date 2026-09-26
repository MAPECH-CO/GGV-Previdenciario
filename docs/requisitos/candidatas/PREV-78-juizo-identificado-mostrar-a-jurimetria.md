# PREV-78 · Juízo identificado: mostrar a jurimetria

> Candidata a história, diagrama **Jurimetria de perito e de juiz**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que, na distribuição, o sistema identifique a vara e o juiz e mostre a taxa de procedência por benefício, o tempo médio até a sentença e os entendimentos recorrentes\
**para** ajustar a petição e decidir sobre recurso com base no histórico de quem julga.

**Passo BPMN:** `D4.02N` (novo), `D3.05`, `D3b.04` · **Prioridade:** 2 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G22

## Critérios de aceite
1. **Dado** o processo distribuído, **quando** a publicação chega, **então** o card mostra vara e juiz e o link para o painel.
2. **Dado** o painel do juízo, **quando** abro, **então** vejo procedência por benefício, tempo médio e os entendimentos recorrentes com os processos de exemplo.
3. **Dado** o pedido da petição (PREV-35) ou a decisão de recorrer (PREV-45), **quando** a IA gera a minuta ou a recomendação, **então** cita o que usou da jurimetria do juízo.
4. **Dado** amostra abaixo do mínimo, **quando** abro, **então** vejo "amostra insuficiente" (G22).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G22**: Jurimetria com amostra abaixo do mínimo aparece como "amostra insuficiente" e nunca chega ao cliente

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q13: Onde está o estudo prévio de peritos e juízes (banco, formato, campos), quem o atualiza e qual a data de corte?
- Q16: Qual o tamanho mínimo de amostra para mostrar a jurimetria de um perito ou juiz?

## Dúvidas respondidas pelo PO
- (vazio)
