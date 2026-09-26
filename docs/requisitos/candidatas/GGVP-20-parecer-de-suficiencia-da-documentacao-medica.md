# GGVP-20 · Parecer de suficiência da documentação médica

> Candidata a história, diagrama **Governança da documentação médica por benefício**. Cartão no Jira: [GGVP-20](https://mapech.atlassian.net/browse/GGVP-20), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-20. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** receber da IA uma matriz que cruza cada item obrigatório do benefício com os documentos do cliente, dizendo se está presente, ausente ou contraditório, com o trecho de onde tirou\
**para** saber antes do INSS ou do juiz se a prova médica sustenta o pedido.

**Passo BPMN:** `D1.21M` · **Épico:** Governança documental · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G18

## Critérios de aceite
1. **Dado** um caso de benefício da matriz de `docs/requisitos/roteiro-laudos.md` com documentos médicos classificados, **quando** a análise roda, **então** vejo cada item obrigatório com o status presente, ausente ou contraditório e, quando presente, o documento, a página e o trecho.
2. **Dado** um item contraditório (por exemplo, "incapacidade total" num pedido de Aposentadoria PCD), **quando** a análise termina, **então** o parecer fica "Contraditório" e o caso não avança (G18).
3. **Dado** o parecer, **quando** eu confirmo ou corrijo item a item, **então** o parecer passa a "Suficiente" ou "Insuficiente" com o meu nome e a data; a IA sozinha nunca aprova.
4. **Dado** um documento novo que chega depois do parecer, **quando** é classificado, **então** a análise roda de novo e mostra o que mudou.
5. **Dado** "Insuficiente", **quando** confirmo, **então** nasce a pendência para pedir o complemento (GGVP-29).

## Fora do escopo desta história
- Avaliar o mérito médico do diagnóstico. O parecer confere se o documento aborda o que o benefício exige; não se o diagnóstico está certo.

## Dados e permissões
- Dado de saúde (sensível). Parecer visível só ao Jurídico; Atendimento vê apenas "falta relatório com X".

## Portões de governança
- **G18**: Documento que contradiz o requisito do benefício bloqueia o caso (por exemplo, "incapacidade total" na Aposentadoria PCD; lesão não consolidada no Auxílio-Acidente)

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q15: O roteiro vale igual para a via administrativa (INSS) e para a judicial, ou a exigência muda?
- Q17: Dado de saúde é dado pessoal sensível: base legal, quem acessa e por quanto tempo se guarda (equivalente ao ADR-008 do Trabalhista)

## Dúvidas respondidas pelo PO
- (vazio)
