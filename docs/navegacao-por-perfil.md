# Navegação por perfil (GGVP-135)

Auditoria de 08/10/2026, sobre a `main` com o Relacionamento no servidor (PR #34) e o roteiro do teste de 09/10
(`docs/entrega/roteiro-do-teste-09-10.md`, problemas P1 a P21) e a conferência dos critérios (`docs/conferencia-dos-criterios.md`).
Cada caminho marcado "teste" tem teste de navegação no navegador, com o login de exemplo do perfil
(`apps/web/e2e/navegacao.e2e.ts`), e teste de unidade da tela.

## Tela inicial e topo, por perfil

| Perfil | Tela inicial | Topo | Busca | Chat |
|---|---|---|---|---|
| Atendimento | Central do Atendimento | Início, Agenda, + Novo cliente | clientes, processos e a fila | sim |
| Líder do Atendimento | Central do Atendimento | Início, Agenda, a Gestão (Tentativas bloqueadas, Prazos, Uso do cofre, Resultados, Configuração), + Novo cliente | clientes, processos e a fila | sim |
| Documentação | Central do Atendimento | Início, Agenda, + Novo cliente | clientes, processos e a fila | sim |
| Advogada | Central da Advogada | Início, Agenda | clientes, processos e a fila | sim |
| Sênior | Central provisória | Início, Estudos de caso, Roteiros de laudos, a Gestão | clientes, processos e a fila | sim |
| Jurídico administrativo | Central do Jurídico administrativo | Início, Agenda | clientes e processos (a fila, quando a Perícia liberar a Central) | sim |
| Financeiro | Central provisória | Início, a Gestão | só a fila (não vê o caso) | sim |
| Sócio | Central provisória | Início, a Gestão | só a fila (não vê o caso) | sim |

A busca segue a matriz de permissões: clientes e processos só para quem tem `caso.ver` (o servidor recusa a busca do balcão
sem ela); todo perfil acha as tarefas da própria fila. Quem não vê o caso recebe o aviso na própria busca.

## Telas que só abriam pelo endereço

| Tela | Perfil | Caminho por clique agora | Situação |
|---|---|---|---|
| Dispensar o parecer médico (P12) | Sênior | Busca → ficha do cliente → caso em andamento → "Dispensar o parecer" (só com parecer a dar, não suficiente nem já dispensado) | corrigido, teste |
| Linha do tempo da deficiência (P13) | Advogada e Sênior | Busca → ficha → caso PCD → "Linha do tempo da deficiência" | corrigido, teste |
| Roteiros de laudos (P13) | Sênior (edita) | Topo → "Roteiros de laudos" | corrigido, teste |
| Roteiros de laudos | Advogada (só vê) | Parecer → "ver o roteiro", como antes | sem mudança |
| Histórico do processo, do servidor (P13) | quem vê o caso | Busca → ficha → caso do servidor → "Histórico do processo" | corrigido, teste |
| Gestão: prazos, tentativas, cofre, resultados, configuração (P14) | Líder do Atendimento | Topo da Central do Atendimento | corrigido, teste |
| Busca da tela inicial (P11, GGVP-78 CA9) | todos | Campo do topo da Central | corrigido, teste |
| Chat "Pergunte ou peça" (P11, GGVP-78 CA6) | Sênior, Financeiro e Sócio | Central provisória, abaixo da busca | corrigido, teste |
| Atalho da fila vazia para buscar cliente (GGVP-78 CA4) | Sênior | "Buscar um cliente" põe o foco na busca | corrigido |
| Vigília das publicações e conferência do acervo | Sênior | Pela tarefa da Central, quando há rodada a reprocessar ou lote a conferir | sem mudança |
| Estudos de caso | Advogada e Jurídico administrativo | Nenhum: o link está só no topo da Sênior | anotado (abaixo) |

## Os leves

- **Histórico (P19):** os eventos que saíam com o nome técnico, sem acento (petição, exigência do juiz e do INSS,
  pendência do despacho, publicação, vigília), saem com o nome da equipe. "Pendência cumprida" deixou de dizer "da conversa":
  o mesmo evento vale para a pendência do despacho.
- **Kit da Configuração (P16):** o kit mostra o nome do documento, não o código do banco, e a data da versão sem hora; a
  versão 1 da semente passou a valer desde 01/01/2000 ao meio-dia, para não virar 31/12/1999 no fuso de São Paulo.

## O que espera decisão ou outro dono

| Item | Por quê | Quem |
|---|---|---|
| Nomes de exemplo misturados (P20): "Dra. Paula" e "Jéssica" nas telas do navegador; "Gabi (exemplo)" e "Fábio (exemplo)" no servidor | A troca passa pela documentação médica, a Perícia e a transcrição, que estão com grupos ativos. Fazer de uma vez, depois que eles entrarem | Pedro |
| A busca e o chat do Financeiro e do Sócio | A matriz não dá `caso.ver` a eles, e a busca não acha cliente. O Figma do Financeiro diz que ele "busca pelo processo/nome" e o chat dele responde o "Resumo do cliente". Decidir se o Financeiro (e o Sócio) veem o caso na visão restrita | Lucas |
| Texto da fila vazia: o critério pede "Nada pendente para você hoje"; a Central provisória diz "Nada na sua fila agora." | A Central da Sênior está com o grupo 6 (Tarefas do setor): aqui só acréscimo. Trocar o texto junto com eles | grupo 6 |
| Agenda, Clientes e Processos no topo da Sênior, do Financeiro e do líder, como no Figma | As telas "Clientes" e "Processos" não existem; criar tela fica fora desta história. A Agenda existe, mas ainda não foi conferida para esses perfis | Lucas (prioridade), Pedro |
| A Gestão no Figma é um item só ("Gestão"); o portal tem os cinco itens no topo | Decisão de produto, sem impacto no acesso | Lucas |
| Tarefas do setor (P6), caso devolvido e liberação | Com o grupo 6 | grupo 6 |
| "Ajustar o caso" (P2), "Levar ao banco" (P3) e as outras telas do servidor que faltam | Telas novas | Mateus |
| Marcar a perícia que o servidor abre (P1, P18) e as tarefas de exemplo sem tela (P4, P5) | Ligação da Perícia no servidor e telas novas | Pedro (GGVP-137), Mateus |
| Atribuir perfis a uma pessoa (P15) | Tela nova | Mateus |
| A busca da Central do Jurídico administrativo procurar também na fila (passar a fila ao campo, uma linha) | A Central está com a Perícia | grupo da Perícia |
| "Estudos de caso" no topo da Advogada e do Jurídico administrativo (os dois têm `estudo.ver`) | Achado na auditoria, fora da lista desta leva; a Central do Jurídico administrativo está com a Perícia | Pedro |
| A página do processo de um caso do servidor mostra só o que a cópia das telas tem | A página do processo está com um grupo ativo | Pedro |
