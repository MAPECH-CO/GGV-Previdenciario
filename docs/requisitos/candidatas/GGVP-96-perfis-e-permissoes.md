# GGVP-96 · Perfis e permissões

> Candidata a história, diagrama **Histórias transversais**. Cartão no Jira: [GGVP-96](https://mapech.atlassian.net/browse/GGVP-96), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-96. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** gestão do escritório\
**quero** atribuir a cada pessoa um ou mais perfis (Atendimento, Documentação, Advogada responsável, Sênior, Estagiário, Financeiro)\
**para** que cada um veja e faça só o que o BPMN prevê para a raia dele.\
**Perfil:** gestão do escritório

## Critérios de aceite
1. **Dado** uma pessoa só com o perfil Financeiro, **quando** abre um caso, **então** vê a prestação de contas e não vê entrevista, laudos nem petição.
2. **Dado** uma pessoa sem o perfil Sênior, **quando** tenta aprovar um caso para o INSS, **então** a ação não aparece.
3. **Dado** uma mudança de perfil, **quando** ela é salva, **então** fica no histórico com quem mudou e quando.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: gestão do escritório. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "gestão do escritório".

## Dúvidas abertas (bloqueiam a DoR)
- Q9: "Sênior" e "advogada responsável" são perfis diferentes ou a mesma pessoa em casos diferentes?
- Q20: "Sócio" é um perfil do portal? Quem vê o painel de resultado e os valores?

## Dúvidas respondidas pelo PO
- (vazio)
