# GGVP-159 — parte 4: Perícia e Justiça

Base: origin/main em 5780145. Branch: fix/GGVP-159-parte-4-pericia-justica. Trabalho fora do /epico autorizado pelo Pedro, sem Jira, conectores, subagentes, banco real ou serviços do projeto.

## Itens da história

- **Peritos:** tela protegida por estudo.ver consulta GET /api/peritos e pesquisa nome/especialidade. Cadastro, edição e perfil independente não têm rota na main: controles indisponíveis, sem semente ou gravação local. O perfil e a jurimetria disponíveis pela perícia do caso aparecem no processo. Cadastro independente e nomeação pela publicação **esperam a rota do Mateus**.
- **Orientação:** o texto revisado usa GET /api/fichas/:id/mensagens/pericia-orientacao e POST /api/fichas/:id/mensagens. A orientação só é registrada depois da resposta de envio bem-sucedida. Falha mostra “não saiu” e não conclui a tarefa. Serviço simulado não libera envio real. O contrato aceita 1.000 caracteres: sem corte silencioso. Se apenas o registro falha, repetir não reenvia a mensagem. Registros antigos, sozinhos, não comprovam envio; podem ser revisados e enviados. As verificações existentes do servidor permanecem.
- **Perícia judicial automática:** GET /api/processos/:id/pericia, sem completar com exemplo. O aviso “O sistema marcou” só aparece com marcacao.origem=juizo e registradaPor=Sistema. Inclui data, hora, local, instrução de preparação e caminho da perícia. Data registrada por pessoa não recebe esse aviso. Criar a marcação a partir da publicação **espera a rota do Mateus**; a tela aceita o formato existente.
- **Exigência sem documento:** primeiro oferece dilação, selecionando a peça, ou o caminho do reagendamento. A rota antiga de encerramento não exige essa etapa. A tela bloqueia a justificativa e o encerramento até o portão ser implementado no servidor. Liberação posterior e validação obrigatória **esperam a rota do Mateus**. Dilação, aprovação da Sênior e protocolo existentes foram preservados.
- **Configuração:** parâmetros já aplicados mantêm edição com faixa conferida por campos e revalidada no servidor. A cobrança configurada vale nos laços das exigências e despacho. Contato e remarcação eram gravados, mas não consumidos pelos fluxos: edição indisponível, com aviso. Tribunais de peticionamento e peticao.assinatura existem internamente, mas sem GET/PUT na configuração. Esses itens **esperam a rota do Mateus**. Feriados/suspensões continuam editáveis.
- **Juízo, juiz e perito:** GET /api/casos/:id/juizo fornece juízo, vara/juiz, procedência, tempo e entendimentos. Consulta e números somente para estudo.ver (Jurídico e Sócio). O perfil do perito vem da perícia real, com taxas calculadas pelo servidor. Os detalhes mostram “N casos · base de dd/mm”; falha não vira exemplo. No perito, base significa data do último laudo retornado, explicitamente indicada; casos distintos são contados em código com teste. Perfil vazio não inventa taxa ou base. O novo componente não grava essas respostas em sessionStorage.

## Independência

As partes anteriores não estavam na main. Esta parte repete só os avisos honestos da orientação e a correção de fuso do teste da perícia já aprovada no pedido 64. O pedido 64 teve todos os checks verdes em 4d4eb2c; nenhum merge foi feito. Sem dependência de código dos outros pedidos.

## Verificação

- Primeiro pnpm --filter @ggv/web typecheck: saída 0.
- Verificação concluída abaixo; pendências de rota continuam bloqueadas.
- Playwright escrito; não executado localmente.
- Nenhuma rota, migração, versão da matriz ou dependência nova.

## Limite de acesso da API atual

A função visao de rotas/pericia.ts ainda devolve números gerais e resumos do perfil fora do Jurídico (decisão antiga). A nova integração consulta essa rota **somente** com estudo.ver; não basta esconder os números depois de buscar. A página existente continua mostrando status, resultado e datas pelo resumo seguro de /casos/:id/processo. Esse resumo ainda não informa a origem/autor da marcação: o aviso específico de agendamento automático para os demais perfis **espera a rota do Mateus**, assim como a restrição dos números na resposta antiga. Nenhuma rota foi alterada nesta parte.

## Rodadas de teste

- Primeira seleção: 38 passed; 1 error, saída 1. O trabalhador de PaginaDoCaso não iniciou: “Timeout waiting for worker to respond”.
- Repetição isolada obrigatória: 1 failed | 18 passed. A página administrativa mostrava o atalho do juízo; corrigido para consultar juízo apenas na fase judicial.
- Regressão com integração da orientação: 39 passed (5 arquivos), saída 0. Inclui envio antes do registro, falha sem concluir e orientação antiga.

## Resultado local final

- pnpm --filter @ggv/web typecheck: saída 0 na repetição final. A rodada anterior apontou TS2352 (fixture incompleta) e TS2769 (opção exact indevida em getByRole); corrigidos com fixture completa tipada, sem cast para unknown, e seletor válido.
- pnpm --filter @ggv/web lint: saída 0, zero erros, três avisos anteriores da main (api.ts/no-control-regex, AtribuirTarefa.tsx/only-export-components e Conferencia.tsx/exhaustive-deps).
- pnpm --filter @ggv/web exec vitest run src/paginas/PaginaDoCaso.test.tsx src/componentes/JusticaDoCaso.test.tsx src/componentes/EnvioDaOrientacao.test.tsx src/paginas/OrientarPericiaIntegracao.test.tsx src/paginas/OrientarPericia.test.tsx --maxWorkers=1 --pool=forks --testTimeout=60000: **42 passed (5 arquivos), saída 0, 23.97s**. Inclui a repetição de todos os testes alterados após a primeira rodada.
- Os testes já aprovados de Configuracao, Manifestar, Peritos e amostraPerito completam **65 testes distintos aprovados**, sem somar as repetições. Todos os testes usaram dados fictícios; a fixture nova de integração é construída no próprio teste.
- git -c core.safecrlf=false diff --check: saída 0.
- Dois novos cenários Playwright escritos (peritos e exigência); cenário existente de orientação atualizado; fuso do cenário da perícia corrigido. Nenhum Playwright executado localmente.
- Pedro aprovou a parte 4 com “ok” em 12/10/2026; commit, push e pedido autorizados. Os checks do GitHub desta parte ainda não rodaram. Nenhum merge.
