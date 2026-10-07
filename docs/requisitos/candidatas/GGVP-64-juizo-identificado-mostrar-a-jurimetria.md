# GGVP-64 · Juízo identificado: mostrar a jurimetria

> Candidata a história, diagrama **Jurimetria de perito e de juiz**. Cartão no Jira: [GGVP-64](https://mapech.atlassian.net/browse/GGVP-64), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-64. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que, na distribuição, o sistema identifique a vara e o juiz e mostre a taxa de procedência por benefício, o tempo médio até a sentença e os entendimentos recorrentes\
**para** ajustar a petição e decidir sobre recurso com base no histórico de quem julga.

**Passo BPMN:** `D4.02N` (novo), `D3.05`, `D3b.04` · **Prioridade:** 2 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G22

## Critérios de aceite
1. **Dado** o processo distribuído, **quando** a publicação chega, **então** o card mostra vara e juiz e o link para o painel.
2. **Dado** o painel do juízo, **quando** abro, **então** vejo procedência por benefício, tempo médio e os entendimentos recorrentes com os processos de exemplo.
3. **Dado** o pedido da petição (GGVP-63) ou a decisão de recorrer (GGVP-100), **quando** a IA gera a minuta ou a recomendação, **então** cita o que usou da jurimetria do juízo.
4. **Dado** um juízo com poucos processos na base, **quando** abro, **então** vejo cada porcentagem com o número de processos ao lado e a data da base; não há amostra mínima (G22).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G22**: Toda porcentagem de jurimetria aparece com o número de casos e a data da base; não há amostra mínima; o número fica fora do texto da peça que vai ao juiz

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q13: Onde está o estudo prévio de peritos e juízes (banco, formato, campos), quem o atualiza e qual a data de corte?
- Q16: Qual o tamanho mínimo de amostra para mostrar a jurimetria de um perito ou juiz?

## Dúvidas respondidas pelo PO
- (vazio)
