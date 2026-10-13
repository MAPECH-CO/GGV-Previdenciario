# Design

## Context

- **Mensagens:** sem Chatwoot e com o contato da ficha, o correio (`apps/api/src/rotas/mensagens.ts`) grava a mensagem como `entregue`, embora nada tenha saído. O status é `enviada`, `entregue`, `lida` ou `falhou`, com uma CHECK no banco.
- **/saude:** devolve `ok`, `servico`, `banco` e `drive` (`Saude`, em `packages/contratos/src/index.ts`). A imagem é montada pelo `imagem.yml`, que já conhece o commit (`COMMIT`). O `Dockerfile` fixa `NODE_ENV=production`.
- **Banco:** `abrirBanco` (`banco/conexao.ts`), sem `DATABASE_URL`, abre o PGlite em memória com os usuários de exemplo. Isso vale também em produção.
- **Rotas:** 7 rotas `/api` não têm trava de permissão. São o chat (3 rotas), `/api/tarefas`, `/api/conversas/tarefas`, `/api/conversas/:id/pendencia/cumprida` e `/api/gravacoes/:id/arquivos/:doc`. A matriz está na versão 28.
- **Sugestão da IA:** 6 rotas gravam o `chamadaIaId` que a tela manda sem conferir de qual caso ele é: o indeferimento, a exigência do juiz, a recomendação da perícia, as duas da petição e o resumo do resultado.
- **Regra do "[completar]":** `faltaCompletar` usa `/\[completar[^\]]*\]/i`, que o CodeQL marca como regex lenta.
- **`@ggv/campos`:** só tem o script `test`, então o `pnpm -r typecheck` e o `pnpm -r lint` do CI pulam o pacote.
- **Erros:** o Fastify sobe com `logger: true` e sem tratador de erro.
- **Semente:** a do servidor (`banco/exemplo.ts`) não tem contrato da Recepção, leitura de documento, checklist, perito, juízo, agenda nem perícia.

## Goals / Non-Goals

**Goals:**
- o código das partes 1 e 2 da GGVP-158, uma tarefa por vez, com teste;
- desde 12/10, também o que é fora do código nessas partes (Coolify, GitHub, Supabase e CodeQL), feito com o Mateus.
  - O que precisa de segredo, senha ou token é dele: o token do Chatwoot, a senha da Sênior e a saída do `homologacao:preparar`.

**Non-Goals:**
- as partes 3 a 9;
- telas;
- apagar dado no banco da homologação: a proposta sai daqui, e quem roda é o Mateus.

## Decisions

1. **"Simulado, não saiu" sem migração, num PR à parte** (Mateus, 11/10). Ele mescla junto com o Chatwoot ligado na homologação. A janela do Chatwoot (`ConviteChatwoot`) para quando a mensagem não sai, e sem o Chatwoot o convite, a confirmação e a cobrança do roteiro travariam.
   - Sem Chatwoot, o correio grava `falhou` com o motivo "simulado, não saiu: o Chatwoot não está ligado neste ambiente". O status `falhou` já existe na CHECK, então não precisa de migração.
   - O `RELACIONAMENTO_SIMULADO` continua dando o contato e a conversa à tela, para o fluxo andar; só a entrega deixa de ser fingida.
   - Com `RELACIONAMENTO_SIMULADO=entrega`, o Chatwoot de mentira entrega. Só o Playwright usa (`playwright.config.ts`), porque o convite, a confirmação e a cobrança dos testes de tela precisam da entrega para seguir. Na homologação e na produção, nunca.
   - O aviso de mudança dos dados (`seguranca.ts`) usa o mesmo correio e já devolve o motivo quando a mensagem não sai.
   - Os testes que esperavam "entregue" no simulado passam a esperar "não saiu". O que depende de entrega de verdade (não repetir na mesma conversa, a tentativa do complemento) passa a ser provado com o Chatwoot de mentira dos testes da GGVP-146.
2. **Versão no /saude** (contrato primeiro).
   - `Saude` ganha `versao: z.string()`.
   - `criarServidor` recebe `versao`, que o `principal.ts` lê de `VERSAO`; sem ela, `local`.
   - O `Dockerfile` recebe `ARG VERSAO=local` e `ENV VERSAO=$VERSAO`.
   - O `imagem.yml` passa `build-args: VERSAO=${{ env.COMMIT }}`.
3. **Cabeçalhos num `onSend` do servidor**, sem dependência nova:
   - o `helmet` não é necessário para quatro cabeçalhos;
   - a CSP é `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://api.openai.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`;
   - a tela montada só carrega arquivos dela mesma. A exceção é o texto ao vivo da entrevista, que vai do navegador direto à OpenAI com a chave temporária (`dados/audio.ts`), por isso a OpenAI entra no `connect-src`;
   - o HSTS sai só com o cookie seguro (HTTPS);
   - o cabeçalho que a rota já pôs vale. O arquivo do cliente (documento, kit, gravação) sai com a CSP de sandbox, mais estreita que a geral, e o `onSend` não a troca;
   - no navegador, o zod roda sem JIT. Ele testa o `eval`, a CSP barra e o console fica com erro a cada tela. O `jitless` fica num módulo dos contratos importado antes de todo schema, e só no navegador: o servidor, sem CSP, mantém o JIT.
4. **Produção exige banco.** `abrirBanco` recusa abrir o embutido quando `NODE_ENV=production`, com a mensagem de que falta o `DATABASE_URL`. Os testes e o `pnpm dev` seguem como hoje.
5. **Lista das variáveis com teste.**
   - O `.env.example` na raiz tem só os nomes e um comentário por grupo; a mesma lista entra em `docs/infra/homologacao.md`.
   - Um teste lê o código do servidor (`process.env.X` e `ambiente.X`) e confere cada nome no `.env.example`.
6. **Trava nas 7 rotas.** A matriz vai para a versão 29, no fim da parte 2 e sobre a main mais nova, com a impressão digital nova no teste.
   - `chat.usar` e `tarefa.ver` entram para os 8 perfis, porque todo perfil tem chat e Central. O chat usa `chat.usar`, e as duas listas de tarefas usam `tarefa.ver`.
   - `tarefa.cumprir` entra para todos menos o Sócio, que não é responsável de pendência. A pendência cumprida usa essa permissão. Não usa `conversa.registrar`, porque a pendência pode ser da Documentação, do Jurídico administrativo ou do Financeiro. A conferência de dentro da rota fica: só o responsável ou a Sênior.
   - O arquivo da gravação usa `entrevista.ver`. A conferência de dentro da rota fica, porque é mais estreita: a permissão da gravação e o dado de saúde.
   - A recusa fica no histórico pelo `exigir` de sempre.
   - Na partida, um `onRoute` em `servidor.ts` recusa rota `/api` sem trava e diz qual é. Rota nova sem trava não passa nem nos testes.
   - Ficam fora da conferência as rotas da sessão (`/api/sessao`) e a que declara o motivo em `config.semTrava`. Hoje só uma declara: a que impede editar ou apagar o histórico. Ela recusa sempre, para todo perfil, e registra a tentativa.
7. **`chamadaDoCaso`** (em `apps/api/src/ia/ia.ts`): confere no `chamada_ia` que a chamada existe e é do caso. As 6 rotas recusam com 400 "A sugestão da IA não é deste caso." antes de gravar: as 5 do cartão e o resumo do resultado (`resultado.ts`), que grava a chamada do mesmo jeito.
8. **Tratador de erro do Fastify.**
   - O erro de validação mantém a mensagem e o status dele.
   - O erro inesperado responde 500 "Algo deu errado." e registra só a rota, o código e o nome do erro, nunca o SQL nem os parâmetros (o Drizzle põe os dois na mensagem).
   - O logger ganha `redact` para o cookie, a autorização e o `set-cookie`. A opção `logger` de `criarServidor` segue booleana.
9. **Regra do "[completar]" sem regex:** usa `indexOf` do "[completar" e depois do "]", em tempo linear.
10. **drizzle-orm 0.45.2 ou mais**, com o drizzle-kit da mesma família.
    - O teste das migrações confere que todas seguem aplicando, e a suíte inteira roda.
    - Se a versão mudar a API usada, o ajuste fica na mesma tarefa.
11. **`@ggv/campos`** ganha o `tsconfig.json` e os scripts `typecheck` (`tsc --noEmit`) e `lint` (`oxlint`), que o CI já roda por `pnpm -r`.
12. **Exemplos dos recursos novos só no preparo da homologação** (`semearRecursosNovos`, em `banco/exemplo.ts`). Entram os peritos de exemplo da tela, com o perfil, os entendimentos do "TRF3 · 6301" e uma reunião na agenda.
    - Ficam fora da semente da máquina e dos testes de tela. Nesses testes, um exemplo novo muda o que eles contam.
    - Cada exemplo entra só se falta (`onConflictDoNothing`, ou o título da reunião), então rodar o preparo de novo acrescenta sem duplicar.
    - O contrato da Recepção, a leitura, o checklist, as boas-vindas, a cobrança e a perícia ficam fora. Nascem no roteiro (lead novo e perícia decidida pela advogada). O kit do contrato precisa dos modelos do Word, que ainda não subiram.

**Fora do código (12/10, com o Mateus)**

13. **Chatwoot na homologação pela caixa do escritório**, a única que existe (GGV PREV, conta 2), por decisão do Mateus.
    - A trava é o `CHATWOOT_PERMITIDOS`, só com os telefones do time, e o `AMBIENTE=homologacao`.
    - As conversas de teste aparecem no Chatwoot dos atendentes, e a mensagem sai como enviada pela pessoa dona do token.
    - Feito e testado às 10:40: o telefone da lista recebeu, e o de fora ficou "fora da lista de teste".
14. **Os modelos do Word vêm dos anexos da GGVP-136**, baixados do ZapSign do escritório pelo Pedro, sem dado de cliente.
    - Ficam numa pasta fora do repositório (`D:\SSD\Downloads\modelos-kit-ggv`). Antes de subir, cada arquivo passa pela mesma conferência do portal (`lerModelo`).
    - Passaram o kit consumidor de 23/07 (`modelo-8`) e o seguro de vida (`modelo-10`).
    - Os 3 Contratos Completos (auxílio incapacidade, auxílio acidentário e LOAS) foram recusados pelos nomes de variável do ZapSign.
15. **O portal aceita os nomes do ZapSign** (decisão do Mateus, 12/10), em vez de editar cada modelo no Word.
    - Assim valem também os 9 modelos que ainda vão chegar do ZapSign.
    - Os sinônimos entram em `regras/kitDoModelo.ts` com o mesmo valor do nome do portal. `{{DIA}}`, `{{MÊS}}` e `{{ANO}}` saem da data do contrato, com a regra da primeira data.
    - O que a ficha não tem é opcional e sai em branco.
    - Vai num PR à parte, com teste num .docx montado na hora, sem modelo do escritório no repositório. O Pedro revisa, porque o kit é dele.
16. **Gotenberg:** a imagem `gotenberg/gotenberg:8` no mesmo projeto do Coolify, na porta 3000. Fica sem domínio público, porque não tem login e por ele passa contrato de cliente.
17. **Drive na homologação:** o Mateus decide entre só leitura e pastas de teste.
    - O lead de teste de 12/10 criou "Leads/2026/Teste Chatwoot Mateus" no Drive real. Quem apaga é o Mateus, e só o que o teste criou.
18. **Banco da homologação:** só leitura pelo conector do Supabase, com a autorização do Mateus. Só nomes e contagens; nenhum dado é lido.
19. **GitHub:** a proteção da main e a dispensa dos alertas do CodeQL vão pelo `gh`, com o Mateus de acordo. A proteção, também com o Pedro.

### Parte 3 · Caminho da Maria no servidor real (decisões do Mateus, 13/10)

A parte 3 é só servidor, com teste junto. As telas são do Pedro, e o pedido lista os contratos novos para ele ligar. Não há migração nem matriz nova: tudo usa tabelas e permissões que já existem.

20. **O G1 conta o contrato da Recepção conferido.**
    - Para o checklist da Recepção, "assinado" já vale da leitura em diante (`contratoAssinadoDo`).
    - Para o G1 da Sênior, vale do "conferido" em diante (etapa `copia` ou `entregue`), como pede o cartão. A regra nova, `contratoConferidoDo`, fica ao lado da outra em `regras/checklist.ts`.
    - A liberação ao Jurídico passa a usar o mesmo `bloqueioDoG1` da aprovação.
21. **O percentual de honorários é do modelo, não do caso.**
    - A Sênior informa o percentual de cada modelo na Configuração (`modelo.subir`). Fica na tabela `configuracao`, na chave `honorarios:<modelo>`, com o histórico.
    - Ao gerar o kit, o contrato da Recepção guarda o percentual do modelo daquele momento. Trocar o percentual depois não muda contrato já gerado.
    - A prestação lê o percentual do contrato da Recepção e, na semente, o da tabela `contrato`. O percentual digitado diferente é recusado (GGVP-92 CA8). Sem percentual no contrato, segue como hoje.
22. **O CNIS digitado mora na ficha**, como os cálculos, e não numa tabela nova (o cartão falava em tabela).
    - Os dados da Recepção já ficam no JSON da ficha, e as telas leem a ficha.
    - Guarda a origem (impresso ou Meu INSS), a data da extração, a entrada do cálculo, o resultado, quem digitou e quando.
23. **O cálculo é o `calcularCnis` que o Pedro já fez** (`packages/contratos/src/calculo-cnis.ts`, GGVP-159 parte 3, versão `rgps-comum-1`, regras em `docs/requisitos/calculo-cnis.md`).
    - Achado na tarefa 3.7 (13/10): o plano previa uma conta nova, por mês. O cálculo do Pedro já segue a EC 103 e a IN 128: dias até a reforma, competências depois, carência e pontos, com as competências pendentes à parte.
    - O servidor roda o mesmo código da tela, com a mesma entrada (`EntradaCalculoCnis`), e guarda o resultado. O número digitado na tela deixa de valer.
    - A regra e o "já pode se aposentar" seguem com o advogado.
    - Com competência pendente, o resultado é parcial, e o servidor não registra o cálculo.
24. **A equipe da agenda é a de usuários reais.**
    - `GET /api/equipe?perfis=advogada,senior` devolve só o id e o nome dos usuários ativos com o perfil, para quem marca (`ficha.editar`).
    - A marcação guarda `comId` e o nome. Enquanto a tela não muda, o id do catálogo fixo segue aceito, sem `comId`.
    - O filtro "só as minhas" é da tela, pelo `comId` e pela sessão.
25. **A desistência antes da entrevista é um resultado do compromisso**, como "realizado" e "faltou".
    - Usa a lista de motivos do "não fechou" (G16) e o mesmo recontato: com data, "Recontatar lead" na agenda; sem data, o lead arquivado com o motivo.
26. **Bairro:** `EdicaoDaFicha` ganha `bairro`, que o kit já pede.

### Parte 4 · Recepção sem simulação (decisões do Mateus, 13/10)

Também só servidor, com teste junto, num pedido em cima do #71. Migração nova só uma, a 0031 do catálogo, no fim da parte e sobre a main mais nova (se a main já tiver uma 0031, renumera). Não há matriz nova.

27. **A IA lê pela imagem.**
    - O modelo de texto da OpenAI recebe o arquivo (imagem ou PDF) junto com a instrução, numa chamada só. Assim enxerga a assinatura, a data em branco e a legibilidade, que o texto do OCR não mostra. A Mistral segue na perícia e no parecer.
    - O `Pedido` de `ia.ts` ganha o anexo. A sugestão pronta conta o hash do arquivo, e o registro guarda só o tamanho e o hash, como hoje.
28. **Quatro finalidades novas, em JSON:** `ler_documento_balcao`, `ler_ficha_atendimento`, `ler_segunda_ficha` e `ler_contrato_assinado`.
    - O documento médico usa a autorização do dado de saúde. O médico é reconhecido pelo tipo anunciado, como o `sensivel` do documento já é.
    - A segunda ficha também usa a autorização, por causa da seção médica.
    - Sem a autorização, a leitura é recusada, e a pessoa preenche.
29. **A regra é do código** (G19):
    - o CPF e a data pela `@ggv/campos`;
    - o tipo do catálogo; fora dele, o tipo anunciado;
    - a confiança de 0 a 100, com o limite que já existe;
    - a quarentena e o duplicado pelas regras de hoje.

    O texto cru da IA não vai à tela, como na perícia.
30. **A leitura acontece quando o conteúdo está no servidor:**
    - card e chat: no envio do conteúdo;
    - scanner: na rodada, que baixa o arquivo do Drive;
    - papel e contrato: na própria rota, que recebe o arquivo.

    O anúncio dos arquivos não lê mais, a não ser com a leitura de exemplo (decisão 39).
31. **A senha escrita no papel** (GGVP-24 CA15, G9):
    - a IA devolve a senha num campo à parte;
    - o código tira esse campo antes de guardar qualquer coisa, cifra a senha no cofre e marca a ficha com a senha no cofre;
    - o registro da IA guarda o JSON sem a senha: a sugestão ganha um `limpar`, que roda antes do registro;
    - a resposta diz só `senhaLida`.

    O modelo vê a imagem com a senha, pela autorização do Lucas de 07/10; o portal só guarda a senha no cofre.
32. **O scanner entra pelo Drive** (decisão do Mateus, 13/10; ADR-017). O n8n não muda.
    - **Quando:** a cada minuto, junto com a rodada do Drive, pela lista de mudanças do Drive compartilhado (`changes.list`). A marca da lista fica na `configuracao` (`drive:mudancas`). A primeira rodada só guarda a marca, sem trazer o passado.
    - **O que entra:** o arquivo novo cuja pasta-mãe é a pasta ligada a uma ficha. A pasta não ligada é ligada quando o título leva a uma ficha só (`pastaDoTitulo` e `pastasDoCliente`, a regra do balcão).
    - **O que fica fora:**
      - pasta e lixeira;
      - o que tem a marca do portal (`appProperties.portal`);
      - o que está em "A REVISAR";
      - o arquivo já conhecido (`documento.drive_arquivo_id`).
    - **Como entra:**
      - o arquivo vira uma linha de `documento` que aponta para o Drive, como o scanner de hoje, sem conteúdo no armazenamento, e entra na ficha;
      - o conteúdo é baixado só para a leitura (`drive.baixar`);
      - o tipo anunciado sai do começo do nome ("Tipo - Nome - data.pdf", o padrão do n8n); fora do catálogo, é "outro", e a IA sugere o tipo.
    - **O lote:** os arquivos de uma ficha na mesma rodada viram o lote da tarefa "Receber documento" aberta, para o registro do recebimento.
    - **Onde não roda:** com o Drive só leitura. A homologação, que olha o Drive real, não traz documento de cliente.
33. **O contrato assinado:**
    - a digitalização guarda o arquivo no armazenamento, como documento `contrato` do caso;
    - a assinatura em papel segue exigindo o arquivo;
    - a leitura manda à IA a lista de documentos do kit e devolve a `LeituraDoContrato`, que as telas já usam;
    - `GET /api/processos/:id/contrato/assinado` devolve o arquivo, para a cópia.
34. **O ZapSign sai:**
    - saem as rotas de envio e de retorno e a opção do servidor;
    - o serviço responde sempre `zapsign: false`;
    - a coluna `zapsign_id` fica, sem migração;
    - `ZAPSIGN_API_TOKEN` sai da lista de variáveis e da configuração do Playwright.
35. **Um catálogo só de benefícios:**
    - o `CATALOGO_BENEFICIOS` de `packages/contratos` ganha o id do servidor de cada um dos 34;
    - `BENEFICIOS`, `ROTULO_BENEFICIO` e os mapas das telas saem dele;
    - os 11 ids de hoje não mudam;
    - a migração 0031 troca o CHECK `caso_beneficio`.
36. **Drive:**
    - a rodada pula o documento de origem card ou chat ainda não conferido;
    - `POST /api/fichas` devolve as pastas parecidas, numa leitura de "#5. CLIENTES";
    - `POST /api/fichas/:id/pasta` liga a escolhida, que precisa estar na lista, ou cria a nova, com a marca do portal. A nova só nasce com CPF e com o Drive ligado. As duas ficam no histórico.
37. **O caso do documento:**
    - `EnvioDeArquivos` ganha `processoId`, obrigatório quando o cliente tem mais de um caso;
    - o local, o conteúdo e o arquivamento usam o caso do arquivo, e não o primeiro caso da ficha;
    - quando nasce o primeiro caso, os documentos sem caso da pessoa entram nele;
    - laudo, relatório médico e prontuário viram documento médico do caso.
38. **A cobrança na mensagem:** o modelo "cobrança" usa o `motivoParado` da cobrança do caso (`cobrancaDoCaso`).
39. **A leitura de exemplo fica atrás de `LEITURA_SIMULADA=sim`**, que o Playwright liga.
    - O leitor é o das telas (`lerComIADeExemplo` e companhia).
    - Com ela, as rotas aceitam a chamada sem arquivo, como hoje, e as rotas simuladas existem: o lote do scanner e a leitura do contrato.
    - O servidor recusa subir com ela e `AMBIENTE` igual a `homologacao` ou `producao`, a regra do `aceitaGanchoDeTeste`.

### Parte 5 · Perícia, INSS e Justiça (decisões do Mateus, 13/10)

Só servidor, com teste junto, num pedido em cima do #74. Várias rotas aqui são as que as telas da GGVP-159 parte 4 esperam ("espera a rota do Mateus"). Migração nova só uma, a 0032 (o tribunal e a assinatura padrão), no fim da parte e sobre a main mais nova. Não há matriz nova: a jurimetria usa `estudo.ver`, que já é do Jurídico e dos sócios.

Decisões do Mateus em 13/10: o alarme da vigília vai ao canal da equipe e abre chamado no Jira (a proposta dele de 02/10); o laço do cliente sumido fica fora da parte 5, porque não existe no código e falta dizer quando o cliente conta como sumido; plano aprovado, código em seguida.

40. **A orientação confere a mensagem** (P5.1).
    - A tela já envia antes, pelo correio do cliente (`POST /api/fichas/:id/mensagens`), e registra depois.
    - `OrientacaoAoCliente` ganha `mensagemId`, obrigatório no canal `chatwoot`. A rota confere a linha de `mensagem`: a pessoa do caso, o modelo `pericia-orientacao`, o texto da orientação e o status diferente de `falhou`.
    - O id vai à preparação da perícia e ao histórico.
    - O lembrete da véspera (`MensagemConferida`) ganha o mesmo `mensagemId`, com um dos dois modelos da perícia.
    - Sem enviar de verdade, nada registra. É a regra do "simulado, não saiu" da parte 1.
41. **O perito pelo nome** (P5.2).
    - `LeituraDaPublicacaoPelaIa` ganha `perito`, lido como a vara e o juiz; `ClassificarPublicacao` ganha `perito`, pelo `validarNome` da `campos`.
    - Uma função só, `peritoPeloNome(banco, nome, tipo)`, acha pelo nome e pelas grafias (a regra de `peritoDaPublicacao`) ou cria, com `perfil: { tipo, onde: vara do caso ou "", laudos: [] }`. O nome cai no índice único do `nome_normalizado`.
    - O tipo é o da perícia aberta do caso, a mais recente sem perito; sem perícia aberta, médica.
    - `PeritoEscolhido` aceita `peritoId` ou `nome`, e a pergunta de um clique cria pela mesma função.
    - O importador do Raio-X (parte 7) chama a mesma função.
42. **Os limites por parâmetro** (P5.3).
    - As regras puras (`regras/cobranca.ts`, `regras/confirmacao.ts`, `regras/pericia.ts`) recebem os limites, com os números do Lucas como padrão. A tela segue igual até o Pedro passar os valores.
    - O servidor lê a `configuracao`: `cobranca.*`, os novos `confirmacao.limite` e `confirmacao.intervalo_dias`, e `pericia.remarcacao.limite`.
    - O padrão da remarcação passa de 2 a 1, como o Lucas disse (GGVP-104).
    - `ConfiguracaoDoEscritorio.parametros[]` ganha `emUso`. Os de `contato.*` ficam `false`, para a tela não precisar adivinhar.
    - O prazo externo comprime: a regra da cobrança já faz (CA12); o teste cobre os laços que têm prazo.
43. **A espera de fora** (P5.4).
    - Quais são: as etapas `aguardando_externo` do INSS (`aguardando` começa com "INSS") e as perícias com comparecimento e sem resultado.
    - Na Central da advogada, `GET /api/tarefas` monta uma linha por espera: "Olhar a espera: …", com o caso e a tela do caso.
    - A linha fica urgente (no topo) no dia útil, pelo `ehDiaUtil` com os feriados nacionais, até alguém marcar "Olhei, sem novidade" naquele dia.
    - `POST /api/casos/:id/esperas/olhada` (`tarefa.cumprir`) grava um `evento_auditoria` `espera_olhada`, com a espera. Não há tabela nova.
    - Quando a espera já tem tarefa da advogada (a "Trazer a resposta do INSS"), a própria linha dela vira o lembrete, sem linha repetida.
44. **A data do juiz na hora** (P5.5).
    - `abrirPericiasDaExigencia`, na origem do juiz, recebe o texto da publicação.
    - Para cada tipo, `dataDoJuizoNaPublicacao` grava `agendada_para` e `local` na linha da perícia.
    - Com todas as perícias marcadas assim, a tarefa de marcar não nasce.
    - Na primeira leitura, o documento das telas nasce com a mesma data (`criarPericia` com `dataDoJuizo`, como hoje), e a orientação já sai "pelo sistema".
    - O resumo do processo (`GET /api/casos/:id/processo`) ganha `pericia.marcadaPeloSistema`: verdadeiro com a origem do juiz e a data lida.
45. **O item sem documento** (P5.6).
    - `EncerrarSemProva` ganha `semSaida` (texto), o porquê de não caber dilação nem reagendamento.
    - A rota `/manifestacao/sem-prova` aceita quando existe:
      - a dilação autorizada nesta exigência (a decisão `D3a.04` `dilacao`, a de `dilacaoAutorizada`);
      - ou, na perícia, a remarcação registrada depois da exigência;
      - ou o `semSaida` preenchido.
    - O porquê vai ao histórico, junto com o motivo.
46. **Encerrar e liberar** (P5.7).
    - `/encerrar` pede a tarefa `D3.03` aberta: o despacho esperando, a mesma regra do `podeEncerrar` da tela.
    - `okDaSenior` não vale com a tarefa `D2.01` aberta, que é a nova liberação.
    - A nova liberação cancela as `D2.02` e `D2.03` abertas, que o OK anterior tinha aberto.
47. **Tribunal e assinatura** (P5.8, P5.9).
    - Chaves `tribunais` e `peticao.assinatura` da `configuracao`, como a semente já usa.
    - `PUT /api/configuracao/tribunais` e `PUT /api/configuracao/assinatura`, com `configuracao.editar`. A mudança vai ao histórico da configuração, e `GET /api/configuracao` devolve os dois.
    - O tamanho do tribunal é um inteiro de 1 a 100, pela `campos`. O site é `https`.
    - A migração 0032 põe:
      - a "Justiça Federal da 3ª Região", `https://www.trf3.jus.br/`, 3 MB;
      - "Dr. Glauco · OAB/UF [completar]".

      Fica `ON CONFLICT DO NOTHING`: a homologação preparada guarda o que tem.
    - 3 MB é o menor limite que o TRF3 publicou: o PJe pede 3 MB por PDF, e os JEFs, 10 MB. A Sênior ajusta.
    - A OAB do Dr. Glauco espera o Lucas.
    - A trava do pacote falha sem tribunal e com a assinatura que tem "[completar". É a mesma regra do texto, `faltaCompletar` de `packages/contratos/src/ia.ts`.
    - O PDF deixa de usar a assinatura "a configurar".
48. **O alarme da vigília** (P5.10; ADR-018).
    - A rodada `rodando` com `inicio` mais velho que o tempo limite e mais 5 minutos vira `falhou`: "a rodada parou no meio (o servidor reiniciou ou travou)". Isso roda na batida, junto do "não rodou".
    - Na produção sem fonte, a `batida` registra o alarme do dia, uma vez por dia, e a Central da Sênior ganha a linha "Vigília sem fonte ligada".
    - Toda passagem para `falhou` ou `nao_rodou`, e o "sem fonte", chamam `avisarSuporte`, um módulo novo:
      - `ALARME_CANAL_URL`: POST `{ "text": … }`, que serve ao Google Chat e ao Slack;
      - `ALARME_JIRA_URL`, `ALARME_JIRA_EMAIL`, `ALARME_JIRA_TOKEN` e `ALARME_JIRA_PROJETO`: o chamado pela API REST do Jira, do tipo "Tarefa", com autenticação básica de um usuário de serviço.
    - O texto leva a fonte, o horário, a situação e o motivo, cortado em 300 caracteres. Não leva publicação nem cliente.
    - A falha do canal ou do Jira não derruba a rodada: vai ao log e ao `evento_auditoria` (`alarme_suporte`, com o resultado de cada um).
    - O monitor do /saude da parte 9 usa o mesmo `avisarSuporte`.
49. **Feriados** (P5.11).
    - `POST /api/configuracao/feriados/carga` aceita `{ ano }` (inteiro de 2020 a 2100). Sem ano, carrega os de `ANOS_DE_FERIADOS`, como hoje.
    - A Central da Sênior ganha "Carregar os feriados de <ano>" quando o ano corrente (ou o seguinte, em dezembro) não tem feriado nenhum na tabela.
    - O prazo sem os feriados do ano adianta, que é o lado seguro, por isso o aviso basta.
50. **Jurimetria no texto** (P5.12).
    - Uma regra pura em `packages/contratos`, `numeroDeJurimetriaNoTexto(texto)`, acha o formato do G22:
      - porcentagem seguida de casos, laudos ou processos ("71% em 34 laudos", "71% · 24 de 34 laudos");
      - "base de dd/mm";
      - "chance" junto de porcentagem;
      - "tempo médio" junto de dias.

      Fica em tempo linear, sem regex com repetição aninhada.
    - Vale na aprovação da versão da petição, da manifestação e da dilação. Recusa com 409 e registra o portão G22.
    - Ela não pega toda porcentagem: o texto jurídico cita percentuais de lei.
    - ponytail: casa o formato que o portal mostra. Número de jurimetria escrito de outro jeito passa; a revisão da advogada segue.
51. **Jurimetria só para quem tem `estudo.ver`** (P5.13).
    - No painel de resultados, os recortes `perito`, `vara`, `juizo` e `advogada` pedem `estudo.ver`: 403 "Esse recorte é só do Jurídico e dos sócios." O resto do painel segue para `resultados.ver`.
    - Na perícia, a `visao` tira os números e o resumo do perfil do perito de quem não tem `estudo.ver`.
    - Sem matriz nova.
52. **O juízo com o juiz e o perito** (P5.14).
    - `JurimetriaDoJuizo` ganha:
      - `juiz: { nome, casos }`, a contagem dos casos com o mesmo `caso.juiz` normalizado;
      - `perito: { id, nome, casos }`, os casos distintos com perícia desse perito.

      As contas ficam no código, com teste.
    - O resumo do processo ganha `vara`, `juiz` e o nome do perito, que já vem, sem número.
53. **O protocolo do recurso** (P5.15).
    - `POST /api/casos/:id/recurso/protocolo` (`recurso.decidir`, da Sênior), em multipart:
      - o comprovante, em PDF ou imagem até 25 MB;
      - `protocoladoEm`, que não pode ser depois de hoje.
    - Ele grava o documento `comprovante_recurso` do caso, fecha a `D3b.04r` e registra `recurso_protocolado`.
    - Sem a tarefa aberta: 409 "Este caso não tem recurso esperando o protocolo."

## Campos de formulário

Partes 1 a 4: nenhum.

Parte 5, só nos contratos do servidor (as telas são do Pedro):

| Campo | Função da `campos` |
|---|---|
| O nome do perito (classificação e pergunta de um clique) | `validarNome` e `normalizarNome` |
| O tamanho do tribunal | `validarInteiro` e `normalizarInteiro` |
| O ano da carga dos feriados | `validarInteiro` e `normalizarInteiro` |
| A data do protocolo do recurso | `validarData` |

## Risks / Trade-offs

- **CSP:** um recurso de fora que a tela use quebraria.
  - Os testes ponta a ponta não pegam isso, porque a tela deles vem do Vite, sem a CSP.
  - Por isso, a tarefa dos cabeçalhos abre a tela montada (`dist`) servida pela API e confere o console.
- **Matriz 29:** outro pedido com matriz nova conflita na impressão digital, e quem entrar depois renumera.
- **drizzle-orm:** a versão nova pode mudar tipos. A suíte inteira roda antes do "Agora ok?".
- **"Falhou" sem Chatwoot:** a homologação passa a mostrar as mensagens como não enviadas até o Chatwoot ser ligado, o que é o comportamento pedido.
- **Caixa do escritório na homologação:** as conversas de teste aparecem para os atendentes. A trava dos telefones impede que um cliente receba.
- **Sinônimos do ZapSign:** um nome novo no ZapSign volta a ser recusado. Por isso, a conferência fica antes de cada subida, e o recusado vai para o cartão.
- **Parte 3 sem as telas:** até o Pedro ligar, as telas seguem no caminho de hoje. O cálculo de lead do servidor continua avisando que não salva, e a Configuração continua sem o campo do percentual. O servidor fica pronto e testado antes.
- **Cálculo do CNIS:** é só tempo comum do RGPS. Atividade especial, rural, período em benefício e pedágio ficam fora, como diz o documento do cálculo. A regra fica com o advogado, que vê o CNIS inteiro.
- **Parte 4 sem as telas:** a leitura da ficha em papel e a do contrato passam a pedir o arquivo, e a tela de hoje não manda.
  - Até o Pedro ligar, essas leituras recusam na homologação.
  - Os testes de tela seguem pela leitura de exemplo.
- **Autorização do dado de saúde:** sem `IA_PERMITE_DADO_DE_SAUDE=sim`, o documento médico e a segunda ficha não são lidos.
- **Custo da IA:** uma chamada por documento, com o arquivo. A sugestão pronta evita repetir a chamada para o mesmo arquivo.
- **Scanner pelo Drive:**
  - até um minuto de atraso;
  - o arquivo que alguém tira de "A REVISAR" e põe na pasta do cliente também entra, porque é uma mudança de pasta;
  - a pasta cujo título serve a duas fichas fica sem ligar, até alguém ligar pela ficha.
- **A senha no papel:** a imagem com a senha fica guardada (o Lucas disse que não precisa cobrir) e passa pelo modelo. O valor só fica no cofre.
- **Parte 5 sem as telas:** a orientação e o lembrete pelo Chatwoot passam a pedir a mensagem enviada. A tela de hoje registra sem o id, então o registro recusa até o Pedro mandar o `mensagemId`. Recusar é o pedido: o portal não diz mais que mandou o que não mandou.
- **A assinatura a completar:** num banco novo, a petição não protocola até a Sênior pôr a OAB do Dr. Glauco, que espera o Lucas. É o lado seguro: nenhuma peça sai com assinatura errada.
- **O limite do tribunal:** 3 MB pode barrar o arquivo que o JEF aceitaria (10 MB). A mensagem diz o limite, e a Sênior muda na Configuração.
- **Jurimetria no texto:** a regra casa o formato que o portal mostra. Um número escrito de outro jeito passa, e a revisão da advogada segue valendo.
- **Alarme no Jira:** o tipo "Tarefa" e o projeto vêm do Jira do escritório. Se o Jira recusar, o canal e o portal ainda avisam, e a recusa fica no log.
- **A espera de fora:** a perícia sem resultado chama todo dia útil até o resultado ser registrado. Quem não marca "Olhei" fica com a linha no topo o dia todo, que é o lembrete pedido.
