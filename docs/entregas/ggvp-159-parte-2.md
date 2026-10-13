# GGVP-159 · Parte 2 · Qualidade

Base: main em 11/10/2026, commit `5780145` (inclui os pedidos #58 e #59).
Branch: `fix/GGVP-159-parte-2-qualidade`.
Trabalho fora do /epico por autorização expressa do Pedro, sem Jira. Esta parte é independente do pedido #60 (parte 1), ainda fora desta base.

## Itens da parte

| Item | Entrega |
| --- | --- |
| Transcrições instável | O teste espera a gravação selecionada chegar antes de conferir o contador e clicar na lista. Esperar apenas pelo título deixava uma corrida com a consulta. |
| Bases instável | Todos os cenários esperam a linha retornada pelo servidor antes de conferir dados, exportar ou paginar; o cabeçalho vazio não serve como sinal de carregamento concluído. |
| ViaCEP | Retirada a resposta fixa de exemplo. O cadastro chama `buscarCep` de `@ggv/campos`, com o CEP normalizado na URL pública. Falha de rede, HTTP, JSON ou CEP inexistente deixam o endereço disponível para digitação manual. A consulta tem limite de dez segundos. |
| Respostas demoradas | Trocar o CEP ou sair da ficha invalida a resposta anterior; campos de endereço editados enquanto a consulta está em curso são preservados. CEP sem logradouro não preenche a rua com uma vírgula. |
| Formulários e servidor | Conferência abaixo; NB já era revalidado no servidor. Acrescentada prova por requisição direta. Corrigidas datas impossíveis nas regras de cobrança e perícia, reutilizadas pela API. |
| Pedido #4 | Avaliado somente por Git. Recomendação: rebasear; detalhes abaixo. Nenhuma alteração ou comentário no pedido ou na branch do Mateus. |

## Conferência dos formulários

A inspeção cobriu as entradas das páginas e dos componentes compartilhados, seguindo as funções de validação até os contratos e as rotas existentes. A biblioteca de campos fornece CPF, CEP, NB, CNJ, nome, telefone, e-mail, datas e números; escolhas fechadas, arquivos, horários, senhas e texto livre continuam com os contratos e regras próprios. Não se aplica um validador de nome, por exemplo, a um relato ou a uma busca parcial.

Caminhos da tabela são relativos ao repositório; `regras/`, `paginas/` e `componentes/` ficam em `apps/web/src`. As rotas ficam em `apps/api/src/rotas`.

| Formulário ou grupo | Validação na tela | Nova conferência no servidor |
| --- | --- | --- |
| Novo cliente, ficha e indicação | `CamposNovoCliente` / `EdicaoCliente` → `regras/formularios.ts` → campos | `recepcao.ts`: contratos, nome, CPF, telefone, e-mail, CEP e data novamente antes de guardar |
| Cadastro após entrevista e representante | `CadastrarLead` → `regras/cadastro.ts` e `formularios.ts` | `recepcao-decisoes.ts`: `errosDoCadastro` e `errosDoRepresentante` |
| Ficha de atendimento, inclusive quantidade de moradores | `FichaAtendimento` → `regras/fichaAtendimento.ts` → campos | `recepcao.ts`: `envioValido` |
| Segunda ficha e NB | `SegundaFicha` → `regras/segundaFicha.ts` → `validarNb` e datas | `recepcao-segunda-ficha.ts`: `segundaFichaValida`; NB inválido não altera ficha nem histórico |
| Marcação de entrevista e evento interno | Datas e durações fechadas na marcação; `NovoEvento` usa `erroDataDoCompromisso` → campos | `recepcao-agenda.ts`: contrato, `dataValida` e faixas de hora/duração |
| Fechamento, recontato e entrega de cópia | `regras/fechamento.ts`, `formularios.ts` e `contrato.ts` | `recepcao-decisoes.ts` e `recepcao-contrato.ts` repetem essas regras |
| Cálculo registrado e linha da deficiência | `regras/calculo.ts` e `deficiencia.ts`: inteiros, decimais e datas por campos | `recepcao-decisoes.ts` e `deficiencia.ts`: contratos e mesmas regras |
| Conferência de conversa e transcrição | `regras/conversa.ts` / `entrevista.ts`: telefone, e-mail, data e competência por campos | `conversa.ts` e `recepcao-entrevista.ts`: conferência das correções novamente |
| Conferência de documentos e kit/contrato | `ConferirDocumentos`, `PrepararContrato` → campos / `erroDoCampo` | `recepcao-documentos.ts` e `recepcao-contrato.ts`: campos lidos e correções revalidados |
| Acidente, deficiência, criança, parecer e roteiro | Regras compartilhadas; datas por campos; textos, graus e opções com regras próprias | `acidente.ts`, `deficiencia.ts`, `crianca.ts`, `parecer.ts`, `roteiros.ts` |
| Cobrança e complemento ao médico | `regras/cobranca.ts`: datas passam também por `isoParaData` nesta parte | `recepcao-cobranca.ts` e `complemento.ts` usam as mesmas regras |
| Tentativa e marcação de perícia | `MarcarPericia` → campos e `regras/pericia.ts`; nesta parte, data ISO também precisa existir | `pericia.ts` → `periciaNoCaso.ts` → mesmas regras antes de registrar |
| INSS, exigências, petição e manifestação | Contratos de `inss.ts`, `exigencia.ts` e `justica.ts` usam campos para datas, inteiros e CNJ | Rotas correspondentes fazem `safeParse` dos mesmos contratos |
| Prestação, recebimento e ida ao banco | `prestacao.ts`: decimais por campos e `DataObrigatoria`; escolhas e horários no contrato | `prestacao.ts` faz `safeParse` e confere as condições da etapa |
| Configuração, feriados, atribuição e filtros por data | Campos diretamente ou pelos contratos `governanca`, `feriados`, `setor` e `resultados` | Rotas correspondentes repetem o contrato; parâmetros também conferem a faixa |
| Login, troca de senha, cofre, dados bancários, mensagens, buscas e arquivos | Campos para e-mail/telefone quando aplicável; demais entradas nos contratos/regras próprios | Sessão e rotas de segurança, mensagens, bases e documentos revalidam os pedidos e as permissões |

Os problemas encontrados nas datas eram concretos: uma string como `2027-02-31` passava pelo formato ISO e pela comparação com hoje. Agora as quatro verificações (adiamento, novo prazo, tentativa de perícia e marcação) usam a biblioteca compartilhada, sem modificar arquivos de rotas.

O NB segue a regra já existente em `packages/campos/src/nb.ts`: dez dígitos não repetidos. Não foi inventado algoritmo de dígito verificador. As regras de limites e as funcionalidades previstas nas partes seguintes permanecem para suas respectivas partes.

## Avaliação do pedido #4 — recomendação: rebasear

Referências comparadas: main `5780145` e pedido #4 `ba76780`. O pedido tem um commit próprio; a main tem 399 commits que ele não contém. A leitura foi feita por `git fetch origin refs/pull/4/head:refs/remotes/origin/pr-4-avaliacao`.

A regra `numeroDoCaso`, o campo `HistoricoDoCaso.numero` e a apresentação do número por fase no histórico ainda não estão na main. A página do processo atual não substitui esses itens. Fechar o pedido descartaria trabalho ainda necessário.

A simulação de junção por `git merge-tree --write-tree --name-only origin/main origin/pr-4-avaliacao` retornou código 1, por conflitos esperados, sem alterar índice, checkout ou branches. Arquivos com conflito:

- `apps/api/src/banco/exemplo.ts`
- `apps/web/src/paginas/ConferirAcervo.test.tsx`
- `apps/web/src/paginas/Historico.tsx`
- `openspec/changes/ggvp-2-fundacao-tecnica/proposal.md`
- `openspec/changes/ggvp-2-fundacao-tecnica/tasks.md`

Ao rebasear, preservar o visual atual de Histórico e conferir novamente os números fictícios incluídos depois. A spec proposta também precisa conciliar o cenário CA1 com seu próprio requisito: o texto permite telefone compartilhado, mas o cenário ainda afirma que telefone repetido nunca cria segundo cadastro. Esta avaliação não executou testes na branch do Mateus, não a alterou e não fecha o pedido.

## Verificação local

Resultados e comandos registrados abaixo. Os testes usam respostas inventadas e banco PGlite descartável em memória. Nenhum serviço externo foi consultado. Playwright foi atualizado para interceptar ViaCEP com endereço fictício e cobrir indisponibilidade; sua execução fica com o GitHub, conforme pedido do Pedro.

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ggv/web exec vitest run src/componentes/Transcricoes.test.tsx src/paginas/Bases.test.tsx src/paginas/CadastrarLead.test.tsx src/dados/cadastro.test.ts --maxWorkers=1 --pool=forks` | 4 arquivos, 36 testes passaram (52,66 s). O jsdom emitiu seu aviso de navegação não implementada no teste de download; saída 0. |
| `pnpm --filter @ggv/api exec vitest run src/rotas/recepcao-segunda-ficha.test.ts --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000` | 1 arquivo, 4 testes passaram (50,23 s). |
| `pnpm --filter @ggv/campos test` | 11 testes passaram, nenhum falhou. |
| `pnpm --filter @ggv/api exec vitest run src/rotas/recepcao-decisoes.test.ts src/rotas/recepcao-checklist.test.ts src/rotas/pericia.test.ts -t 'o cadastro completa\|a tentativa com data\|revalida datas' --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000` | 3 testes passaram; 40 não selecionados pelo filtro (26,86 s). |
| `pnpm --filter @ggv/web exec vitest run src/regras/cobranca.test.ts src/regras/pericia.test.ts src/regras/formularios.test.ts src/regras/segundaFicha.test.ts src/regras/cadastro.test.ts --maxWorkers=1 --pool=forks` | 2 arquivos, 35 testes passaram (9,36 s). Os três últimos caminhos não existem nessa pasta e não foram executados; não contam como verificação. Cadastro foi testado no primeiro comando; NB, diretamente na API. |
| `pnpm --filter @ggv/web exec vitest run src/paginas/NovoCliente.test.tsx src/paginas/SegundaFicha.test.tsx src/dados/segundaFicha.test.ts --maxWorkers=1 --pool=forks` | 3 arquivos, 16 testes passaram (14,17 s). |
| `pnpm -r --workspace-concurrency=1 typecheck` | Saída 0; contratos, API e web passaram em sequência. |
| `pnpm -r --workspace-concurrency=1 lint` | Saída 0; sem erros, três avisos anteriores em AtribuirTarefa, api.ts e Conferencia. |
| `git diff --check` | Saída 0, sem apontamentos. |

Total: 105 testes passaram. Nenhum teste falhou.

Sem nova dependência, migração ou alteração da matriz. Nenhuma rota de produção foi criada ou editada. Pedro aprovou os resultados locais com “ok”. Commit, push e pedido de revisão autorizados; a revisão e o merge continuam com o Pedro.
