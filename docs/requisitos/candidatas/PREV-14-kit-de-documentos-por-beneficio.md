# PREV-14 · Kit de documentos por benefício

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** que, ao fechar o contrato, o portal puxe o kit certo do benefício (contrato, procuração, hipossuficiência, residência, termo do INSS, Código Penal)\
**para** nunca mandar o cliente assinar o kit errado.

**Passo BPMN:** `D1.15` · **Épico:** Contratação · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** um benefício escolhido, **quando** o cliente fecha, **então** o portal mostra o kit daquele benefício, conforme a tabela abaixo.
2. **Dado** LOAS representado por genitor(a), **quando** o kit é montado, **então** leva os dados e a assinatura do representado e da genitora.
3. **Dado** Curatela, Isenção de IR, Empréstimo fraudulento ou Seguro de vida, **quando** o kit é montado, **então** as exceções da tabela são respeitadas (por exemplo, Curatela sem Termo INSS, Isenção de IR sem hipossuficiência).

## Kits por benefício (do board)
| Benefício | Kit | Modelo (pasta MODELOS ZAPSIGN · PREV) |
|---|---|---|
| Aposentadorias | Contrato · Procuração · Hipossuficiência · Residência · Termo INSS (aposentadorias, CTC, recursos) · Código Penal | Contrato Completo 2026 |
| Auxílio acidentário | Contrato · Procuração · Hipossuficiência · Residência · Termo INSS (auxílio-acidente, acréscimo de 25%) · Código Penal | Contrato Completo 2026 |
| Auxílio incapacidade | Contrato · Procuração · Hipossuficiência · Residência · Termo INSS (incapacidade temporária e permanente, 25%) · Código Penal | Contrato Completo 2026 |
| LOAS idoso ou deficiente | Contrato · Procuração · Hipossuficiência · Residência · Termo INSS (BPC idoso e PcD, recursos) · Código Penal | Contrato Completo 2026 |
| LOAS representado (genitor) | O mesmo kit do LOAS, com dados e assinatura do representado e da genitora | Contrato Completo 2026 |
| Curatela | Contrato · Procuração · Hipossuficiência · Residência (sem Termo INSS) | modelo 6 |
| Isenção de IR | Contrato · Procuração · Termo INSS (isenção de IR) · Código Penal · Residência (sem Hipossuficiência) | modelo 7 |
| Empréstimo fraudulento | Contrato · Procuração · Hipossuficiência (ação contra o banco) | modelo 8 |
| Seguro de vida | Contrato · Procuração · Hipossuficiência (ação contra a seguradora) | modelo 10 |

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Q3: Nenhum modelo traz ficha de grupo familiar nem declarações de moradia, união estável ou separação de fato. Entram no kit?

## Dúvidas respondidas pelo PO
- (vazio)
