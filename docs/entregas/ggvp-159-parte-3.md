# GGVP-159 — parte 3: caminho da Maria

Estado: implementação e verificações locais da parte 3 concluídas; Pedro autorizou commit e pedido de revisão em 11/10/2026. Integrações sem rota estão explicitamente bloqueadas. Base: origin/main em 5780145. Branch: fix/GGVP-159-parte-3-caminho-maria.

## Telas e dados

- Agenda: consulta as fichas e compromissos de /api/recepcao e as perícias de /api/pericias; erro de consulta não apresenta a cópia antiga como resultado atualizado. Filtro “Só as minhas” compara o nome do responsável com o nome da sessão. A API atual não fornece a identidade do responsável: nomes repetidos precisam ser resolvidos no servidor.
- Equipe: a main não tem rota de listagem de advogadas. Agendamento, início imediato e compromisso interno ficam indisponíveis para gravação no servidor, com aviso; não apresentam Dra. Paula como equipe real. **Espera a rota do Mateus.**
- Entrevista e preparação: buscam os dados atuais nas rotas existentes. A segunda ficha médica continua vindo da rota protegida, sem copiar conteúdo médico para sessionStorage.
- Desistência antes da entrevista: atalho no cliente abre motivo e data de recontato. Usa a rota existente de fechamento, com validação do servidor. A entrevista já marcada não é cancelada automaticamente por essa rota; a tela avisa. O cancelamento automático **espera a rota do Mateus**.
- Completar ficha: abre o cadastro completo que já contém Bairro e usa a rota existente de cadastro. A edição curta mostra o bairro e oferece o mesmo atalho; não envia um campo que a rota curta descartaria.
- Papel assinado: seleciona PDF/JPG/PNG, guarda metadados e bytes pelas rotas existentes, só confirma após as duas etapas. Falha de conteúdo não aparece como sucesso. A rota de conteúdo vincula ao primeiro caso do cliente: o envio do contrato é bloqueado se houver mais de um caso ou se o caso não corresponder. A ligação segura ao contrato e a confirmação da assinatura **esperam a rota do Mateus**; anexar não conclui a assinatura.
- Ficha de atendimento: impressão chama a janela do navegador com os campos da ficha, sem cofre; aceita arquivo digitalizado ou foto. O scanner é operado pelo aplicativo do equipamento. Não anuncia leitura automática do papel, pois ela ainda é simulada no servidor.
- Catálogo: os 34 benefícios passam a ter uma única fonte no pacote de contratos, reutilizada pela tela e Configuração. A Configuração mostra o modelo correspondente e bloqueia o benefício sem checklist. As rotas de configuração reconhecem apenas 11 destes benefícios, além do legado Outro: os demais **esperam a rota do Mateus**. Não houve migração ou alteração de rota.
- Gravação: vídeo e telefone avisam que o navegador capta somente o microfone da advogada.
- Transcrição ao vivo: falas parciais não são exibidas; a fala que contém “senha” e a seguinte são retiradas do DOM antes da renderização. O cofre e a pausa de gravação continuam sendo o caminho para colher a senha. Nenhum texto de entrevista é registrado em log por esta mudança.

## CNIS — conta por código e limite de persistência

Após a resposta de Pedro, a consulta às fontes públicas do INSS e do Planalto foi autorizada em 11/10. A [fundamentação e as convenções](../requisitos/calculo-cnis.md) registram a leitura das normas e a versão da memória. Não se trata de planilha homologada pelo escritório: a advogada confere a memória e os critérios de reconhecimento. O programa não decide elegibilidade.

A ficha real vem da API, sem CNIS de exemplo. A advogada digita início/fim, confere tempo e carência separadamente e informa competências com exceção. O código une dias sobrepostos, deduplica competências, separa o corte de novembro/2019, calcula pontos sem IA e mostra todas as parcelas. Data impossível, fora de ordem ou futura é recusada. Pendências não contam na parcela pendente e deixam o resultado explicitamente parcial. Análise especial, rural, deficiência ou outro regime permanece fora dessa memória de tempo comum.

A rota atual recebe somente totais manuais, usa CNIS de exemplo e não guarda vínculos/carência associados ao caso. A tela e o adaptador bloqueiam esse registro em ficha real. O rascunho fica apenas na memória da tela e desaparece ao sair. Persistência, validação compartilhada no servidor e leitura por caso **esperam a rota do Mateus**. A Sênior vê que a consulta não está disponível, em vez de ler ausência de cálculo. Não foi criada rota.

## Modelos Word — somente arquivos locais

O auditor imprime apenas contagens, inclusive de variáveis; não imprime nomes de arquivos ou texto. Leu os nove modelos originais. Encontrou 36 ocorrências de CEP e 20 de telefone; CPF, RG e nomes em contexto de qualificação tiveram contagem zero. A identificação de nomes é heurística e não comprova a ausência de todo nome próprio fora desses contextos.

Foram criadas nove cópias em C:/Users/user/ggv-arvores/modelos-2026-revisados-pedro, preservando os originais. As cópias mantiveram as contagens de variáveis (67, 67, 67, 96, 67, 47, 71, 57, 47) e tiveram zero nos padrões pesquisados. Nada foi incluído no Git ou enviado ao servidor. Os scripts de auditoria e limpeza usam dependências já existentes e não carregam .env.

## Verificação local da implementação disponível

- Typecheck sequencial dos pacotes: passou na primeira rodada. Na rodada final, contratos e API passaram; a web apontou TS18047 na função de impressão (valores ainda nulos). Proteção adicionada; pnpm --filter @ggv/web typecheck passou na repetição, saída 0.
- Primeira seleção de testes web: 4 failed | 27 passed (31), com 1 erro não tratado; corrigidos o recontato inicial, a captura de falha na preparação e os seletores dos testes.
- Recontato isolado após correção: 1 passed, 4 não selecionados.
- Segunda seleção de testes web: 11 failed | 44 passed (55), duração 429.52 s. Sete estouros de 5000 ms e quatro consultas que não encontraram o conteúdo no prazo. O arquivo servidorLigado passou.
- PrepararContratoKit repetido sozinho: no tests; 1 error — Timeout waiting for worker to respond. Não é aprovação dos testes; a inicialização do worker falhou.
- Auditor dos originais: saída 1 por indícios; auditor das cópias: saída 0, nove modelos, zero indícios nos padrões pesquisados.
- Repetição isolada de PrepararContratoKit com --testTimeout=60000: 4 passed (4), 27.57 s.
- Configuracao isolado com --testTimeout=60000: 11 passed (11), 28.11 s.
- CaminhoMaria isolado com --testTimeout=60000: 6 passed (6), 21.98 s.
- Regressão focada de 12 arquivos web com --testTimeout=60000: 75 passed (75), 93.60 s. Inclui upload, busca atual na API, filtro da transcrição, impressão e as telas Agenda, EntrevistaAoVivo, PrepararEntrevista, RegistrarFechamento, FichaAtendimento, ColherAssinatura, ConferirChecklist e Conferencia. Os três testes anteriores da impressão foram preservados.
- Auditoria e limpeza: pnpm --filter @ggv/api exec vitest run src/kit/auditar-modelos.test.ts --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000 — 2 passed (2).
- Catálogo: pnpm --filter @ggv/contratos exec vitest run src/catalogo-beneficios.test.ts --maxWorkers=1 --pool=forks — 1 passed (1).
- Total de testes distintos aprovados: 135 (132 web, incluindo os 35 de servidorLigado; 2 API; 1 contratos). Toda execução web usou --maxWorkers=1 --pool=forks. Os prazos maiores foram argumentos locais, sem alterar configuração dos testes.
- A primeira rodada de oxlint terminou com zero erros e seis avisos: três existentes e três novos por limpeza de estado no efeito. Os novos foram corrigidos isolando a ficha pela entrevista e a consulta da agenda pelo período. Regressão após esse ajuste: 35 passed (35), em seis arquivos; inclui teste novo de troca de entrevista sem mostrar a ficha anterior.
- Tipos finais: pnpm --filter @ggv/web typecheck passou após os últimos ajustes; contratos e API já haviam passado na rodada sequencial.
- Lint final: pnpm --filter @ggv/web lint passou, zero erros; três avisos anteriores da main (api.ts/no-control-regex, AtribuirTarefa.tsx/only-export-components e Conferencia.tsx/exhaustive-deps). O lint de contratos e API também passou na rodada sequencial.
- git diff --check: sem erros de whitespace; apenas os avisos de conversão LF/CRLF do Git no Windows. A memória nova do CNIS tem verificação separada abaixo. Playwright escrito para o GitHub, não executado nesta máquina.

## Verificação do CNIS após consulta autorizada

- pnpm --filter @ggv/contratos exec vitest run src/calculo-cnis.test.ts --maxWorkers=1 --pool=forks: 17 passed (17), saída 0.
- pnpm --filter @ggv/web exec vitest run src/componentes/CalculoCnis.test.tsx src/paginas/CalcularTempoLigado.test.tsx src/paginas/CalcularTempo.test.tsx src/paginas/Conferencia.test.tsx src/regras/calculo.test.ts --maxWorkers=1 --pool=forks --testTimeout=60000: 24 passed (24), quatro arquivos, saída 0. O último caminho não existe; o teste de dados está em src/dados/calculo.test.ts e foi executado separadamente, conforme a linha seguinte.
- git diff --check: saída 0; avisos LF/CRLF do Windows.
- pnpm -r --workspace-concurrency=1 typecheck: contratos e API passaram; web falhou, saída 1. Saída: TS2769, exact não existe em ByRoleOptions no teste novo; TS18046, corpo unknown; TS2304, window não encontrado. O import da fixture pelo E2E puxava tipos transitivos do navegador para o projeto Node. Corrigidos o seletor e a fixture, que agora é própria do E2E.

- pnpm --filter @ggv/web typecheck após as correções: saída 0. Contratos, API, web e tipos dos E2E verificados; Playwright continua sem execução local.

- pnpm --filter @ggv/web exec vitest run src/dados/calculo.test.ts src/paginas/CalcularTempoLigado.test.tsx --maxWorkers=1 --pool=forks --testTimeout=60000: 7 passed (7), saída 0. Inclui repetição do teste com seletor corrigido.
- Total da parte até esta rodada: 169 testes distintos aprovados (149 web, 18 contratos, 2 API), sem somar novamente as repetições.

- pnpm -r --workspace-concurrency=1 lint: saída 0; contratos e API sem apontamentos, web com zero erros e os mesmos três avisos anteriores (api.ts, Conferencia.tsx e AtribuirTarefa.tsx).

## Limites desta entrega

Sem conectores, serviços reais do projeto, segredos, novas dependências, alterações de rotas ou banco. Única consulta externa adicional: normas públicas do INSS e Planalto, expressamente autorizada. Os pedidos das partes 1 e 2 não estavam na main quando esta branch começou; esta parte preserva a base nova e repete apenas o aviso da conferência necessário para ser independente.

## Próximo passo

Com o ok recebido, criar o commit e o pedido da parte 3, levando os limites acima item por item, e acompanhar gh pr checks. Sem merge automático. A parte 4 começa em outra branch da main atualizada depois desse fluxo.

## Primeira verificação do pedido 64 no GitHub

Commit c10098c: tipos/lint/testes e análises de segurança passaram. Playwright: **8 failed; 246 passed (8.6m)**. Seis falhas eram o mesmo seletor parcial, que encontrava tanto a dica como o motivo de bloqueio da equipe; corrigido para correspondência exata. O teste do CNIS usava Atendimento e foi ajustado para a sessão da advogada, exigida pela tela. A perícia ultrapassou 180000ms com o botão desabilitado: o dado usava o dia de Brasília, mas os contextos do navegador usavam UTC; os contextos desse teste agora usam America/Sao_Paulo.

A perícia será executada isoladamente no CI, conforme a instrução de repetir isoladamente o teste que excedeu o prazo. O restante da suíte a exclui pelo título exato, sem remover cobertura ou relaxar as asserções. Nenhum Playwright foi executado localmente. As correções de verificação permanecem no mesmo pedido aprovado.
