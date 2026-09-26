# T-09 · Configuração do escritório

> Candidata a história, diagrama **Histórias transversais**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** gestão do escritório\
**quero** manter numa tela só os kits de documentos por benefício, os modelos de contrato, as mensagens padrão, os limites de cobrança e o checklist de cada benefício\
**para** mudar a regra do escritório sem pedir alteração no código.\
**Perfil:** gestão do escritório

## Critérios de aceite
1. **Dado** um benefício, **quando** edito o kit, **então** a mudança vale para os casos novos e os casos já abertos continuam com o kit da época.
2. **Dado** um modelo de contrato sem campos `{{...}}`, **quando** tento ativar, **então** o portal recusa e mostra que o modelo ainda traz dados de um cliente de exemplo (alerta do D1).
3. **Dado** qualquer mudança de configuração, **quando** salvo, **então** fica no histórico com quem mudou.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: gestão do escritório. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "gestão do escritório".

## Dúvidas abertas (bloqueiam a DoR)
- Q2: Os Contratos Completos do INSS ainda trazem dados de um cliente de exemplo. Quem converte cada um em modelo com campos `{{...}}`?

## Dúvidas respondidas pelo PO
- (vazio)
