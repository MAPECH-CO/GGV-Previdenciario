# GGVP-159 — parte 5: desfecho, dinheiro e conversa

Base: origin/main em 5780145, consultada novamente em 12/10/2026. Branch: fix/GGVP-159-parte-5-desfecho-conversa.
Trabalho fora do /epico autorizado pelo Pedro. Sem conectores de serviços, subagentes, banco real ou serviços de homologação/produção.

## Entrega e limites, item por item

1. **Revisão do pedido 31:** comentário publicado em https://github.com/MAPECH-CO/GGV-Previdenciario/pull/31#issuecomment-6117471637, sobre 64f428c. O GET do desfecho exige apenas caso.ver e devolve o texto integral da publicação, potencialmente médico, ao Atendimento/Documentação. Recomendada separação no servidor pelo acesso dado_saude.ver_detalhe, sem filtro por palavras, com teste de texto fictício. Branch 96 commits atrás da main; recomendado rebase. Nenhuma alteração, fechamento ou merge no pedido do Mateus. Revisão estática, sem executar a branch dele.

2. **Prestação de contas:** a tela mostra a fonte dos valores (informação conferida pela advogada, percentual retornado do contrato, cálculo pelo sistema e versão anterior com autoria/data). A última versão preenche os campos para edição. Alterar valor, percentual, forma ou prazo invalida a conferência anterior; concluir exige novo OK. Clique duplicado durante a gravação é bloqueado. O cálculo continua a função já testada em contratos e é recalculado pelo servidor. A Sênior permanece somente em consulta; o OK segue sendo da advogada pela permissão existente. Pix e boleto do escritório usam as opções já aceitas; demais opções antigas preservadas.
   - Entrada, parcelas do contrato, distribuição de uma parte na Caixa e edição direta dos honorários não existem no contrato GET/POST da prestação. Campos indisponíveis, sem zero inventado e sem incluir valores ausentes na conta: **espera a rota do Mateus**. Não foi criada uma gravação local nem inventado um corpo de requisição.

3. **Ida ao banco:** o Financeiro agenda pela API existente e registra a ligação efetivamente feita, com o texto aprovado e declaração explícita. O registro usa POST /api/casos/:id/banco/envio com canal=telefone. O servidor já revalida o OK da advogada e o recebimento pelo Financeiro. A tela mostra o agendamento e os contatos do caso com data, canal e autoria, sem confundir registro de contato com confirmação de entrega.
   - O contrato de mensagens não possui modelo de ida ao banco e a rota de registro não envia Chatwoot. O complemento aparece como “não saiu pelo portal”, com botão indisponível: **espera a rota do Mateus**. Nenhum envio real foi executado.

4. **Conversa:** WhatsApp aparece como canal indisponível na abertura e no registro da conversa, com aviso de que as mensagens recebidas ainda não estão disponíveis. A main aceita somente ligação/presencial e não retorna mensagens recebidas: **espera a rota do Mateus**.
   - As pendências já são gravadas pela conferência no servidor e retornadas por GET /api/conversas/tarefas. Atendimento e Documentação usam a Central do Atendimento; a advogada tem sua Central. Teste novo, com tarefa inteiramente inventada, verifica as três visões, prazo e link. Não foi duplicada essa integração nem antecipada a remoção dos exemplos da parte 6.

5. **Verificação na ligação:** a tela avisa explicitamente que a comprovação da identidade não está disponível ali e que a ligação sozinha não confirma o cliente. Mantém o roteiro de retorno pelo contato cadastrado. A conferência por vídeo/presencial e contrato novo para alterar telefone/e-mail já existe e continua validada no servidor.
   - A resposta da conversa não traz um estado persistido de identidade verificada. Exibir uma confirmação positiva e registrá-la na ligação **espera a rota do Mateus**; não foi criado um selo local que pudesse simular verificação.

6. **Explicação do resultado:** o processo preserva o desfecho recebido da API e, depois dele, consulta GET /api/casos/:id/resultado. Só oferece abrir o texto quando há resumo aprovado retornado pelo servidor. Sem aprovação, aguarda o Jurídico; falha de consulta não vira texto de exemplo. O componente não usa a semente ou armazenamento do navegador.
   - O fluxo atual de aprovação do resumo é o do resultado negativo. A preparação da explicação para outros desfechos, quando não oferecida pelo servidor, **espera a rota do Mateus**. A confirmação de mérito do pedido 31 continua fora desta branch.

7. **Valor da causa e renda por pessoa do LOAS:** campos visíveis somente com sessão ativa nos perfis advogada, financeiro e socio, sem valores inventados. Valor da causa na petição; renda do LOAS na ficha do cliente e na entrevista de interesse LOAS. Como não há leitura/gravação desses campos na main, permanecem desabilitados: **espera a rota do Mateus**, inclusive validação no servidor e retorno por perfil.
   - A matriz atual não permite ao Financeiro abrir a petição. Ela não foi ampliada para expor a peça; uma consulta financeira separada desses valores também depende do servidor. Nenhum conteúdo da petição foi aberto ao Financeiro.

## Independência e verificação

- Nenhuma rota, migração, versão da matriz ou dependência nova.
- As partes anteriores ainda não estavam na main. Esta branch parte da main e não carrega seus commits.
- Pedido 65 da parte 4: todos os checks aprovados no commit e4320f2; nenhum merge feito.
- Dados dos novos testes inventados no próprio arquivo. Nenhum dado de cliente.
- Primeiro typecheck da parte 5: saída 0. Houve ajustes posteriores; a verificação final será registrada abaixo.
- Playwright escrito para o GitHub, não executado localmente.
- Pedro aprovou a parte 5 em 12/10/2026 para commit, push e pedido de revisão.


## Resultado local final

- `pnpm --filter @ggv/web typecheck`: saída 0, inclusive após os últimos ajustes.
- `pnpm --filter @ggv/web lint`: saída 0, zero erros; três avisos anteriores da main (api.ts/no-control-regex, Conferencia.tsx/exhaustive-deps, AtribuirTarefa.tsx/only-export-components).
- Primeira seleção de sete arquivos: **3 failed | 51 passed**, saída 1. Os três testes de CampoDeValorPendente encontraram campo e seção com o mesmo rótulo (`Found multiple elements with the text of: Valor da causa`). Corrigido o seletor para textbox; nenhum portão foi afrouxado.
- Segunda seleção: **69 passed (6 arquivos)**, saída 0, incluindo os nove testes do campo e a regressão das páginas.
- Rodada final: `pnpm --filter @ggv/web exec vitest run src/paginas/FechamentoFinanceiro.test.tsx src/paginas/Prestacao.test.tsx src/componentes/CampoDeValorPendente.test.tsx src/componentes/ExplicacaoDoDesfecho.test.tsx src/paginas/PendenciasDaConversaNasCentrais.test.tsx src/componentes/RegistrarConversa.test.tsx src/paginas/Conversa.test.tsx src/paginas/PaginaDoCaso.test.tsx src/paginas/Peticao.test.tsx src/paginas/FichaCliente.test.tsx src/paginas/EntrevistaAoVivo.test.tsx src/paginas/ExplicarResultado.test.tsx --maxWorkers=1 --pool=forks`: **114 passed (12 arquivos), saída 0, 85.78s**. Não somar as repetições.
- `git -c core.safecrlf=false diff --check`: saída 0.
- Cenário Playwright novo de prestação, edição antes do OK e campos indisponíveis. Cenário existente da via administrativa atualizado para registrar ligação por telefone. Nenhum Playwright local; a execução do GitHub ocorre depois do OK/PR.

## Verificação do GitHub no pedido 66

- Primeira execução, 38264758811: Playwright **1 failed | 252 passed (10.2m)**. O cenário presencial de conversa esperava zero opções WhatsApp; a parte 5 passou a mostrar a opção explicitamente indisponível. Saída: `Expected: 0 / Received: 1`.
- O cenário agora verifica que WhatsApp está desabilitado e que Vídeo continua ausente. Nenhuma espera ou regra de produção foi afrouxada. Nova execução do GitHub necessária; sem Playwright local.
