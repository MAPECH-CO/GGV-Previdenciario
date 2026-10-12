# GGVP-159 — parte 6: busca, cópia da sessão e página do processo

Base: origin/main em 5780145, após git fetch origin em 12/10/2026.
Branch: fix/GGVP-159-parte-6-busca-processo.
Exceção ao /epico autorizada pelo Pedro. Trabalho só no worktree fechamento-pedro, sem subagentes, conectores de serviços, banco real ou acesso à homologação/produção.

## Portão da parte 6

`git log origin/main --oneline --grep=GGVP-158` não encontrou commits. A main segue no merge do pedido 59.
Conforme a história, esta entrega inclui apenas os itens independentes: limpar a cópia, busca e completar a página do processo com as rotas já existentes.

## O que mudou

1. **Sair, expirar e trocar de perfil:** apagam a cópia em memória e as chaves ggv.exemplo.* da sessão e do armazenamento local, inclusive versões antigas. Preferências de aparência não são apagadas. Uma resposta em andamento não consegue gravar de novo depois da limpeza. A troca só limpa quando confirmada pelo servidor; recusa mantém o perfil atual. Sair limpa imediatamente, inclusive se a rede falhar; nesse caso o login informa que o servidor não confirmou a saída e oferece tentar novamente. O cookie continua sendo encerrado pelo servidor.
2. **Busca em toda tela com topo:** campo presente no Topbar, em computador e celular, para quem possui caso.ver. Consulta POST /api/clientes/busca e POST /api/processos/busca, com validação dos contratos existentes e paginação. Termo no corpo, nunca no endereço. Clientes abrem a ficha; casos com ou sem número abrem a página do caso. Erro, resposta inválida ou vazia não recebe complemento de exemplo. Respostas antigas são descartadas ao editar o termo, trocar de perfil ou sair da tela.
3. **Central do Jurídico administrativo:** o campo da própria Central usa a mesma busca real, além do campo no topo. Os campos antigos das outras Centrais e a busca mista do balcão permanecem para a remoção completa do modo misto, condicionada ao servidor.
4. **Página do processo:** consulta juízo/vara/juiz em GET /api/casos/:id/juizo somente com estudo.ver. Consulta o status de laudo novo em GET /api/processos/:id/parecer; a existência e a data aparecem para os perfis do caso, sem mostrar conteúdo médico. O Jurídico e o Sócio recebem o atalho para análise. A API de parecer mantém sua regra atual de preparar a sugestão quando o Jurídico a abre; nenhuma integração foi chamada durante o desenvolvimento.
5. **Pergunta “Quem é o perito?”:** consulta a perícia e o cadastro reais, sem a lista de exemplo. A identificação usa POST /api/processos/:id/pericia/perito; se o laudo aguarda perito, usa /pericia/laudo/perito. Ações obedecem às permissões atuais de orientação e conferência do resultado, que o servidor verifica novamente. Só há confirmação após resposta positiva. Recusa mantém a pergunta e o aviso.

## Dependências e itens não feitos

- **Estratégia:** a main não oferece contrato de consulta/gravação. A página informa indisponibilidade: **espera a rota do Mateus**.
- **Juízo para perfis sem estudo.ver:** a rota disponível também retorna jurimetria e é restrita. Não foi chamada por esses perfis nem aberta uma exceção de acesso: **espera a rota do Mateus** com os dados básicos separados.
- **Modo misto, semente inicial e busca que mistura exemplo com banco:** aguardam as partes do servidor do caminho da Maria e da Recepção sem simulação na main.
- **Tarefas de exemplo e início só com tarefas/prazos do banco:** aguardam o mesmo portão. As filas atuais não foram substituídas nesta parte.
- **Taxas e painel do acervo, N casos/data da base, e chat sem respostas de exemplo:** aguardam o mesmo portão. Nenhum indicador novo de exemplo foi criado.

As mudanças ainda guardadas só no navegador deixam de acompanhar a troca de pessoa/perfil. É a limpeza solicitada; persistir esses fluxos é parte da remoção do modo misto do servidor.

Esta branch não carrega commits dos pedidos anteriores. A parte 4 (pedido 65) também toca o juízo na página do processo; na integração dos pedidos, conciliar as duas áreas para evitar consulta/cartão duplicados. A parte 5 (pedido 66) está com todos os checks aprovados em f0503e1; nenhum merge foi feito.

## Validação

- Sem rota de servidor, migração, matriz, dependência ou script de envio novo.
- Testes novos usam dados inventados no próprio arquivo. Nenhum dado de cliente real.
- Primeira rodada de cinco arquivos: **2 failed | 37 passed**, saída 1. Dois testes usavam advogada para a identificação vinculada à orientação, que exige o Jurídico administrativo. Corrigido o perfil dos testes sem ampliar permissão.
- Repetição isolada do arquivo: **11 passed**, saída 0.
- Typecheck inicial e intermediário: saída 0.
- Lint intermediário: saída 0, zero erros; dois avisos novos na busca corrigidos, além dos três anteriores da main.
- Playwright escrito para busca no topo/Central e página do processo. Cenários de sair e trocar perfil passaram a verificar a limpeza. Não executado localmente.

Resultado final e comandos registrados abaixo.

## Resultado local final

- `pnpm --filter @ggv/web exec vitest run src/dados/copiaDaSessao.test.ts src/componentes/BuscaGlobal.test.tsx src/componentes/ComplementosDoProcesso.test.tsx src/componentes/Topbar.test.tsx src/paginas/Entrar.test.tsx src/paginas/PaginaDoCaso.test.tsx src/App.test.tsx src/dados/servidorLigado.test.ts src/dados/servidor.test.ts --maxWorkers=1 --pool=forks`: **146 passed (9 arquivos)**, saída 0, 121.93s. Não somar a repetição isolada.
- `pnpm --filter @ggv/web typecheck`: saída 0 após o último ajuste.
- `pnpm --filter @ggv/web lint`: saída 0, zero erros; apenas os três avisos anteriores (api.ts/no-control-regex, AtribuirTarefa.tsx/only-export-components, Conferencia.tsx/exhaustive-deps).
- Após o último ajuste no controle das respostas atrasadas: `pnpm --filter @ggv/web exec vitest run src/componentes/BuscaGlobal.test.tsx --maxWorkers=1 --pool=forks`: **8 passed**, saída 0, 7.54s. Já incluídos nos 146 testes distintos.
- `git -c core.safecrlf=false diff --check`: saída 0.
- Playwright não executado nesta máquina.
- Pedro aprovou commit, push e pedido da parte 6 em 12/10/2026. A revisão humana ficará para o final das partes, conforme sua orientação.

## Ajuste da verificação do GitHub

A primeira verificação (38275348130) encontrou um teste antigo do menu que esperava preservar a cópia após trocar de perfil: `Tests 1 failed | 1535 passed (1536)`, `AssertionError: expected null to be '{"fichas":[]}'`. A expectativa foi atualizada para a limpeza exigida nesta parte.

- Teste isolado do menu: **6 passed**, saída 0 (`pnpm --filter @ggv/web exec vitest run src/componentes/MenuDaPessoa.test.tsx --maxWorkers=1 --pool=forks`).
- Typecheck: saída 0; oxlint: saída 0, somente os três avisos anteriores; `git diff --check`: saída 0.
- Nenhum comportamento de produção foi alterado neste ajuste. Playwright continua reservado ao GitHub.
