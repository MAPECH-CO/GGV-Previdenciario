# Design

## Context

- Esta change continua as changes `ggvp-6-recepcao-e-entrevista`, `ggvp-7-abertura-e-documentacao` e
  `ggvp-13-documentacao-medica`: mesma base de telas, mesmo servidor de exemplo, mesmos clientes da semente. As decisões
  das `design.md` delas valem aqui (servidor de exemplo em `src/dados/`, regras puras em `src/regras/`, `campos` pelo
  `src/campos.ts`, catálogos únicos, arquivo comum só com acréscimo, rota nova dentro de `Telas` no `App.tsx`).
- O que já existe e esta change liga, sem refazer: a gravação e a transcrição da entrevista (GGVP-40 e GGVP-46: o
  relógio da gravação, as ações registradas, o cofre que pausa, `tirarSenhas`, as partes do áudio, a janela
  "Transcrições do caso"), a ficha do cliente (GGVP-16) e o envio pelo Chatwoot simulado da cobrança (GGVP-101).
- A página do processo não existe nesta base (GGVP-86, do Fernando). O "Registrar contato com o cliente" dela abre a
  mesma janela "Registrar conversa" desta change; aqui a conversa começa pelo card do cliente (lead ou cliente: é a mesma
  tela) e pelas Transcrições.
- Quem age na tela: o `usePerfil` de `src/dados/perfis.ts`. Na junção com o main, vira um adaptador do login.

## Decisions (valem para o épico)

1. **Arquivo novo por assunto.** Conversa: `src/regras/conversa.ts` e `src/dados/conversa.ts`. Desfazer com Ctrl+Z:
   `src/desfazer.ts`. Mensagens (grupo 2): `src/regras/mensagens.ts` e `src/dados/mensagens.ts`. Tipo novo fica no
   arquivo do assunto.
2. **Arquivo comum só com acréscimo.** Em `servidor.ts` (tipo `Banco`), `App.tsx`, `main.tsx` e nas Centrais:
   acrescentar no fim, sem reordenar nem reformatar. Campo novo no `Banco` é opcional (`conversas?`, `versoes?`) e a
   chave do `sessionStorage` não muda; sem ele, começa da semente de `dados/conversa.ts`.
3. **O mesmo motor da entrevista.** A conversa gravada é uma `Gravacao` em `banco.gravacoes`, com as mesmas ações
   (`registrarAcao`), o mesmo cofre que pausa e a mesma montagem da transcrição: `montarTranscricao` sai de dentro de
   `transcrever` (em `dados/entrevista.ts`) e passa a servir aos dois. Por isso a conversa aparece sozinha na janela
   "Transcrições do caso", com data, canal, quem registrou e "só registro" quando não tem áudio.
4. **A IA sugere, a pessoa decide.** A IA (simulada) transcreve e extrai o que foi dito; a comparação com a ficha e o
   processo é código (`oQueMudou`). Nada vai para a ficha sem a conferência de quem conversou (G14).
5. **Dado de saúde por perfil.** O fato novo de saúde fica marcado (`saude`): o Atendimento vê que existe e quem confirma,
   nunca o conteúdo. O histórico da ficha registra o que aconteceu, sem o conteúdo de saúde. Conversa conduzida pela
   advogada fica `soJuridico`, como a entrevista.
6. **Quem fez.** A tela manda o nome e o perfil escolhidos (`usePerfil`); sem escolha, o da função da tela. O servidor
   de exemplo confere de novo: só Atendimento e Jurídico conduzem; só quem conversou confere; só a Sênior volta versão.
7. **Portas desta sessão.** Portal `PORTA=3006 PORTA_API=3006 PORTA_WEB=5176`; Playwright `PORTA_E2E_API=3151` e
   `PORTA_E2E_WEB=5187`, com `--workers=1`.

## GGVP-76 · Registrar a conversa por telefone ou presencial

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/clientes/:id` (muda) | Cliente · dados `73:199` | "Iniciar conversa" (no lugar do "Registrar contato" desligado) abre a janela "Registrar conversa" |
| janela "Registrar conversa" | Overlay · Registrar conversa `2144:2` | Canal (Ligação ou Presencial; sem WhatsApp e vídeo, Lucas 06/10), com quem falou (cliente, familiar ou contato de apoio, médico ou clínica), o processo (quando há mais de um), a gravação ("Transcrição em tempo real" com o aviso, "Anexar arquivo" da ligação já feita, ou "Sem áudio: só o registro escrito"), o resumo escrito, a nota da IA e a de dado de saúde |
| janela "Transcrições do caso" (muda) | `1626:2` | "Registrar nova conversa" abre a mesma janela; a conversa gravada mostra "Conferir na conversa" no lugar de "Conferir e levar" |
| `/conversas/:id` | step_D5.01 `2281:2`, com a transcrição ao vivo de `73:560` | "nome · Registrar conversa": o aviso G10 e G9 com "Ver as transcrições", o canal e com quem, e o trabalho do modo: "Gravar" com o lembrete do aviso, "Pausar", "Retomar", "Abrir o cofre", "Finalizar conversa" e a transcrição em tempo real; ou "Anexar o áudio da ligação"; ou o registro escrito. No lado, "Antes de concluir" |
| `/` e `/advogada` (muda) | Central `11:2` e `59:449` | "**nome** · Registrar conversa" para quem abriu a conversa e não terminou |

### Contrato (vai para `packages/contratos/conversas.ts`)

```ts
export const CanalDoRegistro = z.enum(['ligacao', 'presencial'])                 // CA3
export const ComQuem = z.enum(['cliente', 'familiar', 'medico'])                  // CA3
export const ModoDoRegistro = z.enum(['tempo-real', 'arquivo', 'escrito'])       // CA4, CA9
export const NovaConversa = z.object({
  canal: CanalDoRegistro, comQuem: ComQuem, modo: ModoDoRegistro,
  processoId: z.string().optional(),                     // lead sem processo: fica na ficha do lead (Lucas, 06/10)
  registro: z.string().trim().min(3).max(4000).optional(), // obrigatório no modo escrito
})
export const Conversa = z.object({
  id: z.string(), fichaId: z.string(), processoId: z.string().optional(),
  canal: CanalDoRegistro, comQuem: ComQuem, modo: ModoDoRegistro,
  quem: z.string(), papel: z.enum(['atendimento', 'juridico']),
  abertaEm: z.string(), gravacaoId: z.string().optional(), registro: z.string().optional(),
  finalizadaEm: z.string().optional(),
  analise: AnaliseDaConversa.optional(),                 // GGVP-80
  conferidaEm: z.string().optional(),                    // GGVP-84
  pendencia: Pendencia.optional(),                       // GGVP-88
})
export const InicioDaGravacao = z.object({ avisei: z.literal(true) })      // CA1, CA5 (G10)
export const AudioDaLigacao = z.object({ nome: z.string().min(1), tipo: z.string(), tamanho: z.number().int().min(1), avisoNaGravacao: z.literal(true) })
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/fichas/:id/conversas` | `NovaConversa` | `Conversa` | `abrirConversa` |
| `GET /api/conversas/:id` | | `{ conversa, ficha, gravacao? }` | `obterConversa` |
| `POST /api/conversas/:id/gravacao` | `InicioDaGravacao` | `Gravacao` | `gravarConversa` |
| `POST /api/gravacoes/:id/acoes` | `{ acao, aos }` | `Gravacao` | `registrarAcao` (GGVP-40, o mesmo) |
| `POST /api/conversas/:id/finalizar` | `{ aos }` | `{ conversa, gravacao }` | `finalizarConversa` |
| `POST /api/conversas/:id/audio` | `AudioDaLigacao` e o arquivo | `{ conversa, gravacao }` | `anexarAudio` |

### Campos

| Campo | Regra |
|---|---|
| Canal, com quem falou, gravação | lista fixa (`CANAIS_DO_REGISTRO`, `COM_QUEM`, `MODOS_DO_REGISTRO`) |
| Processo | lista dos processos da ficha; lead sem processo não tem o campo |
| Resumo da conversa | texto, obrigatório no "Sem áudio", de 3 a 4000 letras |
| Áudio da ligação | qualquer formato de áudio (`ehAudio` da GGVP-40), sem limite de tamanho |
| "A ligação começou com o aviso de gravação" | caixa de marcar, obrigatória para anexar (G10) |

Nenhum campo da biblioteca `campos`. O servidor de exemplo valida de novo com `motivoParaNaoAbrir`.

### Decisões da história

1. **Uma janela só** (`RegistrarConversa`), aberta pelo card do cliente, pelas Transcrições e, quando existir, pela página
   do processo. A tela do passo `/conversas/:id` é onde a conversa acontece. O canal sugere o modo (ligação → anexar;
   presencial → tempo real), mas os três modos valem para os dois canais (CA4).
2. **O aviso antes de gravar** (CA1, CA5, G10): "Gravar" abre o lembrete com a frase; a gravação só começa com "Avisei";
   a hora fica em `avisoEm` e no histórico. Na ligação anexada, a pessoa marca que o áudio começa com o aviso.
3. **Transcrição em tempo real** (CA9): o mesmo relógio, as mesmas ações e o mesmo cofre da entrevista; a fala da
   conversa de exemplo (`falasDaConversa`) passa por `tirarSenhas` já ao vivo. "Finalizar conversa" encerra, guarda o
   áudio no card (CA6) e manda para a transcrição (GGVP-80).
4. **Lead sem processo** (Lucas, 06/10): a conversa fica na ficha do lead, que é a mesma tela do cliente.
5. **"Registrar conversa" na Central** (CA8): a conversa aberta e não terminada aparece para quem a abriu, com o que
   falta. A semente traz a ligação do Pedro Exemplo, de hoje, esperando a gravação subir.
6. **Áudio guardado** (Q11, Lucas 06/10): fica no card por tempo indeterminado; não há função que apague.

## GGVP-80 · Transcrever e identificar o que mudou

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/conversas/:id` (depois de finalizar) | step_D5.01 `2281:2` ("Depois de salvar, a IA transcreve e marca o que muda") | "Transcrevendo…", a falha com "Tentar de novo", e o quadro da IA: o que mudou, os dados novos, o que precisa atualizar (ficha do cliente, campos do processo ou os dois) e a observação; cada mudança com o trecho e a hora em que foi dita; "Conferir e atualizar" e "Ver a transcrição" |
| janela "Transcrições do caso" | `1626:2` | A conversa transcrita com data, canal, quem conversou e duração, e as três partes: resumo, informações extraídas e transcrição |

### Contrato (acrescenta a `packages/contratos/conversas.ts`)

```ts
export const CampoDaFicha = z.enum(['telefone', 'endereco', 'contatoApoio', 'estadoCivil', 'email'])   // contato, endereço, grupo familiar
export const CampoDoProcesso = z.enum(['pericia', 'fato', 'documento'])                                // datas, fatos novos, documentos citados
export const Mudanca = z.object({
  id: z.string(), onde: z.enum(['ficha', 'processo']), campo: z.union([CampoDaFicha, CampoDoProcesso]),
  rotulo: z.string(), antes: z.string(), depois: z.string(),
  aos: z.number().int().min(0), trecho: z.string(),     // CA5: o trecho e a hora
  saude: z.boolean().optional(),                         // fato de saúde: só o Jurídico vê
})
export const AnaliseDaConversa = z.object({
  mudancas: z.array(Mudanca),                            // CA2, CA5 (antes vazio: dado novo)
  atualizar: z.array(z.enum(['ficha', 'processo'])),     // decisão ◯ "O que precisa atualizar?"
  observacao: z.string(),
  pendencia: z.string().optional(),                      // o combinado que a IA ouviu (GGVP-88)
})
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/conversas/:id/transcricao` | — (tentar de novo) | `{ conversa, gravacao }` | `transcreverConversa` |

### Decisões da história

1. **Transcrição** (CA1, CA4): `montarTranscricao`, o mesmo motor da entrevista, sobre as falas da conversa: partes,
   quem fala, senha retirada. Vale para a ligação anexada e para a conversa gravada no escritório. O texto fica no card,
   nas Transcrições (com acesso por perfil); o histórico da ficha registra que a transcrição ficou pronta, sem o conteúdo.
2. **O que mudou é código** (CA2, CA5): a IA só extrai o que foi dito; `oQueMudou` compara cada valor com a ficha e com os
   campos do processo e devolve só o que é diferente, marcado "ficha do cliente" ou "campos do processo", com o trecho.
   Valor antes vazio é "dado novo". `oQuePrecisaAtualizar` responde a decisão ◯ do Miro.
3. **Senha** (CA3, CA7, CA8, G9): a senha dita sai do texto (`tirarSenhas`) e vai para o cofre simulado (só a trilha:
   quem, quando; nunca o valor). O trecho do cofre aberto durante a gravação não entra no áudio nem na transcrição.
4. **Só registro** (CA9): sem áudio, não há transcrição; aparece "só registro" nas Transcrições.
5. **Dado de saúde**: o fato novo de saúde (a internação, na conversa de exemplo) fica `saude`; o Atendimento vê
   "fato novo de saúde · só o Jurídico vê".

## GGVP-84 · Atualizar ficha e processo com desfazer

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/conversas/:id/conferir` | step_D5.04 `2282:2` | "nome · Conferir conversa": o que a IA quer mudar pela conversa de hoje, campo por campo, com a hora em que foi dito, e "Confirmar", "Corrigir" e "Desfazer" em cada um; o que o perfil não pode mudar aparece sem "Confirmar" e com quem pode; "Ver a transcrição", "Ver o histórico"; no fim, "Confirmar" e "Desfazer"; depois, "o caso segue de onde parou" |
| janela "Histórico do processo" | Overlay · Histórico do processo `59:11` | Cada campo mudado pela conversa, versão por versão, com quem mudou e quando; para a Sênior, "Voltar para esta versão" |
| `/clientes/:id` (muda) | `73:199` | "Ver versões" no cartão "Histórico" abre a mesma janela |
| todo campo de escrita | — | Ctrl+Z volta o que a pessoa digitou (`src/desfazer.ts`) |

### Contrato (acrescenta a `packages/contratos/conversas.ts`)

```ts
export const DecisaoDaMudanca = z.object({
  id: z.string(), decisao: z.enum(['confirmada', 'corrigida', 'desfeita']),
  valor: z.string().optional(),                          // só na corrigida; validado pelo campo
})
export const Conferencia = z.object({ decisoes: z.array(DecisaoDaMudanca), pendencia: NovaPendencia })   // pendência: GGVP-88
export const VersaoDoCampo = z.object({
  fichaId: z.string(), processoId: z.string().optional(), onde: z.enum(['ficha', 'processo']), campo: z.string(),
  rotulo: z.string(), valor: z.string(), quem: z.string(), quando: z.string(),
  origem: z.enum(['antes', 'conversa', 'volta']), conversaId: z.string().optional(),
})
export const VoltarVersao = z.object({ versao: z.number().int().min(0) })   // índice na lista do campo
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/conversas/:id/conferencia` | `Conferencia` | `{ conversa, ficha, tarefa? }` | `conferirConversa` |
| `GET /api/fichas/:id/versoes` | | `VersaoDoCampo[]` | `obterVersoes` |
| `POST /api/fichas/:id/versoes/:campo/volta` | `VoltarVersao` | `VersaoDoCampo[]` | `voltarParaVersao` |

### Campos

| Campo (ao corrigir) | Função de `campos` |
|---|---|
| Telefone | `normalizarTelefone`, `validarTelefone`, `formatarTelefone` |
| E-mail | `validarEmail` |
| Data da perícia | `normalizarData`, `validarData`, `dataParaIso`, `isoParaData` |
| Endereço, contato de apoio, estado civil, fato novo, documento citado | texto, de 2 a 200 letras |

O servidor de exemplo valida de novo com a mesma `erroDoValor` de `regras/conversa.ts`.

### Decisões da história

1. **Quem confere** (Pedro, 07/10): quem fez a conversa, na hora, antes de gravar. Não nasce tarefa para outra pessoa. O
   servidor recusa a conferência de outra pessoa.
2. **Nada entra antes de conferir** (CA1, CA6, G14): a conferência aplica só as mudanças da análise que foram
   confirmadas ou corrigidas; o que não foi dito não muda. A informação extraída nas Transcrições fica "✓ conferida".
3. **O que o perfil pode** (CA8): `podeConfirmar` em `regras/conversa.ts`. Atendimento e Jurídico confirmam o contato, o
   endereço, o grupo familiar, a data da perícia e o documento citado; o fato novo só o Jurídico (pode ser dado de saúde).
   O que o perfil não pode fica pendente nas Transcrições, para quem pode conferir lá.
4. **Versões** (CA2, G14): na primeira mudança de um campo, a versão de antes entra na lista; cada mudança da conversa
   e cada volta viram versão nova, com quem e quando. "Voltar para esta versão" só a Sênior (Dra. Renata e Dr. Otávio
   na semente); a volta também fica no histórico da ficha. Os campos do processo vivem nas versões até a página do
   processo existir.
5. **O caso volta para onde estava** (CA3, CA7): a conferência não mexe na etapa nem na próxima ação do processo; a tela
   mostra "o caso segue de onde parou" com a etapa, e a conversa sai da Central.
6. **Ctrl+Z em todo campo** (CA9, Pedro 07/10): o navegador desfaz o texto digitado, mas perde o passo nos campos com
   máscara (telefone, data, CPF). `instalarDesfazer` guarda, por campo, o valor antes de cada digitação e o devolve no
   Ctrl+Z, avisando o React como se a pessoa tivesse digitado. Instalado uma vez no `main.tsx`; vale no portal todo.

## GGVP-88 · Pendência da conversa vira tarefa

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/conversas/:id/conferir` (continua) | step_D5.04 `2282:2`, e o chat "criar tarefa (pergunta o responsável)" `2052:186` com os cards `2176:2` | "Surgiu pendência?": "Não — confirmar e voltar ao D1" ou "Sim — criar a tarefa no card (D5.05)"; no "Sim", o que ficou combinado (já sugerido pela IA), o prazo e o responsável pela regra do chat: citou a pessoa, é ela ("Trocar"); citou o setor, pergunta quem do setor; ninguém, pergunta quem é |
| `/` e `/advogada` (muda) | Central `11:2` e `59:449` | "**nome** · Cumprir pendência", com o combinado embaixo, para o responsável; no prazo vencido, o lembrete; três dias depois, sobe para a Sênior |

### Contrato (acrescenta a `packages/contratos/conversas.ts`)

```ts
export const NovaPendencia = z.discriminatedUnion('surgiu', [
  z.object({ surgiu: z.literal(false) }),                                       // CA2
  z.object({ surgiu: z.literal(true), texto: z.string().trim().min(5).max(500), // o combinado (CA4)
    responsavel: z.string(), prazo: dataIso }),                                 // nunca presumido (CA3)
])
export const Pendencia = NovaPendencia.and(z.object({ tarefaId: z.string().optional(), cumpridaEm: z.string().optional() }))
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/conversas/:id/conferencia` | (o mesmo da GGVP-84) | | `conferirConversa` |
| `POST /api/conversas/:id/pendencia/cumprida` | | `Conversa` | `cumprirPendencia` |
| `POST /api/conversas/:id/pendencia/prazo` | `{ prazo }` (Sênior) | `Conversa` | `novoPrazoDaPendencia` |

### Campos

| Campo | Função de `campos` |
|---|---|
| O que ficou combinado | texto, obrigatório no "Sim", de 5 a 500 letras |
| Prazo, novo prazo (Sênior) | `normalizarData`, `validarData`, `dataParaIso`; de hoje em diante |
| Responsável | lista das pessoas do setor (`PERFIS`), sem valor presumido |

### Decisões da história

1. **A regra do responsável é código** (CA3): `responsavelDaPendencia(texto, pessoas)` acha o nome da pessoa no texto
   (sem acento e sem maiúscula); sem pessoa, acha o setor ("Documentação", "Atendimento", "Jurídico", "advogada"...); sem
   nada, devolve "perguntar". As pessoas são as do "Trocar perfil" (`PERFIS`), num lugar só. A tela nunca escolhe sozinha.
2. **A tarefa** (CA1, CA4): nasce no card, para o responsável, com o título "nome · Cumprir pendência" e o combinado na
   linha de baixo. A Central mostra em "Minhas tarefas" só as da pessoa do perfil. "Não" (CA2) não cria tarefa.
3. **O laço** (CA5): a régua geral é da GGVP-94, que não existe ainda. Até lá, vale o laço da cobrança
   (`DIAS_ENTRE_COBRANCAS` de `regras/cobranca.ts`): vencido o prazo, a tarefa fica urgente com o lembrete; três dias
   depois, a Sênior recebe "Pendência atrasada" e decide um novo prazo ou dá por cumprida.
4. **O caso volta ao D1 de onde parou** (CA1, CA2): a pendência não muda a etapa do processo.

## GGVP-102 · Mensagens ao cliente com modelo e registro

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/clientes/:id` (muda) | Cliente · dados `73:199` | "Mensagem ao cliente" no topo abre a janela; o envio aparece em "Últimos contatos" com a data, o canal com a hora e o status, e o texto (CA2, CA4) |
| janela "Mensagem ao cliente" | no visual da janela do convite (Marcar reunião `73:459`); os textos dos passos D3b.03 `10:320`, D3b.06 `1818:206` e DP.06 `10:405` | O modelo (catálogo único), o processo, o texto preenchido para revisar (o aprovado pelo Jurídico não muda), a IA apontando termo jurídico e frase longa, o que não pode sair (G9, G11, G20), o cliente na central do Chatwoot (contato, conversas com a de mais mensagens primeiro, "Copiar a mensagem", "Abrir a conversa"), "Enviar pelo Chatwoot", o status e a falha na tela |
| janela do Chatwoot do convite, da confirmação, da cobrança e do complemento (muda) | `73:459`, `73:371` | O mesmo cliente na central do Chatwoot e o mesmo envio com registro; a falha fica na tela e no histórico e nada mais é registrado |

### Contrato (vai para `packages/contratos/mensagens.ts`)

```ts
export const IdDoModelo = z.enum(['convite', 'lembrete', 'confirmacao', 'boas-vindas', 'cobranca', 'complemento',
  'resultado-favoravel', 'resultado-desfavoravel', 'pericia-orientacao', 'pericia-presenca'])
export const MensagemPronta = z.object({
  modelo: IdDoModelo, texto: z.string(), editavel: z.boolean(), trava: z.string().nullable(),     // CA1, CA7, CA8
  contato: z.object({ id: z.number(), nome: z.string(), telefone: z.string() }).nullable(),      // CA6
  conversas: z.array(z.object({ id: z.number(), caixa: z.string(), situacao: z.enum(['aberta', 'resolvida']), mensagens: z.number(), ultimaEm: z.string() })),
})
export const PedidoDeMensagem = z.object({ modelo: IdDoModelo, texto: z.string().trim().min(1).max(1000), conversa: z.number().int().min(0), processoId: z.string().optional() })
export const MensagemAoCliente = z.object({
  id: z.string(), fichaId: z.string(), processoId: z.string().optional(), modelo: IdDoModelo, texto: z.string(),
  canal: z.literal('Chatwoot'), conversa: z.number(), quando: z.string(), quem: z.string(),
  status: z.enum(['enviada', 'entregue', 'lida', 'falhou']), erro: z.string().optional(),      // CA4, CA5
})
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/fichas/:id/mensagens/:modelo?processo=` | | `MensagemPronta` | `prepararMensagem` |
| `POST /api/fichas/:id/mensagens` | `PedidoDeMensagem` | `MensagemAoCliente` | `enviarMensagem` |
| `GET /api/fichas/:id/mensagens` | | `MensagemAoCliente[]` | `mensagensDoCliente` |

### Campos

| Campo | Regra |
|---|---|
| Modelo, processo, conversa do Chatwoot | lista fixa |
| Mensagem | texto, de 1 a 1000 letras; `problemasDaMensagem` bloqueia G9, G11 e G20 e aponta termo jurídico e frase longa |

Nenhum campo da biblioteca `campos` (o telefone do contato vem da ficha, já normalizado). O servidor de exemplo confere de
novo a trava do modelo e o texto.

### Decisões da história

1. **Catálogo único de modelos** (`MODELOS_DE_MENSAGEM` em `regras/mensagens.ts`): o convite usa o `mensagemDoConvite` da
   agenda, a confirmação, a cobrança e o complemento usam a mensagem que as telas deles já montam; os outros são montados
   em `dados/mensagens.ts` com os dados do cliente e do caso (CA1, CA10). Texto em frases curtas, sem termo jurídico (CA3).
2. **A IA sugere, a pessoa decide** (CA3): `problemasDaMensagem` aponta termo jurídico (com a palavra simples) e frase com
   mais de 25 palavras; quem envia decide. O que não pode sair bloqueia, na tela e no servidor: pedir a senha do gov.br
   (G9), orientar a esconder ou mudar a situação real (G11) e diagnóstico, CID ou frase pronta (`problemaG20`, o mesmo do
   parecer).
3. **Resultado** (CA7, CA8): o favorável só com o OK da advogada na prestação de contas, que é da GGVP-11; aqui ele chega
   de exemplo (a Lúcia Exemplo, Dra. Paula). O desfavorável, só com o texto aprovado pelo Jurídico. Nos dois, o texto
   aprovado não muda.
4. **Pela central do Chatwoot** (CA6): o portal busca o contato pelo telefone da ficha (com o mesmo nome, quando mãe e filha
   dividem o número), lista as conversas com a de mais mensagens primeiro, copia a mensagem e oferece "Abrir a conversa".
   O envio vai pela conversa escolhida. Sem contato, o envio falha com o motivo.
5. **Registro e falha** (CA2, CA4, CA5): cada envio fica com o texto final, o canal, a data e a hora e o status que o
   Chatwoot devolve; em "Últimos contatos", "Chatwoot · 14:32 · entregue". A falha aparece na tela em que a pessoa está e
   fica no histórico; nada é reenviado sozinho, e a mesma mensagem já entregue na mesma conversa não sai de novo.
6. **Perícia** (CA9): os modelos da perícia usam a data da perícia em vigor no processo (a mesma que a conversa atualiza).

### Ponta para ligar no Chatwoot (estudada na documentação da API, developers.chatwoot.com)

A configuração do ambiente guarda `CHATWOOT_URL` (`https://chatwoot.mapech.com.br`), `CHATWOOT_CONTA`, `CHATWOOT_CAIXA` e
`CHATWOOT_TOKEN` (nunca no código; o token só quando o Pedro mandar). O servidor chama o Chatwoot com o cabeçalho
`api_access_token`; a tela nunca vê o token. O que dá para usar:

| O que o portal faz | Chamada do Chatwoot | Função de exemplo que ela troca |
|---|---|---|
| Achar o contato pelo telefone | `GET /api/v1/accounts/{conta}/contacts/search?q={telefone}` (nome, identificador, e-mail ou telefone; devolve `payload[]` com `id`, `name`, `phone_number`, `contact_inboxes`) | `buscarContatos` |
| Listar as conversas do contato | `GET /api/v1/accounts/{conta}/contacts/{id}/conversations` (devolve `id`, `status`, `inbox_id`, `messages`, `last_non_activity_message`, `unread_count`, `last_activity_at`) | `conversasDoContato` |
| Contar as mensagens, para ordenar | `GET /api/v1/accounts/{conta}/conversations/{id}/messages` | `conversasDoContato` (campo `mensagens`) |
| Mandar a mensagem | `POST /api/v1/accounts/{conta}/conversations/{id}/messages` com `content`, `message_type: "outgoing"`, `private: false`; no WhatsApp oficial fora das 24 horas, `template_params` com o modelo aprovado | `enviarNaConversa` |
| Saber se chegou | o `status` da mensagem (`sent`, `delivered`, `read`, `failed`) e, na falha, `external_error`; o webhook `message_updated` da conta avisa a mudança | `enviarNaConversa` (devolve `status` e `erro`) |
| Abrir a conversa | `{CHATWOOT_URL}/app/accounts/{conta}/conversations/{id}` | `linkDaConversa` |
| Conversa nova, quando não há | `POST /api/v1/accounts/{conta}/conversations` com `source_id` do `contact_inboxes`, `inbox_id` e `contact_id` | (não usada: a central já tem a conversa) |

Levar ao Lucas: no WhatsApp oficial, mensagem fora da janela de 24 horas só sai com modelo aprovado pela Meta; os textos do
catálogo viram esses modelos.

## GGVP-111 · Terceiro não se passa pelo cliente

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/clientes/:id` (muda) | Cliente · dados `73:199` | Mudar telefone ou e-mail no formulário pede "Como você confirmou que é o cliente?" (chamada de vídeo ou no escritório) e "a alteração vai em contrato novo"; o cartão "Dados bancários para o repasse" com "Mudar dados bancários", a segunda confirmação e o aviso ao contato anterior |
| `/conversas/:id` (muda) | step_D5.01 `2281:2`, Registrar conversa `2144:2` | Na ligação, ou com quem não é o cliente, o roteiro de segurança: confirmar a identidade antes de passar dado do caso; sem verificação, só "vamos retornar pelo contato cadastrado" |
| `/conversas/:id/conferir` (muda) | step_D5.04 `2282:2` | Telefone e e-mail ditos numa ligação, ou por quem não é o cliente, só mudam com a verificação e o contrato novo |
| janela "Mensagem ao cliente" (muda) | `73:459` | Todo modelo termina com "O escritório nunca pede a sua senha do gov.br por mensagem."; nos da perícia, o lembrete da verificação na ligação |
| `/` (Central do Atendimento, muda) | chat "o cliente ligou" `2107:2` | "O cliente me ligou": a próxima tarefa dele e o lembrete de confirmar a identidade antes de passar dado do caso |
| `/advogada` (muda) | Central · Advogada `59:449` | "Dados bancários mudaram" quando o caso está perto da prestação de contas |

### Contrato (vai para `packages/contratos/seguranca.ts`)

```ts
export const ComoVerificou = z.enum(['video', 'presencial'])                       // Lucas, 07/10
export const Verificacao = z.object({ como: ComoVerificou, contratoNovo: z.literal(true) })   // CA1
export const DadosBancarios = z.object({ banco: z.string().trim().min(2).max(60), agencia: z.string().regex(/^\d{4}(-\d)?$/),
  conta: z.string().regex(/^\d{3,12}-[\dXx]$/), pix: z.string().trim().max(80).optional() })
export const PedidoDeMudancaBancaria = z.object({ dados: DadosBancarios, verificacao: Verificacao })   // CA1, CA5
// Conferência da conversa (GGVP-84) e edição da ficha passam a levar `verificacao` quando o telefone ou o e-mail mudam.
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `PATCH /api/fichas/:id` (muda) | `EdicaoFicha` e `verificacao` | ficha | `salvarFichaVerificada` |
| `GET /api/fichas/:id/dados-bancarios` | | os dados em vigor e o pedido aberto | `obterDadosBancarios` |
| `POST /api/fichas/:id/dados-bancarios` | `PedidoDeMudancaBancaria` | o pedido aberto | `pedirMudancaBancaria` |
| `POST /api/fichas/:id/dados-bancarios/confirmacao` | — (a segunda pessoa) | os dados em vigor | `confirmarMudancaBancaria` |

### Campos

| Campo | Regra |
|---|---|
| Como confirmou que é o cliente | lista fixa: chamada de vídeo ou no escritório |
| A alteração vai em contrato novo | caixa de marcar, obrigatória |
| Banco, agência, conta, Pix | texto; agência com 4 números (e o dígito), conta com números e o dígito; o servidor confere de novo |

### Decisões da história

1. **A verificação é a do escritório** (Lucas, 07/10): chamada de vídeo ou o cliente no escritório, e a alteração vai em
   contrato novo. O contrato novo é do épico de abertura (ZapSign); aqui a pessoa marca que a alteração vai nele.
2. **Dado protegido** (CA1, CA8): telefone, e-mail e dados bancários. Na conversa presencial com o próprio cliente, ele está
   no escritório: vale a verificação. Na ligação, ou com familiar, contato de apoio, médico ou clínica, a mudança só entra
   com a verificação marcada na conferência. Na ficha, mudar telefone ou e-mail pede a verificação. O servidor recusa sem.
3. **Dados bancários** (CA2, CA5): a mudança nasce como pedido, com a verificação; outra pessoa (Atendimento líder, advogada
   ou Sênior) confirma; a confirmação avisa o contato anterior pelo Chatwoot e, com o caso perto da prestação de contas
   (sentença procedente, RPV ou benefício deferido), alerta a advogada e o Financeiro. A Central do Financeiro não existe
   ainda: o alerta dele fica guardado para ela.
4. **Retorno pelo contato cadastrado** (CA3, CA6): na tela da conversa por ligação, ou com quem não é o cliente, o roteiro
   de segurança mostra o número cadastrado e a frase "vamos retornar pelo contato cadastrado"; nas mensagens da perícia, o
   lembrete da verificação antes de passar data, local e orientação.
5. **Nunca a senha** (CA4): todo modelo termina com a frase do escritório; o texto que pede a senha não sai (G9, GGVP-102).
6. **O chat** (CA7): "o cliente me ligou" responde com a próxima tarefa do cliente e lembra de confirmar a identidade. O
   resto do chat é da GGVP-82.

## Risks / Trade-offs

- [A página do processo não existe] → a conversa abre pelo card do cliente e pelas Transcrições; o botão da página do
  processo abre a mesma janela quando a GGVP-86 chegar. Os campos do processo (data da perícia, fato novo, documento
  citado) ficam nas versões até lá.
- [O histórico geral é da GGVP-99, no PR #18] → as mudanças da conversa vão para o histórico da ficha e para as versões
  de exemplo. Ponta para ligar: cada evento vira uma linha de `GET /api/casos/:id/historico`
  (`EventoDoHistorico`: quem, quando, origem pessoa ou sistema, passo D5.0x, descrição sem dado de saúde) e "Voltar para
  esta versão" passa a ser uma ação com permissão da Sênior na matriz.
- [Gravar de verdade pede o microfone e a OpenAI] → simulados, como na entrevista: a conversa de exemplo é a da Maria
  Exemplo (endereço novo, telefone novo, perícia remarcada, internação e a senha dita em voz alta).
- [A régua geral do lembrete (GGVP-94) não está refinada] → laço da cobrança, num lugar só; trocar quando ela chegar.
- [Ctrl+Z por campo desfaz letra por letra] → o navegador agrupa por palavra; aqui volta cada digitação. Refazer
  (Ctrl+Y) fica com o navegador.
- [A Central não tem login por pessoa] → "Minhas tarefas" filtra pela pessoa do "Trocar perfil"; na junção, pela sessão.

## Migration Plan

Nada a migrar: dado de exemplo no navegador. Desfazer é reverter o PR.
