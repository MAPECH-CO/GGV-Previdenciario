# PREV-21 · Checklist de documentos obrigatórios do benefício

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Documentação\
**quero** ver o checklist do benefício com o que chegou, o que falta e se todas as assinaturas e datas estão preenchidas\
**para** que nada vá para o INSS incompleto.

**Passo BPMN:** `D1.21` · **Épico:** Documentos · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Documentação\
**Portões:** G1

## Critérios de aceite
1. **Dado** um caso com benefício definido, **quando** abro o checklist, **então** vejo cada documento obrigatório com o status recebido, pendente ou com problema.
2. **Dado** um documento sem assinatura ou com data em branco, **quando** o checklist é conferido, **então** o item fica pendente (G1).
3. **Dado** o checklist incompleto, **quando** alguém tenta liberar ao Jurídico, **então** a ação fica bloqueada com a lista do que falta.
4. **[v2]** **Dado** um benefício da matriz de `docs/requisitos/roteiro-laudos.md`, **quando** abro o checklist, **então** ele inclui o item "Parecer médico" com o status do PREV-68 e os documentos complementares do benefício.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Documentação. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G1**: Nada vai para o INSS sem o checklist completo: documentos do benefício, todas as assinaturas e as datas preenchidas

## Dependências e referências
- Nenhum modelo traz ficha de grupo familiar nem declarações de moradia, união estável ou separação de fato (`docs/requisitos/duvidas-abertas.md`).

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Documentação".

## Dúvidas abertas (bloqueiam a DoR)
- Q3: Nenhum modelo traz ficha de grupo familiar nem declarações de moradia, união estável ou separação de fato. Entram no kit?

## Dúvidas respondidas pelo PO
- (vazio)
