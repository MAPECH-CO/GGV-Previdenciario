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

Só servidor, com teste junto, num pedido em cima do #74. Várias rotas aqui são as que as telas da GGVP-159 parte 4 esperam ("espera a rota do Mateus"). Não há migração nem matriz nova: o tribunal e a assinatura padrão entram ao subir, como os feriados, e a jurimetria usa `estudo.ver`, que já é do Jurídico e dos sócios.

Decisões do Mateus em 13/10: o alarme da vigília vai ao canal da equipe e abre chamado no Jira (a proposta dele de 02/10); o laço do cliente sumido fica fora da parte 5, porque não existe no código e falta dizer quando o cliente conta como sumido; plano aprovado, código em seguida.

40. **A orientação confere a mensagem** (P5.1).
    - A tela já envia antes, pelo correio do cliente (`POST /api/fichas/:id/mensagens`), e registra depois.
    - `OrientacaoAoCliente` e `MensagemConferida` ganham `mensagemId`, opcional. A rota acha a linha de `mensagem` da pessoa do caso, do modelo e com o mesmo texto: com o id, aquela; sem ele, a mais nova que saiu. A tela de hoje já envia antes e não precisa mudar.
    - O status `falhou` não serve: 409 "… não saiu pelo Chatwoot". Sem mensagem nenhuma: 409 "Envie … pelo Chatwoot antes de registrar."
    - Os modelos: `pericia-orientacao` (orientação), `pericia-presenca` (lembrete da véspera) e `cobranca` (cobrança dos documentos da perícia, que tinha o mesmo defeito e usa o mesmo contrato).
    - O id vai à preparação da perícia e ao histórico.
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
    - No servidor, sem nada salvo, a remarcação é 1, como o Lucas disse (GGVP-104), e o servidor põe o limite em cada perícia lida (`limiteDeRemarcacoes`). A regra comum segue com 2 para a tela de exemplo: os testes de tela que contam 2 são do Pedro, e o cartão pede para não mexer nos arquivos de tela dele.
    - `ConfiguracaoDoEscritorio.parametros[]` ganha `emUso`. Os de `contato.*` ficam `false`, para a tela não precisar adivinhar.
    - O prazo externo comprime: a regra da cobrança já faz (CA12); o teste cobre os laços que têm prazo.
43. **A espera de fora** (P5.4).
    - Quais são: as etapas `aguardando_externo` do INSS (`aguardando` começa com "INSS") e as perícias com comparecimento e sem resultado.
    - Na Central da advogada, `GET /api/tarefas` monta uma linha por espera: "Olhar a espera: …", com o caso e a tela do caso.
    - A linha fica urgente (no topo) no dia útil, pelo `ehDiaUtil` com os feriados nacionais, até alguém marcar "Olhei, sem novidade" naquele dia.
    - `POST /api/casos/:id/esperas/olhada` (`tarefa.cumprir`), sem corpo, grava um `evento_auditoria` `espera_olhada` para cada espera do caso. Não há tabela nova; sem espera, 409.
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
    - Ao subir com banco de verdade, `garantirPadroesDoProtocolo` (em `principal.ts`, junto da carga dos feriados) põe só o que faltar, com uma linha no histórico da Configuração:
      - a "Justiça Federal da 3ª Região", `https://www.trf3.jus.br/`, 3 MB;
      - "Dr. Glauco", "Advogado responsável · OAB/UF [completar]".

      O que a Sênior mudou nunca é refeito. Não é migração: ela entraria em todo banco de teste e trombaria com os testes que cadastram o tribunal.
    - 3 MB é o menor limite que o TRF3 publicou: o PJe pede 3 MB por PDF, e os JEFs, 10 MB. A Sênior ajusta.
    - A OAB do Dr. Glauco espera o Lucas.
    - A trava do pacote falha sem tribunal e com a assinatura que falta ou tem "[completar". É a mesma regra do texto, `faltaCompletar` de `packages/contratos/src/ia.ts`. O protocolo sem tribunal nenhum recusa com a mesma frase.
    - O PDF deixa de usar a assinatura "a configurar": sem a assinatura inteira, a peça não sai, e o pacote é gerado de novo depois (a rota que já existe).
    - ponytail: a assinatura mudada depois do pacote gerado só vale no pacote gerado de novo.
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
    - A Central da Sênior ganha "Carregar os feriados de <ano>" quando o ano corrente (ou o seguinte, em dezembro) não tem feriado nenhum na tabela, que já tem os de outro ano. A tabela vazia é a carga ao subir.
    - O prazo sem os feriados do ano adianta, que é o lado seguro, por isso o aviso basta.
50. **Jurimetria no texto** (P5.12).
    - Uma regra pura em `packages/contratos`, `numeroDeJurimetriaNoTexto(texto)`, acha o formato do G22:
      - porcentagem seguida de casos, laudos ou processos ("71% em 34 laudos", "71% · 24 de 34 laudos");
      - "base de dd/mm";
      - "chance" junto de porcentagem;
      - "tempo médio" junto de dias.

      Fica em tempo linear, sem regex com repetição aninhada.
    - Vale na aprovação da versão da petição, da manifestação e da dilação. Recusa com 409 e registra o portão G22, que entra em `PORTOES_DE_BLOQUEIO`.
    - A petição tem o texto. A manifestação e a dilação sobem como arquivo: na aprovação, `ia.lerDocumento` (a Mistral, o OCR da perícia e do parecer; sensível) lê a versão. Sem a leitura (sem a IA ou sem a autorização), aprova com `aviso`, e o histórico guarda `jurimetriaConferida: false`.
    - Ela não pega toda porcentagem: o texto jurídico cita percentuais de lei.
    - ponytail: casa o formato que o portal mostra. Número de jurimetria escrito de outro jeito passa; a revisão da advogada segue.
51. **Jurimetria só para quem tem `estudo.ver`** (P5.13).
    - No painel de resultados, os recortes `perito`, `vara`, `juizo` e `advogada` pedem `estudo.ver`: 403 "Esse recorte é só do Jurídico e dos sócios." O resto do painel segue para `resultados.ver`.
    - Na perícia, a `visao` tira os números e o resumo do perfil do perito de quem não tem `estudo.ver`.
    - Sem matriz nova.
52. **O juízo com o juiz e o perito** (P5.14).
    - `JurimetriaDoJuizo` ganha:
      - `casosDoJuiz`, a contagem dos casos com o mesmo `caso.juiz`, sem acento, caixa, pontuação nem título (o `juiz` segue o nome, como a tela já usa);
      - `perito: { id, nome, casos }`, o da perícia mais nova do caso, com os casos distintos com perícia dele.

      As contas ficam no código, com teste.
    - O resumo do processo ganha `vara`, `juiz` e o nome do perito, que já vem, sem número.
53. **O protocolo do recurso** (P5.15).
    - `POST /api/casos/:id/recurso/protocolo` (`recurso.decidir`, da Sênior), em multipart:
      - o comprovante, em PDF ou imagem até 25 MB;
      - `protocoladoEm`, que não pode ser depois de hoje.
    - Ele grava o documento `comprovante_recurso` do caso, fecha a `D3b.04r` e registra `recurso_protocolado`.
    - Sem a tarefa aberta: 409 "Este caso não tem recurso esperando o protocolo."

### Parte 6 · Desfecho, dinheiro e conversa (decisões do Mateus, 13/10)

Só servidor, com teste junto, num pedido em cima do #75. O #31 segue no pedido dele. Uma migração, a 0033 (a 0032 é a do recurso, que veio da main com o #73). Sem matriz nova: a Sênior confere pela `ficha.voltar_versao`, que já é só dela.

Decisões do Mateus em 13/10:
- a entrada e as parcelas vêm do contrato da Recepção;
- quem confere o que a IA aponta na conversa é a Sênior, como no cartão (Lucas, GGVP-84);
- a pendência de quem não tem caso vira tarefa da pessoa;
- plano aprovado, código em seguida.

O que o Lucas já tinha definido (GGVP-92, 06 e 07/10):
- a prestação segue a entrada e as parcelas escritas no contrato e abre editável;
- Pix ou boleto do escritório no nome do cliente, e uma parte na Caixa quando o escritório vai junto;
- transferência e dinheiro não são formas padrão.

O OK segue com a advogada, por decisão do Pedro.

54. **O pedido #31** (P6.1).
    - Fica no pedido dele, fora da sequência das partes. A main entra na branch por merge, sem rebase e sem force-push.
    - O `GET /api/casos/:id/desfecho` devolve o texto da decisão só com `dado_saude.ver_detalhe`; sem ela, `texto: null`. É o P1 do Pedro no #31. O teste usa uma sentença inventada que cita um laudo.
    - Sai do rascunho para o Pedro revisar e mesclar.
55. **O combinado no contrato** (P6.2).
    - `AcordoDoContrato`, em `packages/contratos`:
      - `entrada`, decimal de 0 em diante;
      - `parcelas`: `quantidade`, inteiro de 1 a 60, e `valor`, decimal maior que 0, ou nulas.
    - `EnvioDoContrato` ganha `acordo`, opcional. Ele vai para `contrato.acordo`, dentro do contrato da Recepção (`contrato_recepcao.dados`): sem migração.
    - O histórico da ficha ganha "Registrou no contrato: entrada de R$ … e N parcelas de R$ …".
    - ponytail: parcelas iguais. Lista com valores diferentes, se o escritório pedir.
56. **A prestação de contas** (P6.3).
    - A regra pura `calcularPrestacao` ganha os honorários ajustados:
      - sem eles, vale o percentual, arredondado para baixo;
      - com eles, vale o valor de quem conferiu, até o valor recebido.

      O repasse é sempre o recebido menos os honorários, em centavos.
    - `SalvarPrestacao` ganha `honorarios`, `entrada`, `parcelas` e `parteNaCaixa`, opcionais, pela `campos`. A parte na Caixa vai até os honorários.
    - `FORMAS_DE_PAGAMENTO` fica `pix` e `boleto` ("Boleto do escritório, no nome do cliente"). O rótulo das antigas fica, para ler as versões velhas.
    - A migração 0033 dá à `prestacao_contas`: `entrada`, `parcelas_quantidade`, `parcela_valor`, `parte_na_caixa` e `fontes` (jsonb).
    - As fontes são do servidor:
      - o percentual é do contrato, quando o contrato tem;
      - os honorários são do sistema quando batem com o cálculo, e de quem conferiu quando não;
      - a entrada e as parcelas são do contrato quando batem com ele;
      - o valor recebido é da carta, que a advogada confere;
      - o repasse é do sistema.
    - O histórico da versão guarda o calculado e o ajustado (CA11).
    - O `GET` traz `acordo`, o do contrato (nulo sem ele), e cada versão com os valores novos e as fontes. Os campos novos entram nulos por padrão: o teste de tela do Pedro monta a prestação à mão.
57. **A ida ao banco** (P6.4).
    - `CANAIS_DE_AVISO` fica `telefone` e `whatsapp`.
    - `telefone` é a ligação: o registro de hoje, com o acervo e a baixa.
    - `whatsapp` pede a ligação registrada (`cliente_avisado_em`) e sai pelo correio do cliente, com o texto aprovado, que não muda. O que não saiu volta 409, com o motivo, e a tentativa fica no histórico do cliente, fora dos avisos.
    - O correio ganha `enviarAprovado`: o texto sai pela mesma saída do Chatwoot do envio (`sair`), pela conversa aberta do cliente, e a linha de `mensagem` guarda o `modeloId` do modelo aprovado.
    - O modelo não entra em `MODELOS_DE_MENSAGEM` (mudança da execução, 13/10): o seletor da tela do correio e o correio de mentira dos testes de tela listam o catálogo inteiro, e os dois são do Pedro.
    - Ao subir com banco de verdade, `garantirModeloDaIdaAoBanco` (em `principal.ts`, junto dos feriados) põe o modelo só quando não há nenhum com esse nome. O texto é o da semente, sem "(modelo de exemplo)".
58. **O id do Chatwoot** (P6.5).
    - `chatwoot.enviar` devolve o id da mensagem, e o correio grava em `mensagem.chatwoot_mensagem_id` (migração 0033, com índice).
    - O status só anda para a frente: enviada, entregue, lida. "Falhou" vale a qualquer hora.
    - O aviso de mudança do Chatwoot (`message_updated`) não traz o status: o corpo é o `webhook_data` da mensagem, conferido no código do Chatwoot em 13/10. O portal pergunta o status (`statusDaMensagem`, na última página da conversa), só das mensagens que ele mandou.
59. **A rota de entrada do Chatwoot** (P6.5; ADR-019).
    - `POST /api/chatwoot/entrada/:segredo`, com `config.semTrava` (a trava é o segredo) e `logLevel: 'silent'`, para o endereço não ir ao log.
    - O segredo é conferido em tempo constante (`timingSafeEqual` sobre o SHA-256). Sem `CHATWOOT_WEBHOOK_SEGREDO`, ou com outro segredo: 404.
    - O corpo passa por um esquema Zod com só o que o portal usa.
    - São ignoradas:
      - a conta e a caixa diferentes de `CHATWOOT_CONTA` e `CHATWOOT_CAIXA`;
      - a nota privada e a mensagem de atividade;
      - fora da produção, o telefone fora de `CHATWOOT_PERMITIDOS`, a mesma trava do envio.
    - O ignorado responde 200, para o Chatwoot não repetir.
    - A trava de sessão de toda rota `/api` libera só esta, além de entrar (`LIVRES`, em `sessao/rotas.ts`).
    - O telefone vem da conversa (`conversation.meta.sender.phone_number`), na mensagem que chega e na resposta do escritório. O celular sem o nono dígito volta com ele, para a lista de teste e a ficha.
    - ponytail: o anexo sem texto entra como "[anexo: veja no Chatwoot]". O áudio transcrito, pelo mesmo motor da conversa, fica para depois.
60. **A conversa do WhatsApp** (P6.5).
    - Uma por pessoa: canal `whatsapp` (o `atendimento` já aceita), modo `escrito`, papel `atendimento`, conduzida por "WhatsApp (Chatwoot)", sem `quemId`.
    - Cada mensagem vira um trecho da gravação: do cliente (a que chega) ou do escritório (a resposta pelo Chatwoot).
    - A pessoa é a do telefone, com e sem o nono dígito, como no envio. Com mais de uma: a do nome do contato; depois, o cliente antes do lead; depois, a mais nova.
    - Sem ninguém, nasce o lead: `pessoa` e ficha com o nome do contato, quando passa no `validarNome`, ou "Contato do WhatsApp". O histórico diz "Criou a ficha pelo WhatsApp (lead)".
    - O caso é o mais recente da ficha, como na conversa aberta no card.
    - A conversa junta as mensagens até 30 minutos sem mensagem nova. Depois, a seguinte abre outra.
    - No contrato, `Conversa.canal` passa a `CanalDaConversa` (com o WhatsApp); `NovaConversa` segue com ligação e presencial: quem abre a do WhatsApp é o servidor.
    - Nas regras das telas, `CanalDoRegistro` ganha `whatsapp`, com o rótulo em `CANAIS_DO_REGISTRO`, mas não enumerável: o formulário de registro do Pedro lista as chaves e segue só com ligação e presencial.
    - A resposta do escritório a um número sem ficha não cria lead. A senha mandada por mensagem sai do texto (G9).
    - ponytail: uma mensagem de cada vez no servidor inteiro, para duas que chegam juntas não abrirem duas conversas; por pessoa, se o volume pedir.
61. **A conversa do WhatsApp fecha e a IA lê** (P6.5, P6.6).
    - Com a IA, a rodada do preparo (a cada 5 minutos) fecha a conversa parada há 30 minutos, e a IA analisa, como na transcrição.
    - Sem a IA, a mensagem seguinte fecha a anterior, com o aviso de que a IA não leu.
    - Ao fechar, nasce a tarefa do Atendimento: responder a pendência da conversa (decisão 63).
62. **Só o que foi dito** (P6.6).
    - A regra pura `apareceNaFala(campo, valor, fala)` fica nas regras da conversa, que o servidor já usa:
      - o texto: sem acento, sem caixa e com os espaços juntos, contido na fala;
      - o telefone, o CPF, o CEP e o NB: os números do valor, em sequência, nos números da fala;
      - a data: dd/mm/aaaa, d/m/aa ou "d de <mês> de aaaa".
    - O fato novo e o documento citado ficam fora da regra: o valor deles é o resumo da fala, que vai junto.
    - `lerComIa` tira o que não aparece antes de montar a análise. A regra roda em tempo linear.
63. **A Sênior confere** (P6.6).
    - A primeira conferência continua com quem conduziu: responde "Surgiu pendência?". Na conversa do WhatsApp, qualquer pessoa do Atendimento.
    - Decisão sobre o que a IA apontou só com `ficha.voltar_versao`, que é só da Sênior. Sem ela: 403 "Quem confirma, corrige ou desfaz o que a IA apontou é a Sênior."
    - Com item apontado, a primeira conferência abre a tarefa da Sênior, "Conferir o que a IA apontou na conversa" (`D5.04`). Ela fecha quando nenhum item espera.
    - A Sênior que conduziu responde a pendência e decide de uma vez.
    - A tela de hoje manda as decisões na primeira conferência e passa a receber 403 fora da Sênior: o Playwright da conversa muda, e o Pedro é avisado.
64. **A pendência vira tarefa** (P6.7).
    - A migração 0033 deixa `tarefa.caso_id` sem obrigação, cria `tarefa.pessoa_id` e o CHECK "caso ou pessoa", e `tarefa.atendimento_id`, a conversa da tarefa da conversa.
    - Na conferência, a pendência cria a linha `D5.05`: a pessoa, o caso quando há, a conversa, o responsável, o prazo e o perfil dele.
    - "Cumprida" fecha a linha, e o prazo novo muda a linha. As duas acham a linha pela conversa.
    - As pendências abertas que já existem ganham a linha na própria migração.
    - `/api/conversas/tarefas` lê as linhas `D5.04` e `D5.05`. O "Registrar conversa" (`D5.01`) lê só as conversas de quem está no login, pelo `quemId`, no SQL. A resposta para a tela não muda.
    - `/api/tarefas` não repete as linhas `D5`: elas seguem na Central pelo caminho da conversa.
    - O tipo da tarefa passa a ter `casoId` nulo. Os usos são conferidos pelo typecheck.
65. **A verificação fica na conversa** (P6.8).
    - `POST /api/conversas/:id/verificacao` (`conversa.registrar`, de quem conduziu ou da Sênior), com `{ como }`.
    - Na ligação e no WhatsApp, só `video`: 400 "Na ligação e no WhatsApp, o cliente se verifica por chamada de vídeo."
    - Grava `verificacao: { como, por, em }` na conversa, e o histórico da ficha ganha a linha. A conversa devolve a verificação.
    - Na conferência, vale a da conversa presencial, a registrada ou a que vem no pedido, com a mesma regra do canal. O `contratoNovo` continua vindo de quem confere.
    - A recusa já fica no histórico (portão `verificacao`).
66. **ADR-019 e a variável** (P6.5).
    - O ADR registra a entrada do Chatwoot pelo webhook com segredo.
    - `CHATWOOT_WEBHOOK_SEGREDO` entra na lista das variáveis e na doc da homologação. O `.env.example` é do Mateus.

### Parte 7 · Telas lidas do banco, acervo e importação (decisões do Mateus, 13/10)

Só servidor, com teste junto, num pedido em cima do #78 (parte 6). Uma migração, a 0034. Sem matriz nova.

Decisões do Mateus em 13/10:
- a estratégia do caso: a IA propõe, e o Jurídico confere;
- o importador do Raio-X entra pelo formato de hoje e muda quando o Pedro entregar o formato do Raio-X;
- plano aprovado, código em seguida.

O que já está feito e não entra: o juízo, a vara e o juiz no resumo do processo para todos (P5.14); o laudo novo e a pergunta do perito, que a tela do Pedro já lê das rotas do parecer e da perícia; "Liberar ao Jurídico" (D1.24), que já é linha do servidor.

67. **A estratégia do caso** (P7.1).
    - Finalidade nova da IA, `estrategia_do_caso`, com dado de saúde. O conteúdo é montado no código: o benefício e a etapa; o parecer registrado (a situação, os itens, o que abordar); o despacho da Sênior; o motivo do indeferimento; o resultado da perícia; a publicação de mérito.
    - As fontes vêm da busca do acervo (o mesmo benefício). A saída é `{ estrategia }`, até 1.500 caracteres, conferida no código.
    - Fica em `decisao` (tipo `estrategia`, resultado `registrada`, o texto em `justificativa` e a chamada da IA em `sugestao_ia`): cada versão é uma linha, e a atual é a mais nova. Sem migração.
    - `GET /api/casos/:id/estrategia` (`estudo.ver`): a atual, as versões e a proposta pronta.
    - `POST /api/casos/:id/estrategia` (`peticao.pedir`, a advogada e a Sênior): `{ texto, chamadaIaId? }`; a versão vai ao histórico.
    - `POST /api/casos/:id/estrategia/sugestao`: pede outra proposta (`refazer`).
    - O preparo deixa a proposta pronta nos casos com parecer registrado ou despacho e sem estratégia (GGVP-106).
    - O resumo do processo ganha `estrategia`, o texto da atual, só com `estudo.ver`. Opcional no contrato.
68. **As tarefas da Recepção viram linhas** (P7.2).
    - Um módulo só, `fluxo/tarefas-da-recepcao.ts`: `sincronizarRecepcao(banco, agora, { casoId?, pessoaId? })` calcula o que deve estar aberto pelas mesmas regras puras das telas (a cobrança, o checklist, as boas-vindas que não saíram e o fechamento) e acerta as linhas: abre a que falta, fecha a que não vale mais e atualiza o prazo.
    - A chave de cada linha é o passo, o título e o caso (ou a pessoa, sem caso): uma aberta por chave. O banco segura, com um índice único parcial na 0034, e a sincronização abre com "on conflict do nothing".
    - É chamado quando a ficha é guardada (13/10, na implementação): toda rota da Recepção que muda a cobrança, o checklist, as boas-vindas ou o fechamento guarda a ficha no fim, e a chamada num lugar só não esquece rota. O que muda só com a data (o lembrete e o limite da cobrança, o recontato) entra na rodada de 5 minutos do processo (`app.sincronizarRecepcao`).
    - A linha guarda o detalhe que a tela mostrava (`tarefa.detalhe`, na 0034), e a Central mostra esse detalhe no lugar do benefício.
    - A Central geral (`/api/tarefas`) lê também a linha da pessoa sem caso (o cliente vem da linha ou do caso), e a tela de cada passo vem do passo.
    - O id que a Central devolve para essas linhas é a chave que a tela já usa (`cobrar-<caso>` e as outras), para a atribuição do líder (GGVP-147) seguir valendo; o contrato da linha aceita esse id. As fontes da tela (`dados/`) deixam de calcular os casos do servidor, como já fazem com o D1.24.
69. **O chat** (P7.3).
    - `criar_tarefa` só entra nas ferramentas de quem tem `tarefa.atribuir`, e a execução confere de novo.
    - `pedir_peca` confere a "Pedir a petição" (D3.05) aberta pelo despacho. Sem ela: "A petição é pedida depois do despacho da Sênior.". Com ela, não cria outra: devolve o link da petição e registra o pedido no histórico.
70. **A sugestão de benefício** (P7.4).
    - Finalidade nova, `sugerir_beneficio`, com dado de saúde. O conteúdo: o benefício de interesse e as falas da entrevista (já sem a senha). As informações conferidas ficam de fora (13/10, na implementação): mudam depois da transcrição e tirariam a sugestão do pronto, e o que elas dizem já está nas falas. As fontes: a busca do acervo (até 3, com saúde, de todos os benefícios), sem o caso mais novo da pessoa.
    - A saída é `{ sugerido, alternativa, porque }`, com os ids do catálogo, conferidos no código. O citado e os requisitos ficam no código, como hoje; o citado vem à parte, também sem a IA (G3). Sem fonte, o porquê começa com "Sem referência na casa".
    - `GET /api/entrevistas/:id/beneficio` no servidor (`ficha.analisar`): a transcrita, o citado, a sugestão, os dados dos requisitos e o aviso.
    - A sugestão da entrevista é a última que a IA deu para a gravação: o `POST` registra a mesma, sem chamar de novo. O preparo deixa a sugestão pronta nas entrevistas transcritas sem benefício definido.
    - O servidor deixa de importar o acervo de exemplo (`web/src/dados/acervo.ts`). Os requisitos usam o CNIS registrado no caso (parte 3), pela carência que o cálculo já contou (`requisitosDoBeneficio` aceita a carência pronta); sem ele, a carência fica sem resposta, e o cálculo recusa.
    - A base da sugestão são as fontes da IA ("de onde veio").
71. **O desfecho no acervo** (P7.5).
    - Uma função só, `desfechoNoAcervo(banco, casoId, { desfecho, dataDecisao })`: insere quando o caso não tem registro, com o número, o perito da perícia mais nova, o juízo e a data; quando o registro existe sem desfecho, completa.
    - Chamada no deferimento do INSS (na vigília, na mesma transação), na ida ao banco (no lugar do insert de hoje) e no estudo do caso perdido. O #31 entrou na main antes (13/10): a confirmação do desfecho de mérito dele chama a mesma aqui, na mesma transação.
    - O juízo sai do número CNJ (`juizoDoCnj`), como na jurimetria: o registro guarda o número, e `juizo_id` fica para quando o juízo tiver cadastro.
    - Sem dado pessoal: só número e ids. A ficha da IA segue anonimizada.
72. **Os valores** (P7.6).
    - A migração 0034 dá `valor_causa` ao caso e `renda_por_pessoa` à pessoa (`numeric(14,2)`).
    - `GET /api/casos/:id/valores` (`caso.ver`): o valor da causa, a renda por pessoa e os da prestação, cada um pela regra `podeVerValor` das telas; sem nenhum, 403.
    - `PUT /api/casos/:id/valor-da-causa` e `PUT /api/fichas/:id/renda-por-pessoa`: só a advogada, pela `campos`. O histórico diz que mudou, sem o valor.
    - O resumo do processo ganha `valores`, os que o perfil pode ver. Opcional no contrato.
73. **O Raio-X** (P7.7).
    - A migração 0034 dá ao `processo_acervo`: `juiz`, `falha_nossa`, `laudo_favoravel`, `extinto_por_determinacao`, `faltou_pericia` e `cartorio_cobrou` (lista). A safra é o ano do número CNJ, e o foro é o código de origem do número.
    - O formato (o do importador de hoje: CSV, títulos na primeira linha): `cnj` (obrigatório), `beneficio`, `desfecho`, `data_decisao`, `perito`, `vara`, `juiz`, `falha_nossa`, `laudo`, `extinto_por_determinacao`, `faltou_pericia`, `recurso` e `cartorio_cobrou` (itens separados por ";"). Outra coluna é ignorada e aparece no relatório; nome, CPF, telefone e endereço nunca são gravados.
    - `POST /api/acervo/raio-x/simulacao` (`acervo.conferir_desfecho`, a Sênior): o relatório, com a marca, os processos novos e os já no acervo, os peritos, os juízes e as varas distintos, a data de corte (a decisão mais nova) e as linhas recusadas.
    - `POST /api/acervo/raio-x`: a mesma planilha, a marca e a confirmação. Grava com a fonte `raio_x`; o número que já está no acervo fica como está. O perito vem pelo nome (`peritoPeloNome`, parte 5).
    - `GET /api/acervo/raio-x` (`resultados.ver`): os indicadores, calculados por uma função pura com teste (uma base inventada), cada um com o número de casos; os totais e a data da base.
    - A constante `RAIO_X` do contrato sai quando a tela do Pedro ler a rota: o teste de tela dele conta os números de hoje.
    - O tamanho e o limite de linhas são os do importador de hoje. Nada do arquivo vai ao log.

## Campos de formulário

Partes 1 a 4: nenhum.

Parte 5, só nos contratos do servidor (as telas são do Pedro):

| Campo | Função da `campos` |
|---|---|
| O nome do perito (classificação e pergunta de um clique) | `validarNome` e `normalizarNome` |
| O tamanho do tribunal | `validarInteiro` e `normalizarInteiro` |
| O ano da carga dos feriados | `validarInteiro` e `normalizarInteiro` |
| A data do protocolo do recurso | `validarData` |

Parte 6, só nos contratos do servidor:

| Campo | Função da `campos` |
|---|---|
| A entrada, o valor da parcela, os honorários ajustados e a parte na Caixa | `validarDecimal` e `normalizarDecimal` |
| A quantidade de parcelas | `validarInteiro` e `normalizarInteiro` |
| O telefone que chega pelo Chatwoot | `normalizarTelefone` e `validarTelefone` |
| O nome do contato do WhatsApp | `validarNome` e `normalizarNome` |

Parte 7, só nos contratos do servidor:

| Campo | Função da `campos` |
|---|---|
| O valor da causa e a renda por pessoa | `validarDecimal` e `normalizarDecimal` |
| O número CNJ do Raio-X | `validarCnj` e `normalizarCnj` |
| A data da decisão do Raio-X | `validarData` e `normalizarData` |
| O nome do perito do Raio-X | `validarNome` e `normalizarNome` |

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
- **Parte 5 sem as telas:** a orientação, o lembrete e a cobrança da perícia pelo Chatwoot passam a pedir a mensagem que saiu. A tela de hoje já envia antes, então segue igual; o que muda é a recusa quando o envio falhou (na homologação sem Chatwoot, sempre). Recusar é o pedido: o portal não diz mais que mandou o que não mandou.
- **A assinatura a completar:** num banco novo, a petição não protocola até a Sênior pôr a OAB do Dr. Glauco, que espera o Lucas. É o lado seguro: nenhuma peça sai com assinatura errada.
- **O limite do tribunal:** 3 MB pode barrar o arquivo que o JEF aceitaria (10 MB). A mensagem diz o limite, e a Sênior muda na Configuração.
- **Jurimetria no texto:** a regra casa o formato que o portal mostra. Um número escrito de outro jeito passa, e a revisão da advogada segue valendo.
- **Alarme no Jira:** o tipo "Tarefa" e o projeto vêm do Jira do escritório. Se o Jira recusar, o canal e o portal ainda avisam, e a recusa fica no log.
- **A espera de fora:** a perícia sem resultado chama todo dia útil até o resultado ser registrado. Quem não marca "Olhei" fica com a linha no topo o dia todo, que é o lembrete pedido.
- **Parte 6 sem as telas:**
  - a conferência da conversa por quem conduziu passa a recusar as decisões, até o Pedro mudar a tela;
  - a prestação, a ida ao banco e a verificação ganham campos que a tela ainda não manda. Sem eles, segue como hoje.
- **O segredo no endereço:** o portal não registra o endereço no log, mas o proxy da hospedagem pode registrar. Se vazar, troca-se a variável e o webhook no Chatwoot.
- **O formato do Chatwoot:** o esquema aceita só o que o portal usa. O que vier diferente é ignorado, com uma linha no log sem conteúdo.
- **Lead pelo WhatsApp:** toda mensagem de número novo cria um lead. Na homologação, só os telefones de teste.
- **Telefone dividido:** mãe e filha no mesmo número vão para a do nome do contato. Sem nome que bata, para a mais nova.
- **Honorários ajustados:** quem confere pode mudar os honorários. O histórico guarda o calculado e o ajustado, e o percentual continua travado.
- **Tarefa sem caso:** a Central geral (`/api/tarefas`) segue só com tarefas de caso, e a da pessoa aparece pela Central da conversa. A parte 7 junta as duas.
- **Parte 7 sem as telas:** a estratégia, a sugestão de benefício, os valores e o Raio-X ganham rotas que a tela ainda não lê. As tarefas da Recepção aparecem em dobro na Central do Atendimento até a tela do Pedro deixar de calcular os casos do servidor, como já faz com o D1.24.
- **O formato do Raio-X:** é o do importador de hoje, com as colunas da base. Quando o Pedro entregar o formato do Raio-X, as colunas mudam, e o resto (o relatório, a marca, a carga sem duplicar e os indicadores) fica.
- **A estratégia da IA:** é interna e só o Jurídico e os sócios leem. A IA só propõe; a versão que vale é a que a advogada ou a Sênior salvou.
- **A sugestão sem a IA:** sem a chave ou sem a autorização do dado de saúde, a entrevista fica sem sugestão, e a advogada decide pela entrevista.
- **Custo da IA:** uma chamada por caso para a estratégia e uma por entrevista para o benefício, prontas em segundo plano e guardadas pelo conteúdo.
