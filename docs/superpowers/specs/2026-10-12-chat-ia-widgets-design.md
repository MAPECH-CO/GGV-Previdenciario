# Chat da IA: gravar de verdade, bolhas, texto formatado e widgets

Data: 12/10/2026. Pedido do Pedro, sem cartão no Jira (o pedido sai sem chave). Desenho aprovado no chat em 12/10.

## Objetivo

O chat "Pergunte ou peça" das Centrais e da aba Suporte passa a:

1. **Gravar áudio de verdade.** Mostra que está gravando (bolinha, onda da voz, tempo) e o que a pessoa falou cai na
   caixa de texto, para conferir antes de enviar.
2. **Ter bolhas melhores e texto formatado.** A pessoa à direita, a IA à esquerda com o ✦. A IA usa negrito, listas,
   tabelas curtas e títulos pequenos.
3. **Responder com widgets.** Números, lista com link, prazos da semana, etapas do processo, linha do tempo e barras,
   montados pelo servidor e escolhidos pela IA no meio do texto.

Sucesso: na homologação, "o que tem hoje pra mim?" volta com um texto curto e formatado, os números das tarefas, a lista
das urgentes com link e os prazos da semana; o botão de gravar transcreve a fala para a caixa.

## Fora do escopo

- Mostrar o raciocínio do modelo ou a lista de ferramentas usadas (o Pedro dispensou).
- Trocar o modelo do chat (segue `OPENAI_MODELO`, hoje `gpt-4.1-mini`).
- Resposta em fluxo (streaming): a resposta continua chegando inteira.
- Modo de exemplo sem IA: sem chave, o chat segue avisando que a IA está desligada. A IA de verdade só se vê na
  homologação. O motor local do navegador (`dados/chat.ts` sem servidor) não ganha widgets.
- Mudar os cartões de ação (só acompanham o visual novo).

## Decisões

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| De onde vêm os dados dos widgets | Do servidor, das mesmas rotas das telas | Número é código, não modelo (regra do projeto); a permissão é a de quem pergunta |
| Como a IA põe o widget | Marcador `{{w1}}` no texto | Texto e widget intercalados; a IA só escolhe e ordena |
| Texto formatado | Leitor próprio, pequeno, sem HTML | Seguro por construção; evita dependência nova |
| Transcrição da fala | `ia.transcrever` do motor (OpenAI) | Já existe, já registra a chamada e recusa saúde sem autorização |
| Onde se vê a IA de verdade | Só na homologação | Escolha do Pedro; aqui só a aparência, com respostas de exemplo nos testes |

## Parte 1: gravar áudio

### Tela

- O botão "Gravar áudio" pede o microfone (`getUserMedia`) e a área de ações da caixa vira a faixa **Gravando**:
  bolinha vermelha, a onda (barras que seguem o volume real, lido por um `AnalyserNode`), o tempo em `m:ss` com
  algarismos de mesma largura, e os botões **Descartar** (✕) e **Pronto** (✓).
- Limite de 2 minutos: no limite, para sozinho e segue como se tivesse apertado **Pronto**.
- **Pronto**: a faixa mostra "Transcrevendo…" e o áudio vai ao servidor. O texto volta e entra na caixa, somado ao que já
  estava escrito, com o cursor no fim. Nada é enviado sozinho.
- **Descartar**: para, joga o áudio fora e volta a caixa como estava.
- Avisos (no lugar do aviso de hoje, `role="status"`):
  - microfone negado ou ausente: "Não deu para usar o microfone: libere o acesso no navegador ou digite a pergunta.";
  - IA desligada, saúde sem autorização ou falha: a mensagem que o servidor devolver.
- Movimento reduzido: a onda continua (é informação), a bolinha não pulsa.
- O código do reconhecimento de fala do navegador (`SpeechRecognition`) sai.
- Teclado: Esc descarta; o foco vai para **Pronto** quando a gravação começa e volta para a caixa de texto no fim.

### Servidor

- `POST /api/chat/fala`, só com sessão. Corpo: o áudio cru (`audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg` ou
  `audio/wav`), até 10 MB. Outro tipo: 415; maior: 413.
- Chama `ia.transcrever({ quem, audio, mime, nome: 'fala-do-chat', sensivel, referencia: 'chat:fala' })`, com
  `sensivel = veSaudeNoChat(perfil)`, a mesma regra do chat. O motor registra só tamanho e hash do áudio; o áudio não é
  guardado e o texto não vai para log.
- Resposta 200: `{ texto }` (as falas juntadas). Sem texto (desligada, recusada, falhou): 503 com
  `{ erro }` nas mensagens que o chat já usa (`MSG_IA_DESLIGADA`, `MSG_IA_SEM_SAUDE`, `MSG_IA_SEM_RESPOSTA`).
- Contrato: `TextoDaFala = z.object({ texto: z.string() })` em `@ggv/contratos`.

## Parte 2: bolhas e texto formatado

### Bolhas

- A mensagem da pessoa: à direita, até 80% da largura, fundo `--cor-acento-suave`, texto `--cor-texto`, raio 16 com o
  canto de baixo à direita em 4. Anexos em etiquetas acima do texto.
- A resposta da IA: à esquerda, o ✦ num círculo de 28 px na cor do acento, e o conteúdo na largura toda ao lado (sem
  bolha pesada), para caber os widgets.
- Esperando: três pontinhos que sobem e descem (com movimento reduzido, ficam parados), com "Lendo…" para leitor de tela.
- Mensagem nova entra com opacidade e 4 px de subida em 150 ms; nada anima com movimento reduzido.
- Rodapé de cada resposta: o selo "Sugestão da IA" (a marca de sugestão da GGVP-106) e as fontes em etiquetas. A frase
  "Só respondo e oriento…" deixa de se repetir em cada resposta; segue no topo do chat ("só responde e orienta; para
  executar algo, mostra um card para você confirmar").
- Portão, opções de escolha e cartão de ação continuam como estão, dentro da resposta.

### Texto formatado

- Leitor em `apps/web/src/regras/formatacao.ts` (puro, com teste) que transforma o texto em blocos; o componente
  `TextoFormatado` desenha com elementos do React. Nunca `dangerouslySetInnerHTML`.
- Aceita: parágrafos e quebra de linha; `**negrito**`; `*itálico*` e `_itálico_`; `` `código` ``; `###` e `####`
  (viram títulos pequenos); listas com `-`, `*` ou `1.` (um nível de recuo); tabelas no formato do GitHub (linha de
  títulos, linha de traços, até 6 colunas); links `[texto](/caminho)` só para telas do portal (começam com `/`). Link
  para fora e HTML aparecem como texto.
- Tabela larga rola dentro do próprio quadro, sem empurrar o chat.

### Instrução da IA

`INSTRUCAO_DO_CHAT` muda e `VERSAO_DO_CHAT` passa a 2:

- "Responda em português simples e curto: até 6 frases fora das listas e tabelas."
- "Formate quando ajudar: **negrito** no que importa, listas para passos, tabela curta para comparar. Sem HTML."
- "Quando uma ferramenta oferecer widgets prontos, mostre o que ajuda escrevendo o marcador, como {{w1}}, sozinho numa
  linha, onde ele deve aparecer. No máximo 4. Não repita no texto os números que o widget já mostra."
- Seguem as regras de hoje: só o que as ferramentas trouxeram, sem calcular prazo, valor nem número.

## Parte 3: widgets

### Contrato (`@ggv/contratos`, `chat.ts`)

```ts
const Tom = z.enum(['neutro', 'acento', 'alerta', 'erro', 'ok'])
const Href = z.string().startsWith('/')
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const WidgetDoChat = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('numeros'), titulo: z.string().optional(),
    itens: z.array(z.object({ rotulo: z.string(), valor: z.number().int().min(0), nota: z.string().optional(), tom: Tom.optional() })).min(1).max(4) }),
  z.object({ tipo: z.literal('lista'), titulo: z.string(),
    itens: z.array(z.object({ titulo: z.string(), sub: z.string().optional(), href: Href.optional(),
      selo: z.object({ texto: z.string(), tom: Tom }).optional() })).min(1).max(8) }),
  z.object({ tipo: z.literal('prazos'), titulo: z.string(), inicio: Data,
    itens: z.array(z.object({ data: Data, oQue: z.string(), href: Href.optional(), urgente: z.boolean() })).max(20) }),
  z.object({ tipo: z.literal('etapas'), titulo: z.string().optional(),
    itens: z.array(z.object({ rotulo: z.string(), estado: z.enum(['feita', 'atual', 'futura']) })).min(2).max(8) }),
  z.object({ tipo: z.literal('linha-do-tempo'), titulo: z.string(),
    itens: z.array(z.object({ quando: Data, quem: z.string().optional(), texto: z.string() })).min(1).max(6) }),
  z.object({ tipo: z.literal('barras'), titulo: z.string(),
    itens: z.array(z.object({ rotulo: z.string(), valor: z.number().int().min(0) })).min(1).max(8) }),
])

export const BlocoDaResposta = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('texto'), texto: z.string() }),
  z.object({ tipo: z.literal('widget'), widget: WidgetDoChat }),
])
```

`RespostaDoChat` ganha `blocos: z.array(BlocoDaResposta).max(12).optional()`. Sem `blocos`, a tela desenha
`sugestao.texto` como hoje (respostas da regra, recusas e o motor local). `sugestao.texto` continua com o texto inteiro,
sem os marcadores, para o registro e para quem não lê blocos.

### Quem monta (servidor, `rotas/chat.ts`)

Cada ferramenta de leitura, além do texto para o modelo, monta widgets a partir do mesmo JSON que já lê da rota da tela,
guarda no `Ambiente` (`x.widgets`, ids `w1`, `w2`…) e acrescenta ao que devolve ao modelo:
`Widgets prontos (escreva o marcador para mostrar): {{w1}} números das suas tarefas; {{w2}} tarefas urgentes; …`.

| Ferramenta | Widgets | De onde |
| --- | --- | --- |
| `minhas_tarefas` | `numeros`: abertas, urgentes, vencem hoje (com o "hoje" de São Paulo, pelo `agora` da rota) | `GET /api/tarefas` |
| | `lista`: até 8 tarefas, urgentes primeiro, depois por prazo; título "cliente · tarefa" (ou o contexto), sub com o detalhe, link para a tela do passo ou o caso, selo "atrasada" (erro), "hoje" (acento) ou "até dd/mm" (neutro) | |
| | `prazos`: as tarefas com prazo nos próximos 7 dias, a partir de hoje | |
| | `barras`: tarefas por cliente, só com 4 ou mais clientes | |
| `ler_caso` | `etapas`: as cinco etapas da página do processo, pela `etapaAtual` | `GET /api/casos/:id/processo` |
| | `linha-do-tempo`: os 6 eventos mais recentes da `linha` | |
| | `prazos`: `prazos` e `exigencias` com prazo, a partir de hoje | |
| `buscar_no_acervo` | `lista`: os casos parecidos (referência e trecho curto), sem link | os achados |

Depois da resposta final, `montarBlocos(texto, x.widgets)` corta o texto nos marcadores `{{wN}}`:

- marcador de widget que existe vira bloco `widget`, só na primeira vez;
- marcador inventado, repetido ou além do quarto some;
- os pedaços de texto em volta viram blocos `texto` (vazios somem);
- sem nenhum marcador válido, a resposta vem sem `blocos`.

### Governança

- **Números e datas:** saem do código das ferramentas. O modelo não escreve widget, só escolhe pelo marcador.
- **Permissão:** cada widget vem das rotas da tela com o cookie de quem pergunta, então segue a matriz e o acesso a
  saúde já registrado por elas.
- **G20:** para quem não vê saúde, a checagem de código de doença (`temCid`) roda no texto e no JSON dos widgets. Se
  achar, a resposta é recusada como hoje.
- **G6 e cartões:** nada muda. Widget não executa nada: só mostra e leva a uma tela.
- **LGPD:** o widget não leva CPF, nascimento nem conteúdo de documento (as rotas já tiram; os montadores não
  acrescentam nada).

### Tela (`WidgetsDoChat.tsx` e `.module.css`)

- `numeros`: quadros lado a lado (até 4); o valor em 22 px com algarismos de mesma largura; `tom` erro e alerta pintam o
  número.
- `lista`: linhas separadas por fio, título com o cliente em negrito, sub suave, selo à direita, seta `›` quando há
  link (a linha inteira é o link).
- `prazos`: faixa dos 5 dias úteis a partir de `inicio` com a contagem por dia (contada na tela, a partir das datas) e,
  abaixo, a lista dos itens. A faixa é decorativa (`aria-hidden`); a lista é o conteúdo.
- `etapas`: a faixa das etapas como na página do processo (feita com ✓, atual cheia, futura tracejada); `ol` com
  `aria-current="step"` na atual.
- `linha-do-tempo`: `ol` com a data à esquerda (`dd/mm`) e o texto à direita, com um fio vertical.
- `barras`: barras horizontais com o rótulo à esquerda e o valor no fim; a maior ocupa a largura toda.
- Estreito (aba Suporte, menos de 420 px pelo contêiner): números em 2 colunas, a faixa de prazos some (fica a lista).

## Erros

| Situação | O que acontece |
| --- | --- |
| A IA não usa marcador | Só o texto formatado |
| A IA inventa `{{w9}}` | O marcador some |
| Widget com dado fora do contrato | O servidor não oferece o widget (valida com `WidgetDoChat.safeParse` antes de guardar) |
| A rota da tela nega (perfil) | A ferramenta devolve a frase de hoje e não oferece widget |
| Microfone negado | Aviso; a caixa segue como estava |
| Transcrição sem chave, sem saúde ou com falha | 503 com a mensagem; a tela mostra o aviso |

## Testes

- **Contratos:** `WidgetDoChat` e `BlocoDaResposta` (aceita e recusa), `RespostaDoChat` com e sem `blocos`.
- **Servidor:**
  - `montarBlocos`: marcador válido, inventado, repetido, além do quarto, sem marcador;
  - montadores a partir de JSON de exemplo de `/api/tarefas` e de `/api/casos/:id/processo`, com "hoje" fixo;
  - rota com o `fetch` falso do motor: a ferramenta é chamada, a resposta final usa `{{w1}}` e volta com `blocos`;
  - código de doença num widget para o Atendimento: recusa;
  - `POST /api/chat/fala`: sem sessão 401, tipo errado 415, grande 413, sem chave 503, com o `fetch` falso devolve
    `{ texto }`.
- **Tela:**
  - leitor de formatação (cada regra e o que vira texto puro);
  - `TextoFormatado`;
  - cada widget;
  - `ChatDoPortal` com `blocos`;
  - `ChatIA` com o microfone, o `MediaRecorder` e o áudio falsos: gravando, tempo, Pronto põe o texto na caixa,
    Descartar, microfone negado, Esc.
- **Navegador:** `e2e/chat.e2e.ts` acompanha a marcação nova; roda no GitHub (não localmente).
- **Aparência local:** respostas de exemplo injetadas no teste (o Playwright intercepta `/api/chat`), com fotos no
  computador (1366 px) e no celular (390 px), temas claro e escuro.

## Entrega

- Ramo `feat/chat-ia-widgets`, um pedido contra a main, sem chave do Jira.
- Commits na ordem das partes (gravar, bolhas e formatação, widgets), cada um com seus testes.
- O agente do chat (`apps/api/src/ia/chat.ts`, GGVP-142) é do Mateus: aviso a ele e ao orquestrador antes de mexer.
- A mescla publica na homologação; é lá que a IA de verdade aparece.
