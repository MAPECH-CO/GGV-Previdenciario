# Navegação por perfil (GGVP-135)

Auditoria de 08/10/2026, sobre a `main` com o Relacionamento no servidor (PR #34) e o roteiro do teste de 09/10
(`docs/entrega/roteiro-do-teste-09-10.md`, problemas P1 a P21) e a conferência dos critérios (`docs/conferencia-dos-criterios.md`).
Cada caminho marcado "teste" tem teste de navegação no navegador, com o login de exemplo do perfil
(`apps/web/e2e/navegacao.e2e.ts`), e teste de unidade da tela.

## Tela inicial e topo, por perfil

| Perfil | Tela inicial | Topo | Busca | Chat |
|---|---|---|---|---|
| Atendimento | Central do Atendimento | Início, Agenda, + Novo cliente | clientes, processos e a fila | sim |
| Líder do Atendimento | Central do Atendimento | Início, Agenda, Clientes, Processos, a Gestão (Tentativas bloqueadas, Prazos, Uso do cofre, Resultados, Configuração), + Novo cliente | clientes, processos e a fila | sim |
| Documentação | Central do Atendimento | Início, Agenda, + Novo cliente | clientes, processos e a fila | sim |
| Advogada | Central da Advogada | Início, Agenda, Clientes, Processos | clientes, processos e a fila | sim |
| Sênior | Central da Sênior (Figma 59:609), com as abas do setor | Início, Agenda, Clientes, Processos, Estudos de caso, Roteiros de laudos, a Gestão, Importar planilha | clientes, processos e a fila | sim |
| Jurídico administrativo | Central do Jurídico administrativo | Início, Agenda | clientes e processos (a fila, quando a Perícia liberar a Central) | sim |
| Financeiro | Central do Financeiro (Figma 59:863) | Início, Agenda, a Gestão, Financeiro (o painel) | só a fila (não vê o caso) | sim |
| Sócio | Painel de resultado (GGVP-75), com a busca, o chat e a fila quando há tarefa; o Figma não tem Central do Sócio | Início, Agenda, a Gestão, Financeiro (o painel, só os totais) | só a fila (não vê o caso) | sim |

O topo vem do perfil da sessão em toda tela, não só na Central (GGVP-78): Clientes e Processos depois do Início e da
Agenda para o líder do Atendimento, a Advogada e a Sênior (no Figma também para o Financeiro, que a matriz ainda não deixa
ver o caso); a Gestão no fim para quem tem `gestao.ver`, e o painel Financeiro depois dela para quem tem `valores.ver_totais`
(o Financeiro e o Sócio). "+ Novo cliente" fica só com o Atendimento, como no Figma. A Central provisória fica só para perfil
novo, antes da tela dele.

A busca segue a matriz de permissões: clientes e processos só para quem tem `caso.ver` (o servidor recusa a busca do balcão
e as listas de Clientes e Processos sem ela); todo perfil acha as tarefas da própria fila. Quem não vê o caso recebe o aviso
na própria busca.

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
| Chat "Pergunte ou peça" (P11, GGVP-78 CA6) | Sênior, Financeiro e Sócio | Central de cada um, abaixo da busca; o do Sócio no painel de resultado | corrigido, teste |
| Atalho da fila vazia para buscar cliente (GGVP-78 CA4) | Sênior | "Buscar um cliente" põe o foco na busca | corrigido |
| Vigília das publicações e conferência do acervo | Sênior | Pela tarefa da Central, quando há rodada a reprocessar ou lote a conferir | sem mudança |
| Estudos de caso | Advogada e Jurídico administrativo | Nenhum: o link está só no topo da Sênior | anotado (abaixo) |
| Clientes (GGVP-78): a base de clientes e leads, com busca e filtros | Líder do Atendimento, Advogada e Sênior | Topo → "Clientes" → nome abre a ficha; a contagem abre os processos do cliente | novo, teste |
| Processos (GGVP-78): todos os processos, com fase, benefício, foro, perito e desfecho | Líder do Atendimento, Advogada e Sênior | Topo → "Processos" → o número abre a página do processo; o autor abre a ficha | novo, teste |
| Painel Financeiro (GGVP-78, Figma 1930:4): recebido, a receber, a lançar e em atraso, receita por mês e por origem, as pendentes e os lançamentos | Financeiro (tudo) e Sócio (só os totais) | Topo → "Financeiro"; na Central do Financeiro com a fila vazia, "Abrir o painel Financeiro"; "Lançar" abre o recebimento da prestação | novo, teste |

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
| A busca, o chat, Clientes e Processos do Financeiro e do Sócio | A matriz não dá `caso.ver` a eles: a busca não acha cliente e o topo fica sem Clientes e Processos. O Figma do Financeiro põe as duas listas no topo, diz que ele "busca pelo processo/nome" e o chat dele responde o "Resumo do cliente". Decidir se o Financeiro (e o Sócio) veem o caso na visão restrita | Lucas |
| Texto da fila vazia: o critério pede "Nada pendente para você hoje"; a Central provisória diz "Nada na sua fila agora." | A Central da Sênior está com o grupo 6 (Tarefas do setor): aqui só acréscimo. Trocar o texto junto com eles | grupo 6 |
| A Gestão no Figma é um item só ("Gestão"); o portal tem os cinco itens no topo | Decisão de produto, sem impacto no acesso | Lucas |
| O Juiz em Processos: a coluna e o filtro estão no Figma, mas ficam vazios | O banco guarda o juízo e o foro, ainda não o juiz; esperam a importação do acervo gravar | Mateus |
| Tarefas do setor (P6), caso devolvido e liberação | Com o grupo 6 | grupo 6 |
| "Ajustar o caso" (P2), "Levar ao banco" (P3) e as outras telas do servidor que faltam | Telas novas | Mateus |
| Marcar a perícia que o servidor abre (P1, P18) e as tarefas de exemplo sem tela (P4, P5) | Ligação da Perícia no servidor e telas novas | Pedro (GGVP-137), Mateus |
| Atribuir perfis a uma pessoa (P15) | Tela nova | Mateus |
| A busca da Central do Jurídico administrativo procurar também na fila (passar a fila ao campo, uma linha) | A Central está com a Perícia | grupo da Perícia |
| "Estudos de caso" no topo da Advogada e do Jurídico administrativo (os dois têm `estudo.ver`) | Achado na auditoria, fora da lista desta leva; a Central do Jurídico administrativo está com a Perícia | Pedro |
| A página do processo de um caso do servidor mostra só o que a cópia das telas tem | A página do processo está com um grupo ativo | Pedro |
