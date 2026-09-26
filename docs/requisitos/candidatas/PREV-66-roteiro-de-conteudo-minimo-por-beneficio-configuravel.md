# PREV-66 · Roteiro de conteúdo mínimo por benefício, configurável e versionado

> Candidata a história, diagrama **Governança da documentação médica por benefício**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** manter no portal, por benefício, o que precisa ser demonstrado, os itens obrigatórios, as contradições que bloqueiam e os documentos complementares\
**para** que a análise da IA e a conferência humana sigam a regra do escritório, e não a memória de cada um.

**Passo BPMN:** `D1.21M` · **Épico:** Governança documental · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** sênior

## Critérios de aceite
1. **Dado** um benefício da matriz de `docs/requisitos/roteiro-laudos.md`, **quando** abro o roteiro, **então** vejo cada item com o tipo (obrigatório, contradição que bloqueia, complementar) e o texto do escritório.
2. **Dado** que edito um item, **quando** salvo, **então** nasce uma nova versão com autor e data, e os casos já analisados continuam mostrando a versão usada na análise deles.
3. **Dado** um benefício sem roteiro cadastrado, **quando** um caso desse benefício chega à análise, **então** o portal avisa "benefício sem roteiro" e exige a conferência manual da advogada.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Editar: sênior. Ver: Jurídico. Atendimento e Documentação veem só a lista do que falta pedir ao cliente, em linguagem simples.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Q18: Faltam roteiros para aposentadorias comuns, LOAS idoso (parte socioeconômica), Curatela e Isenção de IR (que também depende de laudo). Existem?

## Dúvidas respondidas pelo PO
- (vazio)
