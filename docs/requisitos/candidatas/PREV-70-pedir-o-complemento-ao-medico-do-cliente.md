# PREV-70 · Pedir o complemento ao médico do cliente

> Candidata a história, diagrama **Governança da documentação médica por benefício**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** gerar para o cliente uma orientação, para levar ao médico dele, com os pontos que o relatório precisa abordar para aquele benefício\
**para** que o cliente volte com o documento certo na primeira tentativa.

**Passo BPMN:** `D1.21M`, `D1.23` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento\
**Portões:** G20

## Critérios de aceite
1. **Dado** um parecer "Insuficiente", **quando** abro a pendência, **então** vejo a orientação com os itens ausentes, escritos como perguntas ao médico (por exemplo, "Desde quando o paciente apresenta o quadro?", "Qual a previsão de duração?").
2. **Dado** a orientação, **quando** é gerada, **então** não sugere diagnóstico, CID, grau nem conclusão, e não contém as frases-chave do roteiro como texto a copiar (G20).
3. **Dado** a pendência criada, **quando** o cliente não traz o documento, **então** ela segue o laço com lembretes e escalonamento (T-04).
4. **Dado** o documento novo, **quando** chega, **então** o parecer é refeito (PREV-68).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G20**: A orientação ao médico ou ao cliente lista o que o documento deve abordar, sem sugerir diagnóstico, CID, grau, conclusão nem frase pronta

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Q17: Dado de saúde é dado pessoal sensível: base legal, quem acessa e por quanto tempo se guarda (equivalente ao ADR-008 do Trabalhista)

## Dúvidas respondidas pelo PO
- (vazio)
