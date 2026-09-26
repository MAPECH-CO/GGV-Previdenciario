# PREV-67 · Classificar cada documento médico que entra

> Candidata a história, diagrama **Governança da documentação médica por benefício**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Documentação\
**quero** que todo documento médico lido seja classificado (atestado, relatório, laudo, prontuário, exame, CAT, boletim de ocorrência, relatório escolar ou de terapia) com data, emitente e registro profissional\
**para** que o checklist saiba o que de fato chegou, e não só quantos arquivos chegaram.

**Passo BPMN:** `D1.18` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Documentação

## Critérios de aceite
1. **Dado** um documento médico digitalizado ou enviado, **quando** a IA lê, **então** o card mostra o tipo, a data de emissão, o nome do médico e o CRM, se constarem.
2. **Dado** uma classificação errada, **quando** a Documentação corrige, **então** a correção vale e fica no histórico.
3. **Dado** um documento ilegível, **quando** a leitura falha, **então** o item vira pendência "reenviar legível" para o Atendimento.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Documentação. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Documentação".

## Dúvidas abertas (bloqueiam a DoR)
- Q17: Dado de saúde é dado pessoal sensível: base legal, quem acessa e por quanto tempo se guarda (equivalente ao ADR-008 do Trabalhista)

## Dúvidas respondidas pelo PO
- (vazio)
