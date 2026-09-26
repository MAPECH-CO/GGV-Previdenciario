# Guia do Scrum na MAPECH

Como o Scrum funciona no projeto GGV Previdenciário, parte por parte, com o que cada pessoa faz. Referência: Scrum Guide 2020, aplicado a uma equipe de quatro pessoas com sprints de uma semana.

## 1. Por que Scrum aqui
No projeto anterior, duas versões do mesmo produto foram construídas sem ponte entre quem sabia o que o escritório precisava e quem construía. O Scrum resolve isso com três coisas: um dono do que construir, separado de quem constrói; uma cadência curta com entrega inspecionada toda semana; e uma definição única de "pronto". Tudo o mais é detalhe.

## 2. Regras de ouro
1. A história no Jira é a unidade de trabalho. Sem história, não se constrói.
2. Ninguém constrói sozinho: todo PR é revisado pelo outro dev.
3. "Quase pronto" não existe. Ou cumpre a Definition of Done, ou não conta.
4. O PO decide o quê e em que ordem. Os devs decidem como. O SM guarda o processo.
5. Mudança de arquitetura é ADR decidido em planning, nunca commit.

## 3. Papéis

### Product Owner: Lucas
Responsável pelo valor do produto. Na prática:
- Mantém o Product Backlog ordenado no Jira. A ordem é dele, e só dele.
- Escreve a meta do produto e a meta de cada sprint junto com os devs.
- Traz os requisitos do escritório para histórias com critérios de aceite. Na preparação, reserva duas horas por dia para isso.
- Responde dúvida dos devs no mesmo dia. Dúvida sem resposta é impedimento.
- Aceita ou recusa cada história na Sprint Review, em homologação, e registra no Jira.
- Fala pelo escritório. Leva o contato de referência para a review.
- Não escreve código do produto durante a sprint. Não distribui tarefas: os devs puxam.

### Scrum Master: Fernando
Responsável por o processo funcionar. Na prática:
- Marca, conduz e encerra os eventos no horário.
- Remove impedimentos no mesmo dia em que aparecem na daily. O que não consegue remover, escala.
- Guarda a Definition of Ready e a Definition of Done. Devolve história que não cumpre.
- Faz o meio de campo entre o PO e os devs: traduz requisito em história quando o PO trava, e traduz limitação técnica para o PO.
- Protege a sprint: pedido novo vai para o backlog, não para o quadro.
- Acompanha as métricas da seção 10 e leva para a retro.
- Não decide escopo, não estima, não atribui tarefa.

### Desenvolvedores: Pedro e Mateus
Responsáveis pelo incremento. Na prática:
- Decidem como construir, dentro da arquitetura registrada nos ADRs.
- Estimam em P, M ou G no refinamento.
- Puxam histórias Prontas na planning até o limite da capacidade.
- Uma história por vez, no máximo duas em andamento por pessoa.
- Revisam o PR um do outro em até um dia útil.
- Sustentam a homologação: se caiu, é a prioridade.
- Sinalizam impedimento na daily, sem esperar a review.
- Pedro é referência em front-end, Mateus em back-end e infra, mas os dois trabalham em qualquer história.

### Escritório: contato de referência
Uma pessoa nomeada pelo PO, presente na review de sexta, com poder de dizer "isso serve" ou "isso não serve".

## 4. Capacidade

| Medida por dev | Horas por semana |
|---|---|
| Jornada | 40 |
| Suporte ao Prev antigo em produção, fora do Scrum | 4 |
| Disponível para o projeto | 36 |
| Eventos do Scrum | 4 |
| Revisão de PR, correção, homologação | 7 |
| Trabalho em história | 25 |

Time: 72 horas disponíveis, cerca de 50 horas de trabalho em história por sprint. A planning seleciona por essa conta, não por vontade. Valores herdados do Trabalhista; a confirmar na abertura, agora que o Trabalhista está pausado.

Regras sobre o suporte ao Prev antigo:
- As 4 horas de suporte ao portal que está em produção são fora do Scrum: não entram no quadro, não viram história, não mudam a meta da sprint.
- Se numa semana o suporte exigir mais que 4 horas, o dev diz na daily. O SM ajusta a sprint com o PO, tirando história, nunca esticando o prazo.
- Trabalho do Trabalhista não entra neste repositório, e vice-versa.

## 5. Eventos

### Sprint: segunda a sexta
Uma semana. Começa na planning de segunda e termina na retro de sexta. Não se estende. O que não ficou Aceito volta para o backlog e é reordenado pelo PO.

### Sprint Planning: segunda, 9h, uma hora
Quem: os quatro.
Entrada: backlog ordenado, histórias Prontas, capacidade da semana, resultado da review anterior.
Roteiro: o PO propõe a meta da sprint em uma frase; os devs puxam histórias Prontas até a capacidade; para cada história, os devs dizem em duas frases como vão atacar; o SM registra a meta no campo do sprint no Jira e inicia o sprint.
Saída: Sprint Backlog no Jira, com meta escrita.
O que não é: não é hora de refinar. História que não está Pronta não entra.

### Daily: todo dia, 9h, quinze minutos, no Google Meet
Quem: os devs falam, o PO e o SM ouvem.
Onde: a sala fixa do projeto no Meet, a mesma todos os dias. Nenhuma reunião do projeto acontece por WhatsApp.
Formato, três respostas por pessoa: ontem, hoje, impedimento.
Na segunda, a daily acontece dentro da planning; não são duas reuniões.
Quem não puder entrar deixa as três linhas no comentário do cartão antes das 9h.
O SM responde ao impedimento até o meio-dia.
O que não é: não é relatório para chefe. É sincronização entre os devs e o gatilho do SM.

### Refinamento: quarta, 14h, quarenta e cinco minutos
Quem: os quatro.
Roteiro: o PO apresenta as próximas histórias do backlog; os devs perguntam até não sobrar dúvida; estimam em P, M ou G; história grande demais é quebrada na hora; o SM confere a Definition of Ready e marca "Pronta".
Saída: pelo menos o dobro da capacidade da próxima sprint em histórias Prontas.

### Sprint Review: sexta, 15h, quarenta e cinco minutos, com o escritório
Quem: os quatro mais o contato de referência.
Roteiro: cada história da sprint é mostrada em homologação, pela pessoa que a construiu, no fluxo real, sem slides; o PO e o contato dizem "aceita" ou "recusa" na hora; recusa leva o motivo escrito no item e a história volta para Pronta; ao final, o PO diz o que muda na ordem do backlog.
Saída: itens marcados Aceita no Jira, backlog reordenado.
O que não é: não é apresentação de progresso. É inspeção do incremento.

### Retrospectiva: sexta, logo após a review, trinta minutos
Quem: os quatro, sem o escritório.
Roteiro: cada um diz uma coisa para manter e uma para mudar; o time escolhe uma única melhoria para a próxima sprint, com dono; o SM registra em `docs/scrum/retros/AAAA-MM-DD.md` e confere na retro seguinte se a melhoria aconteceu.
Regra: fala-se de processo e de trabalho, nunca de pessoa.

## 6. Artefatos

### Product Backlog
Vive no Jira, projeto GGVP. Um épico por processo do BPMN. Uma história por passo crítico, com o rótulo do passo, por exemplo `bpmn-d1-05`. Ordenado pelo PO. Só o topo precisa estar Pronto.
Meta do produto: o escritório operando o dia a dia no portal.

### Sprint Backlog
As histórias selecionadas na planning, a meta da sprint e o plano de ataque de cada história. Depois da planning, só muda por troca de igual tamanho feita pelo PO, e só se a meta continuar de pé.

### Incremento
O que está em homologação e cumpre a Definition of Done. Só o que foi Aceito conta. A soma dos incrementos aceitos até o fim da quarta sprint de desenvolvimento é a Release 1.

### Compromissos e documentos de apoio
- Definition of Ready: `definition-of-ready.md`. Sem ela, a história não entra na sprint.
- Definition of Done: `definition-of-done.md`. Sem ela, a história não conta.
- ADRs em `docs/decisoes/`: decisões de arquitetura e de projeto.
- BPMN em `docs/bpmn/`: fonte de toda história.
- Requisitos em `docs/requisitos/`: cópia versionada das histórias e o glossário do escritório.

## 7. O fluxo de uma história
1. Nasce no backlog, ligada a um passo do BPMN.
2. Refinamento: critérios de aceite, dúvidas respondidas, estimativa, Pronta.
3. Planning: entra na sprint.
4. O dev cria a branch `feat/GGVP-n-descricao`. O item vai para Em desenvolvimento sozinho.
5. O dev trabalha dentro da história, com o Claude Code lendo o CLAUDE.md do repositório.
6. PR com a chave no título. O item vai para Em revisão sozinho. O outro dev revisa em até um dia útil.
7. Merge em `main` implanta em homologação. O item vai para Em homologação sozinho.
8. Review de sexta: o PO testa em homologação e marca Aceita.
Detalhes das ferramentas em `../ferramentas.md`.

## 8. Estimativa
- **P**: até um dia de trabalho de uma pessoa.
- **M**: dois a três dias.
- **G**: a sprint inteira de uma pessoa.
- Maior que G: quebrar antes de entrar.
A estimativa serve para caber na capacidade, não para cobrar. Depois de três sprints, o time compara estimado com realizado na retro.

## 9. Políticas
- Limite de trabalho em andamento: duas histórias por dev.
- Pedido novo no meio da sprint vai para o backlog. O PO decide na próxima planning. Exceção: homologação fora do ar, que é impedimento e entra na hora.
- Bug em homologação vira item do tipo Bug. O PO decide se troca por uma história da sprint.
- Spike: investigação com prazo, para responder uma pergunta que impede a estimativa. Prazo de no máximo dois dias, rótulo `spike`, resultado escrito no item: o que foi testado e o que se recomenda. O spike termina em ADR ou em história estimável. Não entrega código de produção.
- Dívida técnica: rótulo `divida-tecnica`, entra no backlog como qualquer item, o PO ordena.
- Dev que termina cedo puxa a próxima história Pronta ou revisa PR aberto. Nunca começa algo fora do backlog.

## 10. Métricas que o SM acompanha
| Métrica | O que mostra |
|---|---|
| Histórias aceitas por sprint | Vazão real |
| Aceitas sobre planejadas | Qualidade da planning e da DoR |
| PRs com revisão de outra pessoa | Se a regra de ouro 2 está viva |
| Tempo de PR aberto até merge | Onde o trabalho para |
| Impedimentos abertos há mais de dois dias | Se o SM está fazendo o papel dele |
| Melhoria da retro cumprida | Se a retro serve para algo |

## 11. Impedimentos e escalonamento
Impedimento é qualquer coisa que impede uma história de avançar hoje: dúvida sem resposta, ambiente fora do ar, dependência de terceiro, acesso faltando. Aparece na daily. O SM age no mesmo dia. Se depende do PO, o PO responde no mesmo dia. Se depende do escritório, o PO leva e traz a resposta em até dois dias. Nada fica aberto sem dono e sem data.

## 12. Calendário (proposta, a confirmar na abertura de 28/09)
| Sprint | Período | Meta |
|---|---|---|
| Sprint 0 | 28/09 a 02/10 | BPMN do Miro validado e numerado; candidatas refinadas; Figma das telas iniciais por perfil |
| Sprint 1 | 05 a 09/10 | Histórias do topo Prontas; base técnica herdada do Trabalhista; homologação no ar |
| Sprint 2 | 12 a 16/10 | Início do desenvolvimento: esqueleto por perfil e D1 |
| Sprint 3 | 19 a 23/10 | D1 com governança médica |
| Sprint 4 | 26 a 30/10 | D2 e DP |

## 13. Perguntas frequentes
- **O Lucas pediu algo no meio da sprint.** Vai para o backlog. Se for urgente de verdade, ele troca por uma história de igual tamanho, e a meta tem de continuar de pé.
- **Suporte ao Prev antigo tomou o dia inteiro.** Diz na daily. O SM tira história da sprint com o PO. O prazo não estica.
- **O outro dev não revisou meu PR.** É impedimento. Vai para a daily. Um dia útil é o limite.
- **A história ficou maior do que parecia.** Quebra: a parte que cabe fica, o resto volta para o backlog como história nova.
- **Preciso mudar a arquitetura.** Escreve um ADR proposto e leva para a planning. Até lá, segue o ADR vigente.
- **O escritório não pode vir na review.** A review acontece mesmo assim com o PO, e o contato recebe a gravação. Duas ausências seguidas viram impedimento levado aos sócios.
