# Design · GGVP-14 Transcrição e glossário

## GGVP-143 · Glossário do escritório

### Context

A Configuração do escritório (GGVP-104) já tem limites, kits e mensagens numa tela só, com o histórico da configuração no fim (eventos com alvo `configuracao`). O portal já conhece peritos (`perito`) e juízos (`juizo`) pelas tabelas da jurimetria. O catálogo de benefícios é `ROTULO_BENEFICIO`, em `packages/contratos`.

### Decisões

- **Tela:** o Figma não tem tela do glossário de termos (o "Glossário" de lá é o dos códigos do BPMN e dos portões). A seção "Glossário do escritório" segue o padrão das outras seções da Configuração: lista por tipo, formulário para acrescentar, "Corrigir" e "Tirar" em cada termo.
- **Quem:** ver com `gestao.ver`, como a página. Mudar só com `glossario.editar`, só a Sênior (matriz versão 16).
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
