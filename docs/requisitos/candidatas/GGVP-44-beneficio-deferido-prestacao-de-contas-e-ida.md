# GGVP-44 · Benefício deferido: prestação de contas e ida ao banco

> Candidata a história, diagrama **D2 · Via administrativa no INSS**. Cartão no Jira: [GGVP-44](https://mapech.atlassian.net/browse/GGVP-44), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-44. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que o deferimento abra ao mesmo tempo a prestação de contas para o Financeiro e o agendamento da ida ao banco com o cliente\
**para** fechar o caso administrativo sem esquecer nenhum dos dois.

**Passo BPMN:** `D2.06` · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G8

## Critérios de aceite
1. **Dado** "Deferido", **quando** registro a decisão, **então** nascem a tarefa "Prestação de contas" (Jurídico) e a tarefa "Agendar a ida ao banco" (Atendimento).
2. **Dado** a prestação de contas feita, **quando** envio, **então** o Financeiro recebe e só ele e o Jurídico veem os valores.
3. **Dado** a ida ao banco agendada, **quando** o Atendimento registra a data, **então** o cliente recebe a confirmação.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G8**: O aviso ao cliente só nasce depois do OK da advogada na prestação de contas

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- A prestação de contas do D2 também precisa do OK da advogada antes de avisar o cliente, como no D3b (G8)?
- Q7: A prestação de contas do D2 também exige o OK da advogada antes do aviso ao cliente?

## Dúvidas respondidas pelo PO
- (vazio)
