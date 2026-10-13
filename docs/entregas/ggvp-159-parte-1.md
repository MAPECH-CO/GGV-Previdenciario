# GGVP-159 · Parte 1: avisos e navegação honestos

Base: `origin/main` em `58d8b6f` (refinamento visual #58). Trabalho autorizado pelo Pedro fora do /epico, sem Jira, conectores, homologação, produção ou banco real. Só alterações na web; sem dependência nova, migração ou mudança da matriz.

## Itens

- Perícia: o registro pelo canal Chatwoot aparece como **registrada, não enviada**, tanto ao registrar quanto ao reabrir. O botão diz que só registra. A ligação mantém seu registro. O envio real fica para a parte 4.
- Lote de PDFs no chat: avisa que ainda não sobe arquivos, não oferece confirmar a importação e não grava contagens fictícias de acervo ou jurimetria. O caminho antigo de confirmação recusa a operação.
- Conferência: mostra **cálculo ainda não mostrado aqui**. Não afirma que o caso não tem cálculo. Integração com o cálculo fica para a parte 3.
- Mensagens: a janela distingue o envio simulado do status informado para o canal real. No histórico dos exemplos, contatos e eventos mostram **simulado**. Falhas continuam como **não saiu**.
- Navegação: corrigido o atalho da tarefa “Conferir antes do INSS”, que levava a `/processos/:id`, para a página existente `/casos/:id`.

## Limite do histórico de mensagens

O servidor grava texto livre nos contatos e no histórico e não devolve uma marca de simulação por mensagem. O modo atual do Chatwoot não comprova a origem de um registro antigo. Por isso, os registros legados vindos do servidor mostram **envio não confirmado**, sem afirmar entrega nem inventar a origem. A correção é apenas de apresentação; os registros originais permanecem intactos.

**Espera a rota do Mateus:** devolver a origem real/simulada em cada mensagem e nos registros correspondentes. Até lá, não é possível distinguir com certeza mensagens antigas do banco. A janela usa a marca `simulado` já fornecida no preparo da mensagem.

## Inventário de navegação após #58

A busca dos destinos emitidos pela web encontrou **um endereço de navegação sem tela**:

| Origem | Destino anterior | Solução |
|---|---|---|
| Fila da Sênior após liberação de exemplo | `/processos/:id` | Corrigido para `/casos/:id`, página do caso já existente; a conferência com decisão continua dependendo do caso na API. |

Os menus atuais já têm destinos implementados:

| Opções | Destinos existentes |
|---|---|
| Início por perfil | `/`, `/advogada`, `/juridico-administrativo` |
| Agenda, novo cliente, clientes, processos | `/agenda`, `/clientes/novo`, `/clientes`, `/processos` |
| Estudos e roteiros de laudos | `/estudos`, `/roteiros` |
| Tentativas, prazos, cofre e resultados | `/gestao/tentativas`, `/gestao/prazos`, `/gestao/cofre`, `/gestao/resultados` |
| Configuração, importação e financeiro | `/configuracao`, `/gestao/importar`, `/financeiro` |

Também foram conferidos os links de passos, contratos e casos contra os padrões do App. Downloads em `/api/...` são rotas do servidor; os sufixos dos contratos apontam às etapas já existentes; `#comparacao` é uma âncora de uma tela existente. `/relatorios` aparece somente no teste de endereço desconhecido e não é oferecido no menu. O fallback para endereços desconhecidos permanece. Nenhuma opção precisou ser removida do menu.

## Verificação

Testes focados cobrem o aviso da orientação e sua reabertura, a ausência de importação do lote, o cálculo indisponível, a apresentação do histórico sem alterar o original, a mensagem simulada e a abertura do caso. Cenários Playwright de orientação e mensagens foram atualizados para o GitHub; não executados nesta máquina por orientação do Pedro.

Resultados locais de 11/10/2026:

| Comando | Resultado observado |
|---|---|
| `pnpm install --offline --frozen-lockfile --ignore-scripts --child-concurrency=1 --network-concurrency=1` | Exit 0; 237 pacotes reutilizados, 0 baixados. |
| `pnpm typecheck` | Exit 0; contratos, API e web concluídos. |
| `pnpm -r --workspace-concurrency=1 lint` | Exit 0; sem erros, 3 avisos em trechos não alterados. |
| Primeira chamada por `pnpm --filter @ggv/web test … --maxWorkers=1 --pool=forks` | Exit 1 antes dos testes: `Unknown options: 'maxWorkers', 'pool'`. Chamada corrigida abaixo. |
| `pnpm --filter @ggv/web exec vitest run … --maxWorkers=1 --pool=forks` | Exit 0; `Test Files 9 passed (9)`; `Tests 132 passed (132)`; 119,81 s. |
| Playwright | Cenários atualizados, não executado localmente; aguarda GitHub. |

Arquivos do comando focado: `src/regras/registroDeMensagem.test.ts`, `src/dados/chat.test.ts`, `src/dados/liberacao.test.ts`, `src/componentes/ChatDoPortal.test.tsx`, `src/componentes/MensagemAoCliente.test.tsx`, `src/paginas/OrientarPericia.test.tsx`, `src/paginas/Conferencia.test.tsx`, `src/paginas/FichaCliente.test.tsx` e `src/App.test.tsx`.

Saída dos avisos do oxlint:

```text
src/componentes/AtribuirTarefa.tsx:11:14: warning react(only-export-components): Fast refresh only works when a file only exports components.
src/api.ts:50:22: warning eslint(no-control-regex): Unexpected control characters
src/paginas/Conferencia.tsx:30:10: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'carregar'
```

Sem commit, push ou pedido de revisão antes do “Agora ok?” do Pedro. Revisão, CI, homologação e aceite ainda são necessários conforme a Definition of Done.
