# GGVP-59 · Perito nomeado: identificar e mostrar a jurimetria

> Candidata a história, diagrama **Jurimetria de perito e de juiz**. Cartão no Jira: [GGVP-59](https://mapech.atlassian.net/browse/GGVP-59), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-59. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que, quando a publicação nomear o perito, o sistema identifique quem é e me mostre o histórico dele: laudos analisados, taxa de laudos favoráveis por benefício, CID e especialidade, e padrões recorrentes nos laudos\
**para** preparar o cliente e os quesitos sabendo como aquele perito costuma avaliar.

**Passo BPMN:** `D4.02N` (novo), `DP.05` · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G22

## Critérios de aceite
1. **Dado** uma publicação de nomeação de perito, **quando** a IA classifica, **então** o perito fica ligado ao processo e a advogada recebe o aviso "perito nomeado".
2. **Dado** um perito na base, **quando** abro o painel dele, **então** vejo o número de laudos, a taxa de favoráveis por benefício e por CID, e a data da base.
3. **Dado** um perito com amostra abaixo do mínimo, **quando** abro o painel, **então** vejo "amostra insuficiente" no lugar das taxas (G22).
4. **Dado** o laudo que o perito entregar neste caso, **quando** a advogada confere o resultado (DP.08), **então** o caso entra na base do perito (GGVP-73).

## Fora do escopo desta história
- Tirar o perito do comprovante do INSS (PDF): o PDF traz data, hora, local e tipo da perícia, mas não o perito. O perito vem do processo ou do acervo.
- A definir no refinamento.

## Dados e permissões
- Só o Jurídico vê. Nunca aparece em mensagem ao cliente nem no chat do Atendimento.

## Portões de governança
- **G22**: Jurimetria com amostra abaixo do mínimo aparece como "amostra insuficiente" e nunca chega ao cliente

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q13: Onde está o estudo prévio de peritos e juízes (banco, formato, campos), quem o atualiza e qual a data de corte?
- Q16: Qual o tamanho mínimo de amostra para mostrar a jurimetria de um perito ou juiz?

## Dúvidas respondidas pelo PO
- Ajuste de 29/09/2026 (Lucas): o comprovante do INSS (PDF) traz data, hora, local e tipo da perícia, mas não o perito. O perito vem do processo ou do acervo, nunca do PDF.
