GGVP-9 · Judicialização e vigília · histórias: GGVP-26, GGVP-30, GGVP-34, GGVP-37, GGVP-74 (grupo 1); GGVP-52, GGVP-54, GGVP-58, GGVP-63, GGVP-67, GGVP-71, GGVP-79, GGVP-83, GGVP-87 (grupos seguintes).

## Por quê

Depois do indeferido (GGVP-48), o caso vai para a Justiça, e dali em diante quase tudo chega por publicação no diário. Se uma publicação não é lida, ou se a vigília falha e parece um dia sem publicação, o escritório perde prazo. O grupo 1 constrói o caminho da publicação: chega, é casada com o processo pelo número CNJ, a vigília roda 3 vezes por dia com alarme, uma pessoa lê e classifica o ato, o prazo é contado em código e a publicação cai na fila certa.

## Histórias na ordem

Grupo 1 (feito, PR #16), o caminho da publicação:
1. **GGVP-26** · Receber e casar a publicação pelo número CNJ · sistema; a Sênior trata a fila sem CNJ (resposta do revisor de 06/10).
2. **GGVP-30** · Vigiar 3 vezes por dia com alarme de falha · Sênior.
3. **GGVP-34** · Classificar o ato e contar o prazo · advogada responsável; a pessoa classifica até o épico IA (resposta do revisor de 06/10).
4. **GGVP-37** · Encaminhar pelo tipo de ato · sistema.
5. **GGVP-74** · Vigiar o processo e ler a publicação · advogada responsável.

Grupo 2 (agora), a exigência do juiz:
6. **GGVP-79** · Analisar a exigência e criar a tarefa do setor · advogada: "só ciência" ou "precisa cumprir", com os itens por setor (Atendimento, Jurídico, Documentação, perícia), o que cumprir e o prazo interno.
7. **GGVP-83** · Laços dos setores na exigência do juiz · cada setor tenta, registra as tentativas (G15) e sobe a prova no card (G21); sem conseguir, sobe para a Sênior.
8. **GGVP-87** · Manifestar e protocolar · com todos os itens provados, a advogada anexa e aprova a versão (G6), protocola com data e comprovante, e o processo volta para a vigília.

Depois (próximos grupos, cada um com o seu `/opsx:propose`): indeferimento e despacho (GGVP-52, GGVP-54, GGVP-58), petição e protocolo (GGVP-63, GGVP-67, GGVP-71).

## Travadas

- Nenhuma no grupo 1: a GGVP-26 e a GGVP-34 foram para "Refinada" em 06/10, com as respostas do revisor nos cartões.
- Nenhuma no grupo 2: a GGVP-79, a GGVP-83 e a GGVP-87 estão em "Refinada", com as respostas do revisor de 06/10 nos cartões (o Jurídico entra entre os setores; limites de cobrança na configuração; vencido com item sem prova sobe para a Sênior).
- **GGVP-67** depende da GGVP-63 (a IA escreve a petição); fica para o grupo da petição.

## Fora do escopo

- Integração real com a AASP e o DJEN: entra quando as credenciais estiverem no `.env` local e no Coolify (o Mateus traz em 07/10). Até lá, a vigília roda com uma fonte de exemplo, com as mesmas regras.
- IA (classificar o ato, resumir, sugerir tarefas): épico IA jurídica (GGVP-14). Sem IA, toda publicação casada passa por uma pessoa antes de ficar só registrada.
- Analisar a exigência do juiz (GGVP-79) e confirmar o desfecho (GGVP-90, épico Desfecho e financeiro): aqui o sistema só abre as tarefas, com o prazo.
- Canal do alarme para o suporte técnico (GGVP-30 CA8: "definir como vai ser enviado"): fica no histórico e no registro do servidor até a definição.
- Grupo 2 sem IA: sem tarefas sugeridas, sem "Fazer a minuta (IA)" e sem pedido pelo chat (GGVP-79 CA3, CA9, CA11, CA13; GGVP-87 CA1, CA6, CA7, CA8 ficam para o épico IA). A advogada monta os itens e redige a manifestação fora do portal; o portal guarda a versão, a aprovação e o protocolo.
- A decisão da Sênior quando o laço passa do limite (GGVP-94) e a atribuição pelo líder do setor: fora; aqui a tarefa sobe para a Sênior e continua com o setor.
- A marcação, a orientação e a remarcação da perícia pedida pelo juiz (épico Perícia): aqui o sistema só abre a tarefa, com a origem D3a.

## Portões envolvidos

G12 (na dúvida, prazo pelo lado mais seguro), G13 (vigília 3 vezes por dia; falha nunca parece dia sem publicação), G19 (prazo é código, não modelo), G5 (quem classifica e distribui é pessoa), G15 (toda cobrança tem limite), G21 (sem prova em todos os itens, não se manifesta), G6 (a advogada aprova a versão protocolada).
