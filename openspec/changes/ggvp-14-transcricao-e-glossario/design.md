# Design · GGVP-14 Transcrição e glossário

## GGVP-143 · Glossário do escritório

### Context

A Configuração do escritório (GGVP-104) já tem limites, kits e mensagens numa tela só, com o histórico da configuração no fim (eventos com alvo `configuracao`). O portal já conhece peritos (`perito`) e juízos (`juizo`) pelas tabelas da jurimetria. O catálogo de benefícios é `ROTULO_BENEFICIO`, em `packages/contratos`.

### Decisões

- **Tela:** o Figma não tem tela do glossário de termos (o "Glossário" de lá é o dos códigos do BPMN e dos portões). A seção "Glossário do escritório" segue o padrão das outras seções da Configuração: lista por tipo, formulário para acrescentar, "Corrigir" e "Tirar" em cada termo.
- **Quem:** ver com `gestao.ver`, como a página. Mudar só com `glossario.editar`, só a Sênior (matriz versão 17).
- **Histórico:** cada mudança grava, na mesma transação, um evento com alvo `configuracao` (`glossario_termo_acrescentado`, `glossario_termo_corrigido`, `glossario_termo_tirado`), com o antes e o depois. Aparece no "Histórico da configuração", descrito em `descrever` de `rotas/configuracao.ts`.
- **Tirar:** apaga a linha; o termo fica no histórico (antes). Termo repetido (sem diferença de maiúscula) é recusado pelo banco (índice único em `lower(termo)`) e pela rota (409).
- **Semente (CA3):** dentro da migração que cria a tabela, uma vez só: os rótulos de `ROTULO_BENEFICIO` (menos "Outro"), as oito siglas com o significado e os nomes de `perito` e `juizo`. Depois disso, termo novo é com a Sênior. O teste confere que os benefícios da semente são os do catálogo.
- **Leitura (CA2):** `termosDoGlossario(banco)`, em `apps/api/src/fluxo/glossario.ts`, devolve `{ termo, tipo, significado }`. A transcrição (GGVP-133) e o motor de IA usam esta função.

### Contratos (`packages/contratos/src/glossario.ts`)

- `TIPOS_DE_TERMO`: `beneficio`, `sigla`, `perito`, `juizo`, `outro`; `ROTULO_TIPO_DE_TERMO`.
- `TermoDoGlossario`: `{ id, termo, tipo, significado | null }`.
- `SalvarTermo` (POST e PUT): `termo`, `tipo`, `significado` opcional.
- `GlossarioDoEscritorio` (GET): `{ termos, podeEditar }`.

### Campos do formulário

| Campo | Função de `campos` | Regra no contrato |
|---|---|---|
| Termo | `normalizarNome` (tira espaço duplo e das pontas) | texto livre de 2 a 120 caracteres: sigla, nome de vara com número ("2ª Vara") e benefício com barra não cabem em `validarNome` |
| Tipo | nenhuma: lista fechada | `z.enum(TIPOS_DE_TERMO)` |
| Significado | `normalizarNome` | opcional, até 300 caracteres |

### Endpoints

| Método e caminho | Permissão | Entrada | Saída |
|---|---|---|---|
| GET `/api/configuracao/glossario` | `gestao.ver` | nada | `GlossarioDoEscritorio` |
| POST `/api/configuracao/glossario` | `glossario.editar` | `SalvarTermo` | 201 `{ ok, id }`; 409 termo repetido |
| PUT `/api/configuracao/glossario/:id` | `glossario.editar` | `SalvarTermo` | 201 `{ ok }`; 404; 409 |
| DELETE `/api/configuracao/glossario/:id` | `glossario.editar` | nada | 200 `{ ok }`; 404 |

### Banco

Tabela `glossario_termo`: `id`, `termo`, `tipo` (lista fechada), `significado`, `alterado_por`, `criado_em`, `atualizado_em`; RLS ligado; índice único em `lower(termo)`. A migração e a versão da matriz são geradas de novo no fim do grupo, sobre a main mais nova (quem entra depois renumera).

## GGVP-133 · Transcrição de áudio de verdade (parte 2: a entrevista)

### Decisões

- **Motor (só acréscimo em `apps/api/src/ia/ia.ts`):** `transcrever` chama `POST /v1/audio/transcriptions` com `OPENAI_MODELO_TRANSCRICAO` (padrão `gpt-4o-transcribe-diarize`, `response_format: diarized_json`, `chunking_strategy: auto`). Registra em `chamada_ia` (finalidade `transcrever_audio`) só o tamanho e o hash do áudio, mais `audio_segundos` e `custo_estimado` (colunas novas; US$ 0,006 por minuto, 0,003 no `mini`). `chaveAoVivo` pede a chave temporária em `POST /v1/realtime/client_secrets` com `OPENAI_MODELO_AO_VIVO` (padrão `gpt-4o-transcribe`) e os termos do glossário como dica. A finalidade `arrumar_transcricao` (versão 1, dado de saúde, JSON) corrige a escrita com o glossário e diz quem é cada falante.
- **Fluxo (`apps/api/src/fluxo/transcricao.ts`):** cada parte guardada vai ao motor; o falante de cada parte é próprio dela ("1A" não é "2A"); as partes se juntam com o tempo corrido; `tirarSenhas` roda antes de mandar ao motor arrumar e antes de gravar (G9); sem a arrumação, o primeiro a falar é o escritório, o segundo o cliente e os outros são terceiros; o original fica em `trecho.original`; o texto final e o original vão para a pasta do cliente como documento (`transcricao`).
- **Rotas que já existem (`rotas/recepcao-entrevista.ts`, só acréscimo e duas linhas):** `POST /api/gravacoes/:id/audio` e `POST /api/entrevistas/:id/audio` aceitam também o arquivo (multipart): o áudio vira `documento` (`audio_gravacao`) na pasta `pessoas/<id>/` do armazenamento que já existe. `POST /api/gravacoes/:id/transcricao` usa o motor quando há áudio guardado; sem áudio guardado (gravação sem microfone), segue a conversa de exemplo. O encerramento e o "sem áudio" não trocam mais o áudio de verdade pelo simulado. O preparo de 5 minutos transcreve o que espera.
- **Texto ao vivo:** `POST /api/gravacoes/:id/chave-ao-vivo` (`entrevista.gravar`, só com a gravação em curso) devolve `ChaveAoVivo`. O navegador grava em partes de 10 minutos (MediaRecorder, cada parte um arquivo inteiro) e abre o texto ao vivo por WebRTC (`/v1/realtime/calls`) com a chave temporária. Pausar (cofre, G9) desliga o som do gravador e do texto ao vivo.
- **Ligação do Chatwoot (CA2):** a caixa "Áudio gravado fora do portal" da entrevista manda o arquivo de verdade. O portal não busca nada no Chatwoot.

### Contratos (`packages/contratos/src/transcricao.ts`)

- `TranscricaoArrumadaPelaIa`: `{ falantes: { [rótulo]: 'escritorio' | 'cliente' | 'terceiro' }, falas: [{ i, texto }] }`.
- `ChaveAoVivo`: `{ chave, expiraEm, modelo }`.

### Limites conhecidos

- Arquivo de fora até 25 MB (o limite do envio e da OpenAI); dividir um arquivo maior pede uma ferramenta de áudio no servidor, que o portal não tem.
- A amostra de voz da pessoa do escritório (CA3, nome certo pela voz) não tem onde ser gravada ainda; sem ela, o nome vem dos participantes, pelo papel que a IA marca.
- O texto ao vivo e a transcrição foram testados só com serviço falso; o teste de verdade, com dado inventado, fica com o Mateus.

## GGVP-133 · Transcrição de áudio de verdade (parte 3: a conversa do Relacionamento)

- **Rota que já existe (`rotas/conversa.ts`, só acréscimo e uma linha):** `POST /api/conversas/:id/audio` aceita também o arquivo (multipart). Na conversa por arquivo, é a gravação da ligação, com `avisoNaGravacao=sim` (G10); na conversa gravada agora, é uma parte do microfone, com `inicio`. O áudio vira documento na pasta do cliente. `guardarNoCard` não troca mais o áudio de verdade pelo simulado.
- **Transcrição:** com o áudio guardado e o motor ligado, o mesmo fluxo da entrevista, com quem conduziu no papel do escritório (Atendimento ou advogada). Sem a chave do serviço, segue o que o Relacionamento já tinha: a conversa de exemplo, ou a falha com `RELACIONAMENTO_SIMULADO=nao`. A análise do que mudou é da GGVP-140 (abaixo).
- **Texto ao vivo:** `POST /api/conversas/:id/chave-ao-vivo` (`conversa.registrar`), só na conversa presencial gravada agora; na ligação, não (CA4).
- **Tela:** o microfone e o texto ao vivo saem da entrevista para um gancho comum (`dados/gravacaoDeVerdade.ts`), usado pelas duas telas.

## GGVP-140 · IA de verdade no Relacionamento: resumo da conversa e o que mudou na ficha

### Decisões

- **A IA diz o que foi dito; o código decide o que mudou (CA2).** A finalidade `analisar_conversa` do motor (versão 1, com dado de saúde, JSON) lê a transcrição pronta e devolve o resumo, cada coisa dita (o campo, o valor como foi dito e o número da fala) e o combinado. A rota passa cada dito pelo código: o campo vai à ficha ou ao processo pelo nome, o valor é conferido pela biblioteca de campos (`erroDoValor`) e guardado no formato da ficha (`valorGuardado`), a hora e o trecho são os da transcrição, nunca os da IA. Depois, o mesmo `oQueMudou` do Relacionamento compara com a ficha e com os campos do processo: o igual ao guardado fica de fora. Nada vai para a ficha antes da conferência de quem conversou (G14).
- **Um caminho só para a análise.** O miolo do `analisar` simulado virou `montarAnalise`, usado pelo exemplo e pela IA de verdade: a senha, a linha nos "Últimos contatos", a observação e o "O que precisa atualizar" saem do mesmo lugar.
- **Senha (CA3, G9).** A IA recebe a transcrição já sem a senha. O que ela devolve com senha não passa: o dito é descartado, o combinado também, e o resumo vira um aviso.
- **Instrução na fala (CA4).** A transcrição entra como dado dentro do `<conteudo>`; o alerta do motor vem na análise (`daIa.alerta`) e a tela mostra "Atenção" antes do resumo.
- **IA fora, recusada ou fora do formato (CA5).** A transcrição fica pronta; a análise abre sem itens e a observação começa por "A IA não respondeu agora: leia a transcrição e confira o que mudou.", no padrão das outras telas do motor. Sem `IA_PERMITE_DADO_DE_SAUDE=sim`, o motor recusa a leitura, como em toda finalidade com dado de saúde.
- **Quem vê.** Quem fez a conversa vê a transcrição e o resumo. A conversa da advogada fica só com o Jurídico (`soJuridico`), como no desenho do Relacionamento: para quem não vê dado de saúde, a rota devolve a conversa sem o texto, o resumo e a análise. O resumo da IA fica na análise da conversa, como sugestão; a linha dos "Últimos contatos" continua a do código.

### Contratos

- `AnaliseDaConversaPelaIa` (`packages/contratos/src/transcricao.ts`): `{ resumo, ditos: [{ campo: CampoDaConversa, valor, i, saude? }], combinado | null }`, para validar a saída do motor.
- `AnaliseDaConversa.daIa?` (`packages/contratos/src/conversas.ts`): `{ resumo, chamadaId, modelo, alerta }`, quando a IA de verdade leu.

### Limites conhecidos

- Sem a chave do serviço, a conversa segue a transcrição e a análise de exemplo do Relacionamento; o Playwright roda assim e cobre o caminho manual. A leitura da IA de verdade é testada na API com `fetch` falso e na tela com a resposta do servidor posta por cima.
- A análise roda uma vez, junto da transcrição. Se a IA falhou, a pessoa segue pela leitura; não há "Tentar de novo" só da análise.

