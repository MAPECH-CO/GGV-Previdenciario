# T-02 · Conversar com o portal em linguagem natural

> Candidata a história, diagrama **Histórias transversais**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** qualquer pessoa da equipe\
**quero** perguntar e pedir coisas ao portal por escrito ou por voz ("o que falta no caso da Maria?", "marca a perícia do João para terça")\
**para** resolver o dia sem decorar telas.

**Passo BPMN:** transversal · **Épico:** Experiência por perfil · **Prioridade do PO:** 2 · **Estimativa:** G (provavelmente quebrar em consulta e ação)\
**Perfil:** qualquer pessoa da equipe

## Critérios de aceite
1. **Dado** uma pergunta sobre um caso que meu perfil pode ver, **quando** pergunto no chat, **então** a resposta cita o caso e o passo onde ele está, com link para abrir.
2. **Dado** uma pergunta sobre algo que meu perfil não pode ver (por exemplo, o Atendimento pede o valor da prestação de contas), **quando** pergunto, **então** o chat responde que não tenho acesso e não revela o dado.
3. **Dado** um pedido de ação (marcar, criar tarefa, anexar), **quando** peço no chat, **então** o portal mostra um resumo do que vai fazer e só executa depois que eu confirmo.
4. **Dado** um pedido que atravessa um portão de governança (`docs/requisitos/portoes-governanca.md`), **quando** peço pelo chat, **então** o portal recusa e mostra o portão que falta cumprir, por exemplo "falta o OK do sênior".
5. **Dado** uma ação feita pelo chat, **quando** consulto o histórico do card, **então** ela aparece com o meu nome, a hora e a indicação "feito pelo chat".

## Fora do escopo desta história
- O chat redigir petição (isso é PREV-35); o chat falar com o cliente. **Dados e permissões:** o chat herda exatamente as permissões do perfil de quem pergunta. Senha do gov.br nunca é devolvida pelo chat.

## Dados e permissões
- Quem usa: qualquer pessoa da equipe. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "qualquer pessoa da equipe".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
