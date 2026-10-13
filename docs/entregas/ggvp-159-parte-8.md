# GGVP-159 · Parte 8: documentação, regras e treinamento

Base: main `5780145`, obtida por `git fetch origin` em 12/10/2026. Branch `fix/GGVP-159-parte-8-documentacao`, criada diretamente dessa base, sem carregar commits dos pedidos anteriores. Trabalho fora do /epico autorizado por Pedro; sem Jira, conectores, segredos, banco real ou homologação. Nenhum merge foi feito.

## Entregue item por item

| Item pedido | Resultado |
|---|---|
| Dúvidas abertas | Perguntas originais com estado respondida/parcial/aberta; decisões de CNIS, limites, tarefas, IA, kit, saúde, valores, perícia e prestação registradas. As 14 pendências de Lucas permanecem abertas. |
| Roteiro de teste | Atualizado para a main citada, com matriz 28, leitura total do Sócio, consulta da prestação pela Sênior sem OK e existência da tela da prestação. Aviso antigo do GitHub Actions removido. Passadas antigas no navegador continuam identificadas como históricas. |
| Conferência dos critérios | Matriz 28; recurso já tem spec/API/tela; juízo e nomeação de perito já têm servidor. Chance do recurso e integrações de tela ainda pendentes são explicitadas. Contagens de 09/10 são históricas, sem inventar recálculo de todos os critérios. |
| README e CLAUDE | Retirado o rótulo antigo; stack aceita, pgvector aceito no ADR-013 e agendamento atual por setInterval. Links para roteiro, dúvidas, decisões e treinamento. |
| ADR-001 e ADR-015 | Agendamento alinhado ao código, sem alegar fila pg-boss instalada. Chatwoot aceito, distinguindo aceitação de arquitetura de integração completa. Índice dos ADRs atualizado. |
| Supabase | Corrigidos kit/entrega-09-10, CA3 da spec de ambiente e tarefas 2.4/2.6; a 2.5 adjacente foi alinhada para não continuar descrevendo banco via Coolify/SSH. Não foi marcado provisionamento como realizado. |
| ADR-008 | O arquivo ainda não existia: registradas autorização de saúde pela IA (Lucas, 07/10), guarda permanente de áudio/transcrição, documentos médicos por tempo indeterminado e mesma regra para saída da IA. Região do banco e contratos com OpenAI/Mistral continuam abertos. |
| Treinamento | Material curto para os oito perfis em `docs/treinamento/por-perfil.md`; não declara treinamento realizado ou acessos reais entregues. |
| Coerência das regras | Perfis e G21 alinhados às decisões fornecidas: consulta da prestação, exceções de valores e pedido de dilação/reagendamento antes de encerrar item judicial sem documento. Não houve alteração da matriz nem das rotas. |

## O que ficou de fora e por quê

A parte 7 (Raio-X) foi **pulada por pedido expresso de Pedro em 12/10**. Nenhum formato de planilha foi inventado e nenhuma tela do importador foi criada nesta parte.

Os pedidos anteriores ainda não compõem a main usada aqui. O roteiro e o treinamento distinguem a base atual das melhorias em revisão. Funcionalidades que **esperam a rota do Mateus** continuam como dependência nos respectivos pedidos; documentação não simula sua entrega. A busca de `GGVP-158` no histórico de origin/main não retornou commits, por isso o restante condicionado da parte 6 permanece pendente.

Não houve nova rodada de homologação, aceite do PO, implantação, importação, subida dos modelos Word ou treinamento real. Região do banco, fornecedores, logins e demais assuntos de Lucas continuam abertos. As contagens gerais antigas da conferência não foram recalculadas sem revisar todas as histórias.

## Pedidos para a revisão final de Pedro

| Parte | Pedido | Observação |
|---|---|---|
| 1 · Avisos honestos | [#60](https://github.com/MAPECH-CO/GGV-Previdenciario/pull/60) | Verificação passou; correções de simulações e destinos incompletos. |
| 2 · Qualidade | [#61](https://github.com/MAPECH-CO/GGV-Previdenciario/pull/61) | Verificação passou; recomendação sobre o pedido #4 registrada sem editar/fechar a branch dele. |
| 3 · Caminho da Maria | [#64](https://github.com/MAPECH-CO/GGV-Previdenciario/pull/64) | Verificação passou; dependências de rotas e limites do rascunho CNIS documentados. Modelos Word ficam fora do repositório. |
| 4 · Perícia e Justiça | [#65](https://github.com/MAPECH-CO/GGV-Previdenciario/pull/65) | Verificação passou; cadastro/edição e configuração sem rota continuam indisponíveis. |
| 5 · Desfecho, dinheiro e conversa | [#66](https://github.com/MAPECH-CO/GGV-Previdenciario/pull/66) | Verificação passou; entrada/parcelas/Caixa, canal de WhatsApp, verificação de identidade e valores específicos têm dependências registradas. Comentário no #31 feito sem mudar a branch. |
| 6 · Busca, sessão e processo | [#67](https://github.com/MAPECH-CO/GGV-Previdenciario/pull/67) | CI verde no commit `8833943`, execução `38278128835`: Playwright 10m13s; tipos/lint/testes 12m43s. Modo misto e demais itens condicionados continuam pendentes. |
| 7 · Raio-X | Adiada | Pedido explícito de Pedro. |
| 8 · Documentação | Publicação aprovada | Pedro autorizou a publicação em 12/10/2026; testes e verificações abaixo. |

Esta tabela registra as verificações acompanhadas durante o trabalho; não declara revisão humana ou merge. Ao integrar, reconciliar os trechos de processo compartilhados pelos pedidos #65 e #67 e repetir a verificação da main.

## Verificação desta parte

Nenhuma dependência, migração, matriz ou código de execução foi alterado. A validação documental conferiu 15 documentos, 13 links locais, 12 arquivos de evidência, as 14 pendências de Lucas e os oito perfis. Este relatório acrescenta o 16º documento.

O primeiro `git diff --check` encontrou apenas um espaço no fim do título SE7: `docs/entrega/roteiro-do-teste-09-10.md:881: trailing whitespace.` Corrigido; nova execução com saída 0.

| Comando | Resultado |
|---|---|
| pnpm -r --workspace-concurrency=1 typecheck | Saída 0, contratos/API/web. |
| pnpm -r --workspace-concurrency=1 lint | Saída 0; zero erros, três avisos anteriores da main: api.ts/no-control-regex, AtribuirTarefa.tsx/only-export-components, Conferencia.tsx/exhaustive-deps. |
| pnpm --filter @ggv/contratos exec vitest run src/permissoes.test.ts --maxWorkers=1 --pool=forks | 33 passed, saída 0, 1.32s. |
| pnpm --filter @ggv/api exec vitest run src/rotas/recurso.test.ts src/rotas/juizo.test.ts src/rotas/prestacao.test.ts --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000 | 33 passed em 3 arquivos, saída 0, 149.87s; banco embutido e dados inventados pelos testes. |
| git -c core.safecrlf=false diff --check | Saída 0 depois da correção do espaço em branco. |

Total: **66 testes distintos passaram**. Nenhum timeout nessa rodada. O script local de conferência documental passou; só leu os documentos alterados, a versão da matriz e os caminhos de evidência. Nenhum teste acessou banco de verdade ou serviço externo.

Playwright não foi executado localmente; não há mudança de tela nesta parte. Não foram adicionados testes que apenas repetem o texto da documentação. Pedro autorizou o commit, o push e a abertura do pedido desta parte em 12/10/2026. A revisão será chamada por ele após as verificações do GitHub ficarem verdes.
