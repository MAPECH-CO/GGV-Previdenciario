# Design

## Context

- Esta change continua as changes `ggvp-6-recepcao-e-entrevista`, `ggvp-7-abertura-e-documentacao` e `ggvp-13-documentacao-medica`: mesma base de telas, mesmo servidor de exemplo, mesmos clientes. As decisões das `design.md` delas valem aqui (servidor de exemplo em `src/dados/`, regras puras em `src/regras/`, `campos` pelo `src/campos.ts`, catálogos únicos em `src/dados/catalogos.ts`, arquivo comum só com acréscimo, rota nova dentro de `Telas` no `App.tsx`).
- A perícia usa o que a documentação médica deixou: o roteiro por benefício (as perguntas ao médico, `dados/roteiro.ts`), a leitura e a classificação de cada documento que entra (`dados/leitura.ts`, `dados/documentos.ts`), a regra do G20 (`problemaG20` em `regras/parecer.ts`) e o parecer médico (a janela `ParecerMedico`).
- Quem cuida da perícia desde 29/09 (Lucas, áudio e cartões) é o **Jurídico administrativo** (estagiário ou assistente jurídico): marca, sobe o comprovante, decide se pede documento novo, orienta o cliente e registra o comparecimento. O frame DP do Miro já mostra a raia "Jurídico administrativo". O Atendimento saiu da perícia.
- No servidor do Mateus (branch do INSS) o perfil é `juridico_adm` ("Jurídico administrativo", Igor de exemplo), a tabela `pericia` guarda tipo (`medica`, `social`), quem chamou, data, local, comprovante, perito, comparecimento, remarcações e resultado (`favoravel`, `desfavoravel`), e a decisão D2.03 abre a tarefa DP.01 com `perfilDono: 'juridico_adm'`. Os nomes daqui seguem os dele, para a junção.

## Decisions (valem para o épico)

1. **Arquivo novo por assunto.** Regras: `src/regras/pericia.ts`. Servidor de exemplo: `src/dados/pericia.ts` e, para o perito e a jurimetria, `src/dados/peritos.ts`. Telas em `src/paginas/` com o nome do passo. Tipo novo fica no arquivo do assunto.
2. **Arquivo comum só com acréscimo.** Em `servidor.ts` (`pericias?`, `peritos?` e `recusasDoChat?` no fim do `Banco`), `catalogos.ts` (o comprovante da perícia no fim de `TIPOS_DE_DOCUMENTO`), `perfis.ts` (o Jurídico administrativo no fim de `PERFIS`), `tipos.ts` (`processoId?` e `local?` no fim do evento da agenda), `App.tsx` (rotas novas no fim de `Telas`), nas Centrais e na agenda (as tarefas e os eventos da perícia acrescentados no fim). A chave do `sessionStorage` não muda. As linhas fixas da perícia da Maria (`atendimento.ts` t1 e t10, `advogada.ts` a1) saem, e o texto antigo da perícia dela na semente (`exemplo.ts`: "perícia em 02/10", "cobrar o laudo") também: agora nascem da perícia, como a GGVP-20 fez com o Antônio.
   Na agenda, a perícia não ocupa a sala do escritório (`horarioOcupado`) nem vira "confirmar se a entrevista aconteceu" no Atendimento. As pistas dos documentos da avaliação social (CadÚnico, grupo familiar, declarações) entram no fim de `regras/arquivos.ts`. O chat e a janela do Chatwoot assinam com a pessoa do perfil escolhido. Na ficha, a perícia entra como linha a mais do caso, sem esconder a etapa nem a próxima ação do Atendimento.
3. **A perícia nasce por `iniciarPericia`** (`dados/pericia.ts`), com a forma da decisão do Mateus (`POST /api/casos/:id/decisao-pericia` da GGVP-31, D2.03) e do despacho (D3) e do pedido do juiz (D3a). **Ponta para ligar na junção com o INSS:** a GGVP-31, o despacho e o pedido do juiz chamam `iniciarPericia`; a semente faz o papel deles para a Maria, o Pedro e o Antônio. A espera do INSS liberar o agendamento (`D2.E1`) fecha por `liberarAgendamento`, que a vigília do Mateus chama.
4. **Perito e jurimetria de exemplo** (`dados/peritos.ts`): três peritos "(exemplo)", com o perfil formado de laudos de exemplo, sem dado pessoal do cliente. **Ponta para ligar com a GGVP-59** (jurimetria do perito, Mateus, sem refino) e com o acervo: o perito nomeado vem de lá. A contagem e as taxas são código (`jurimetria` em `regras/pericia.ts`), a IA só resume.
5. **Quem faz.** A tela manda o nome e a função da pessoa do perfil escolhido (`usePerfil` de `dados/perfis.ts`), como as telas da documentação médica; sem escolha, a da função da tela. O "Trocar perfil" ganha o Jurídico administrativo (Igor (exemplo)), no fim da lista; o seletor em si não muda. Na junção, `perfis.ts` vira um adaptador do "Entrar como…" do Mateus. O que o sistema faz sozinho grava "Sistema".
6. **Prazos e limites são código com teste (G19)**, em `regras/pericia.ts`: tentativa de marcar diária (`DIAS_ENTRE_TENTATIVAS = 1`, Lucas 02/10); documentos até 10 dias antes da perícia (`DIAS_ANTES_DOCUMENTOS = 10`, Lucas 02/10); preparação até 3 dias antes (`DIAS_ANTES_PREPARO = 3`, Lucas 02/10); lembrete na véspera; limite de remarcações 2 (`LIMITE_DE_REMARCACOES_DA_PERICIA`, parâmetro, sem número no cartão); amostra mínima da jurimetria 10 (`AMOSTRA_MINIMA_DO_PERITO`, Lucas 02/10).
7. **Mensagem ao cliente** pelo Chatwoot simulado, sempre revisada pelo Jurídico antes de sair (Lucas 02/10, Q5): a janela `ConviteChatwoot` ganha os assuntos da perícia.
8. **Dado de saúde por perfil.** O Jurídico (advogada, sênior e Jurídico administrativo, como o `JURIDICO` da matriz do Mateus) vê o que a perícia pede e o parecer; a Documentação vê só o nome dos documentos que faltam. Nada de saúde vai para o histórico.
9. **Portas.** Portal na 5173. Playwright desta sessão: `PORTA_E2E_API=3141` e `PORTA_E2E_WEB=5186`.

## O modelo da perícia (vai para `packages/contratos/pericia.ts`)

```ts
export const TipoDePericia = z.enum(['medica', 'social'])            // perícia médica ou avaliação social
export const Instancia = z.enum(['inss', 'juizo'])
export const OrigemDaPericia = z.enum(['d2-necessidade', 'd2-exigencia', 'd3-despacho', 'd3a-juiz'])

// iniciarPericia: a forma do que a GGVP-31 (D2.03), o despacho (D3) e o pedido do juiz (D3a) mandam.
export const PedidoDePericia = z.object({
  origem: OrigemDaPericia,
  tipo: TipoDePericia,
  instancia: Instancia,
  pedidaPor: z.string(),                         // a advogada, a sênior ou o juízo
  oQuePede: z.string().max(300).optional(),      // quando se sabe (CA3)
  dataDoJuizo: z.object({ data: dataIso, hora: hora, local: z.string() }).optional(),   // D3/D3a: vem da publicação
  peritoLido: z.string().optional(),             // o nome do perito na publicação, quando há
})

export const EventoDaPericia = z.object({ quando: z.string(), quem: z.string(), oQue: z.string(), passo: z.string() })
export const TentativaDeMarcar = z.object({ dia: dataIso, oQueAconteceu: z.string().trim().min(5).max(300), quem: z.string(), quando: z.string() })
export const LidoDoComprovante = z.object({ data: dataIso, hora: hora, local: z.string().min(3), modalidade: z.string(), tipo: TipoDePericia })
export const Marcacao = LidoDoComprovante.extend({
  comprovante: z.string().optional(),            // o nome do PDF; sem ele, a data veio do juízo
  origem: z.enum(['comprovante', 'juizo']),
  registradaEm: z.string(), registradaPor: z.string(),
})

export const Pericia = z.object({
  id: z.string(), processoId: z.string(), fichaId: z.string(),
  tipo: TipoDePericia, instancia: Instancia, origem: OrigemDaPericia,
  pedidaPor: z.string(), pedidaEm: z.string(), abertaEm: z.string(), oQuePede: z.string().optional(),
  liberadaEm: z.string().optional(),             // D2: o INSS liberou o agendamento (D2.E1)
  tentativas: z.array(TentativaDeMarcar),
  remarcacoes: z.number().int().min(0),
  esperaComprovante: z.object({ desde: z.string() }).optional(),   // DP.E1
  marcacao: Marcacao.optional(),
  marcacoesAnteriores: z.array(Marcacao).optional(),               // a troca de data fica (CA8)
  pedeDocumentoNovo: z.boolean().optional(),
  documentos: DocumentosDaPericia.optional(),                     // GGVP-56
  peritoId: z.string().optional(), peritoLido: z.string().optional(),
  orientacao: OrientacaoDaPericia.optional(),                     // GGVP-61
  historico: z.array(EventoDaPericia),
})
```

A situação vem do dado, por `situacaoDaPericia` (`regras/pericia.ts`): `aguardando-inss` → `marcar` → `aguardando-comprovante` → `documentos` → `orientar` → (grupo 2) `presenca`, `comparecimento`, `aguardando-resultado`, `resultado`, `concluida`; e `na-advogada` quando passa do limite de remarcações (G15).

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| (chamado pela GGVP-31, D3 e D3a) | `PedidoDePericia` | `Pericia` | `iniciarPericia` |
| (chamado pela vigília do INSS) | | `Pericia` | `liberarAgendamento` |
| `GET /api/processos/:id/pericia` | | a perícia na tela, na visão do perfil | `obterPericia` |
| `GET /api/tarefas?perfil=juridico_adm` | | as tarefas da perícia de cada perfil | `tarefasDoJuridicoAdm`, `tarefasDaDocumentacaoNaPericia`, `tarefasDaAdvogadaNaPericia` |

## GGVP-49 · Iniciar a tarefa de perícia

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/pericia/aberta` | step_DP.01 `14:534`, com o pedido do Lucas de 02/10 no cartão | "Tarefa de perícia aberta pelo sistema": o que o sistema fez, a próxima ação explicada com o contexto que a IA já sabe, a data em que a tarefa foi aberta, os prazos máximos, "Ver a tarefa aberta"; ao lado, o que veio preenchido (quem pediu, tipo, instância, o que a perícia pede) e "Sem trava"; o histórico de quem abriu e por qual decisão |
| `/juridico-administrativo` | Central de trabalho · Estagiário `2051:173` e chat "perícias para marcar" `2107:892` | A Central do Jurídico administrativo: busca, "Pergunte ou peça" com os atalhos do Figma, "Minhas tarefas" com "Marcar perícia" de cada perícia liberada |
| `/casos/:id/pericia` | Advogada · Processo do cliente · perícia marcada `2179:2`, avaliação social `2179:333`, perícia judicial `2179:664` | A página do processo com a perícia em destaque: cabeçalho, "Ações do processo" (Perícia em andamento), "Resumo da IA", a linha com "O sistema abriu a tarefa de perícia · DP.01", "Perícias", dados do processo, prazos, documentos e ações |
| ficha do cliente (muda) | Caso em andamento `73:351` | O caso mostra "Em perícia" com o diagrama de origem e leva à página do processo da perícia |

### Decisões da história

1. **"Em perícia" ligado ao diagrama de origem** (CA1): `iniciarPericia` muda a etapa do processo para "Em perícia · <origem>" ("pedido ao INSS (D2)", "exigência do INSS (D2)", "despacho da sênior (D3)", "pedido do juiz (D3a)").
2. **No D2 a tarefa espera o INSS** (CA2): a perícia nasce com `liberadaEm` vazio e a página diz "Esperando o INSS liberar o agendamento (D2.E1)"; só com a liberação a tarefa "<nome> · Marcar perícia" entra na Central do Jurídico administrativo. No D3 e no D3a ela nasce liberada.
3. **Preenchido pelo sistema** (CA3): quem pediu, o tipo, a instância e o que a perícia pede, quando se sabe, ficam na perícia e aparecem na tarefa e na tela do passo.
4. **Histórico** (CA4): o primeiro evento da perícia é "Sistema" com a hora e a decisão de origem ("Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de Dra. Paula (exemplo) no pedido ao INSS (D2.03)"). Vai também para o histórico da ficha.
5. **A tela do passo, mais clara** (comentário do Lucas de 02/10): além do quadro do Figma, "O que acontece agora" com o texto da IA (quem faz, o que faz, onde), "Aberta em" e os prazos máximos (marcar: tentativa diária; documentos: até 10 dias antes; preparar o cliente: até 3 dias antes; lembrete na véspera), e o botão até a tarefa.
6. **Semente**: a Maria (perícia médica, pedido ao INSS, liberada hoje), o Pedro (avaliação social pedida na exigência do INSS) e o Antônio (perícia judicial médica, pedida pelo juiz, data e perito lidos da publicação) nascem por `iniciarPericia`. A linha fixa "Decidir perícia" da Maria sai da Central da Advogada.

## GGVP-53 · Marcar a perícia com o cliente

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/pericia/marcar` | step_DP.02 `10:374` | "A tentativa deu certo?" (sim, marcado; não, tentar de novo; marcado, mas o comprovante ainda não saiu), a tentativa sem sucesso com o dia e o que aconteceu, o comprovante do INSS (PDF), "Lido do comprovante · confira" (data, hora, local, modalidade e tipo; "perito não consta no comprovante"), "A perícia pede documento novo?", o aviso do limite (G15), o contato do cliente, "Registrar a perícia" e o feito; ao lado, "Antes de concluir" com as decisões, os campos e as travas |
| chat da Central do Jurídico administrativo | chat: subir comprovante do INSS `2085:2` | O PDF anexado no chat: a IA lê, identifica o cliente e mostra o card "Ação para confirmar" (subir o PDF na pasta, agendar a perícia, dar baixa no passo), com a pergunta do documento novo; nada acontece antes de "Confirmar e marcar" |
| `/agenda` (muda) | Evento da agenda das perícias `2164:513`, `2164:653`, `2164:702` | A perícia marcada entra na categoria "Perícias"; o detalhe tem "Abrir o processo" e o aviso "Remarcar a perícia é com o Jurídico administrativo…" |

### Campos

| Campo | Função |
|---|---|
| A tentativa deu certo? | lista fixa |
| Dia da tentativa | `normalizarData`, `validarData`, `dataParaIso` da biblioteca `campos`; não futura (`regras/formularios.ts`) |
| O que aconteceu | texto, obrigatório, de 5 a 300 letras |
| Comprovante do INSS (PDF) | um arquivo PDF (`problemaDoArquivo` de `regras/arquivos.ts`) |
| Data da perícia (conferida) | `normalizarData`, `validarData`, `dataParaIso`; não passada |
| Hora | `<input type="time">` (a biblioteca `campos` não tem hora, como na agenda) |
| Local | texto, obrigatório, de 3 a 120 letras |
| A perícia pede documento novo? | lista fixa: "Sim: atribuir à Documentação" ou "Não: seguir para ligar e orientar" |

O servidor de exemplo valida de novo com as mesmas regras (`motivoParaNaoRegistrarTentativa`, `motivoParaNaoRegistrarMarcacao`).

### Decisões da história

1. **Tentativa sem sucesso** (CA1): grava o dia, o que aconteceu e quem; a tarefa continua com o Jurídico administrativo e volta no dia seguinte (tentativa diária, Lucas 02/10).
2. **Leitura do comprovante** (CA2, CA3): IA simulada. Uma tabela da semente diz o que está no comprovante da Maria e do Pedro; outro PDF lê a data a partir de hoje. A pessoa confere e pode corrigir data, hora e local antes de registrar. A IA nunca escolhe nem sugere o perito ("perito não consta no comprovante").
3. **Registrar a perícia** (CA2, CA3, CA4): só com a tentativa "deu certo", o comprovante anexado, a leitura conferida e a resposta do documento novo. Registrado: o PDF vai para a pasta do cliente (tipo "Comprovante da perícia (INSS)"), a perícia entra na agenda e na ficha ("Em perícia · perícia médica no INSS em dd/mm, hh:mm"), o lembrete da véspera fica agendado, e "Sim" abre a tarefa da Documentação (GGVP-56).
4. **Espera do comprovante** (CA6, `DP.E1`): "marcado, mas o comprovante ainda não saiu" deixa a tarefa "Subir o comprovante do INSS" esperando, com lembrete diário; ela volta quando o comprovante sobe.
5. **Lembrete da véspera** (CA7): na véspera, a Central do Jurídico administrativo mostra "Enviar lembrete da véspera"; a mensagem (data, hora, local e o que levar) abre no Chatwoot simulado para conferir e enviar (Lucas, Q5). O envio fica na perícia e no histórico.
6. **Troca de data** (CA8): registrar outro comprovante guarda a marcação anterior, reprograma o lembrete e escreve "Data trocada: dd/mm → dd/mm; lembrete reprogramado" no histórico.
7. **Limite de remarcações** (CA9, G15): cada remarcação conta; passou de 2 (parâmetro), a tarefa sai do Jurídico administrativo e vai para a advogada responsável, nunca para a sênior: "Decidir a perícia · limite de remarcações". Ela autoriza mais uma remarcação, com justificativa, na página da perícia.
8. **Judicial** (resposta do Lucas, 02/10): sem comprovante do INSS, a data que vem do juízo é lida e posta na agenda sozinha; a página do processo avisa que o sistema fez isso, e a tarefa seguinte (orientar) diz qual data o sistema marcou e como preparar.
9. **G9**: a tela diz "pelo Meu INSS (senha no cofre)" e não tem campo de senha.

## GGVP-56 · Reunir o que a perícia pede

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/pericia/documentos` | step_DP.03 `10:522` | A lista do que levar pelo tipo (laudos e exames na médica; CadÚnico, grupo familiar e declarações na social), cada item anexado ou faltando, "Anexar" (pela janela "Conferir e enviar", que segue a leitura do D1), "Registrar a falta" com justificativa, "Cobrar", "Pedir ao médico" no laudo; "Conferir" com as conferências; "Concluir" com a trava; o prazo de 10 dias antes da perícia |
| `/casos/:id/pericia/cobranca` | step_DP.03b · Cobrar documento da perícia `10:239` | A cobrança diária do que falta, pela Documentação (Lucas 02/10), com a mensagem no Chatwoot simulado, o contato, o pedido ao médico com o G20, anexar o documento e o limite (10 dias antes; passou, sobe para a advogada responsável, G15) |
| `/` (Central do Atendimento, onde a Documentação trabalha) | Central · Atendimento `11:2` | "Reunir documentos da perícia" e "Cobrar documento da perícia", nascidos da perícia |

### Campos

| Campo | Função |
|---|---|
| Justificativa da falta | texto, obrigatório, de 5 a 300 letras |
| Conferências | caixas de marcar |
| O que o documento deve abordar (pedido ao médico) | texto, até 1000 letras; `problemaG20` recusa CID, diagnóstico, grau, conclusão e frase pronta |

### Decisões da história

1. **O kit é configuração do escritório** (Lucas 02/10: "os kits são exatamente os docs prontos por tipo de processo"): `KIT_DA_PERICIA` em `dados/pericia.ts`. Médica: laudo médico recente (até 30 dias, Figma), exames, receitas e atestados de afastamento. Social: CadÚnico atualizado, ficha de grupo familiar e as declarações (moradia, união estável, separação de fato), que valem para a avaliação social (Lucas, Q3).
2. **Anexado** é o documento do tipo do item que entrou na pasta do cliente depois do pedido; ele sobe pela janela "Conferir e enviar" e segue a mesma leitura da IA do D1 (CA4), com a conferência da Documentação.
3. **Concluir** (CA5, CA6): só com cada item anexado ou com a falta justificada, e as conferências marcadas. Grava quem e quando; o fluxo volta ao Jurídico administrativo: sem o comprovante ainda, "Subir o comprovante do INSS"; com ele, "Orientar para a perícia".
4. **Cobrança** (Lucas 02/10): quem cobra é a Documentação, todo dia, até 10 dias antes da perícia; passou, sobe para a advogada responsável (G15, por ser perícia). O Atendimento só ajuda quando é preciso buscar informação no dia a dia.
5. **Pedido ao médico** (CA7, G20): o texto vem das perguntas do roteiro do benefício (`dados/roteiro.ts`) e passa pela regra do G20 antes de sair.

## GGVP-61 · Orientação da perícia, padrão ou pelo perfil do perito

### Telas e rotas

O passo DP.05 não tem tela própria: o sistema monta a orientação com a IA quando a data é registrada.

| Onde | Figma | O que mostra |
|---|---|---|
| `/casos/:id/pericia` | perícia judicial marcada `2179:664` ("Orientação pelo perfil do perito montada") | No cartão "Perícias", a orientação (padrão ou pelo perfil, com o motivo e a versão do perfil), "Ver a orientação" com o texto, a verificação e a jurimetria do perito (G22); a pergunta de um clique para ligar o perito |
| chat da Central do Jurídico administrativo | dica para a perícia `2186:857` | "Qual a orientação para a perícia do Antônio?": o resumo da orientação, o perito e a tarefa; o pedido para esconder ou mudar a situação é recusado e registrado (G11) |
| janela "Jurimetria do perito" | Overlays · Jurimetria · Perito `2184:2`, `2184:53` | Laudos do acervo, taxa favorável, o que costuma observar, perguntar e pedir; toda porcentagem com o número de laudos e a data da base, e nada vai ao cliente (G22) |

### Decisões da história

1. **Regra unificada** (Lucas 02/10): perito conhecido e com perfil no acervo → orientação pelo perfil, na médica ou na social, no INSS ou no juízo; senão, a padrão, com o motivo registrado ("o comprovante do INSS não traz o perito", "perito sem perfil no acervo", "perito não reconhecido"). `escolherOrientacao` em `regras/pericia.ts`.
2. **A padrão também consulta o acervo** (Lucas 02/10): o acervo geral do benefício e as lições das decisões. Simulado por um texto por tipo de perícia.
3. **O perito vem depois** (Lucas 02/10): a equipe informa quando a informação chega. A página do processo pergunta, em um clique, qual dos peritos da base é; ligado, a orientação é montada de novo pelo perfil, com a versão do perfil usada (CA9). Enquanto isso, nada trava: vale a padrão, e a tela avisa que a jurimetria não foi feita (CA6).
4. **Verificação antes de chegar ao Jurídico** (CA4, CA8, CA10): `problemaDaOrientacao` junta a regra do G20 e a do G11 (esconder, omitir, mudar, simular, fingir, mentir, frase pronta para repetir ao perito). Texto barrado fica "bloqueado, pede revisão" e não vai à tarefa. Há teste com pedidos maliciosos.
5. **O chat recusa** (CA11): pedir no chat uma orientação para esconder ou mudar a situação real é recusado com o G11, e a recusa fica registrada (`recusasDoChat` no servidor de exemplo), em qualquer Central.
6. **Jurimetria** (CA3 [v2] e CA12): os números vêm de `jurimetria` (código), sobre os laudos de exemplo de `dados/peritos.ts`; toda porcentagem com o número de laudos e a data da base, sem amostra mínima (G22 do main, Lucas 06/10 e Pedro 07/10; o mínimo de 10 laudos de 02/10 saiu na junção de 08/10), e os números não entram no texto que vai ao cliente. A recomendação da GGVP-38 fica para quando ela existir.
7. **O que a orientação traz** (CA7): data, local, o que levar e, na social, como é a visita em casa.

## GGVP-62 · Preparar o cliente

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/pericia/orientar` | step_DP.06 `10:405` | O que fazer na ligação, a orientação (padrão ou pelo perfil), a regra de ouro (G11), o que levar, o documento de orientação para conferir, editar e imprimir, "Revisei a orientação", o contato (ligar e WhatsApp), "Enviar orientação" pelo Chatwoot e "Registrar a ligação e a orientação"; o feito com o texto guardado |
| chat da Central do Jurídico administrativo | o cliente ligou `2107:1091` | "O Pedro me ligou. O que eu falo?": a próxima tarefa, a orientação pronta e o atalho "Orientar para a perícia", sem executar nada |

### Decisões da história

1. **Revisar antes** (CA3): "Enviar orientação" e "Registrar a ligação e a orientação" só habilitam com "Revisei a orientação".
2. **O servidor verifica de novo** (CA4, CA6): `enviarOrientacao` passa o texto, editado ou não, por `problemaDaOrientacao`; com problema, recusa e registra a tentativa na perícia (quem, quando e o motivo).
3. **Canal** (CA2, Q5): Chatwoot (simulado, como documento e instrução) ou ligação; o histórico grava a data e o canal; o texto enviado fica guardado na perícia (CA7).
4. **Data ou local mudados** (CA5): o comprovante novo monta a orientação de novo e a preparação anterior deixa de valer: a tarefa "Orientar para a perícia" volta.

## GGVP-66 · Comparecimento e remarcação

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/pericia/comparecimento` | step_DP.07 `1818:289` | Antes da perícia: a confirmação de presença da véspera (confirmou, não confirmou, não vai poder ir: remarcar na hora com o motivo). Depois do dia e da hora: "O cliente compareceu?" (Compareceu, Faltou), a justificativa, o aviso do limite (G15) e "Registrar" |
| `/agenda` (muda) | Evento da agenda das perícias `2164:513` | "Marcar como realizado" abre o registro do comparecimento |

### Decisões da história

1. **Quando dá para registrar** (CA1): depois do dia e da hora da perícia (`periciaJaPassou`, código com teste).
2. **Faltou** (CA2, CA3, CA9) usa a remarcação da GGVP-53: a data sai, volta "Remarcar perícia" e conta no limite (2); passou, sobe para a advogada responsável.
3. **Compareceu** (CA5): espera o resultado (`DP.E3`, `DP.E4`) e a advogada recebe "Conferir resultado da perícia" (GGVP-70).
4. **Alertas** (CA6, CA8): no dia seguinte sem registro, a tarefa fica "atrasada" e diz que falta registrar; sem a presença confirmada até as 16h da véspera (`HORA_DA_CONFIRMACAO`, parâmetro: o cartão diz "a definir"), a tarefa vira "presença não confirmada: contatar o cliente".

## GGVP-70 · Conferir o resultado e decidir o próximo passo

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/pericia/resultado` | step_DP.08 `14:556` e Resultado da perícia `1579:431` | Anexar o laudo ou o registro do GERID, o resumo do laudo pela IA (conclusão, coerência com o pedido, jurimetria do perito, ponto de atenção), "Favorável — seguir" ou "Desfavorável — avaliar nova perícia", a indicação da IA no desfavorável, "vale pedir nova perícia?", as conferências, "Registrar resultado", quesitos e impugnação (peças da IA, de outra história); ao lado, as decisões, as travas e como segue |
| `/advogada` (muda) | Central · Advogada `59:449`, chats `2107:667` e `2186:2` | "Conferir resultado da perícia"; o chat responde "perícias da semana" (cada item abre a página do processo) e "como o perito avalia" |
| `/casos/:id/pericia` (muda) | Processo do cliente · resultado da perícia `1579:117` | O resultado no card e na linha; o prazo de 15 dias para manifestar no judicial (G12) |

### Decisões da história

1. **O resultado sai** (CA1): depois do "Compareceu", a advogada já tem a tarefa, esperando o GERID; `resultadoNoGerid` (ponta para a vigília do GERID do Mateus) a deixa urgente. Anexar o laudo na tela também conta como resultado disponível.
2. **IA simulada**: o resumo do laudo sai do nome do arquivo ("desfavoravel" faz o laudo desfavorável); no desfavorável, a IA diz por que e indica se vale nova perícia (Lucas, 02/10): a indicação vai para o histórico; o porquê, que vem do laudo, fica no resumo do laudo, só com o Jurídico (saúde simples, Pedro, 08/10). A advogada decide.
3. **Conferências** (CA5 e a resposta "segue dessa forma"): "Li o laudo na íntegra", o parecer médico "Suficiente" (G17), a DII calculada por código (G19) e sem contradição com o benefício (G18), todas marcadas.
4. **Volta à origem** (CA2, CA4, CA6): a perícia fecha e o histórico diz como o diagrama de origem segue (pedido ao INSS: completa a junção antes da vigília; exigência do INSS: volta à vigília D2.04; despacho ou juiz: volta ao judicial, com 15 dias para manifestar, G12). **Ponta para ligar na junção com o INSS**: `avancarJuncaoD2` e `avancarExigencia` do Mateus.
5. **Nova perícia** (CA3): a perícia recomeça para o Jurídico administrativo marcar, sem contar como remarcação.

## GGVP-73 · Atualizar o perfil do perito

Sem tela própria (DP.09 é passo da IA). Aparece no feito do resultado, na janela da jurimetria (`2184:2`, com o histórico do perfil) e na pergunta de um clique.

### Decisões da história

1. **Ao registrar o resultado com laudo** (CA1, CA2): a IA extrai o que o perito observou, perguntou e pediu (simulado por tipo de perícia) e acrescenta um laudo ao perfil, com a referência do caso no acervo, sem nome nem CPF (CA4). Médica e social (Lucas, 02/10).
2. **Um laudo, um registro** (CA3, CA5): o perfil é a lista de laudos; a versão é quantos laudos o formam. O mesmo laudo da mesma perícia não entra duas vezes.
3. **Perito não reconhecido** (CA6): o laudo fica guardado na perícia, fora das contas, até a pergunta de um clique ligar o perito; aí entra no perfil.
4. **Os números são código** (CA7): `jurimetria`; a semente dos peritos só vai para o armazenamento da aba quando um laudo novo muda um perfil.

## Decisões tomadas no código do grupo 2

1. **Orientar (GGVP-62)**: editar o texto desmarca "Revisei a orientação". A tela avisa quando o texto vai ser recusado, mas deixa o envio chegar ao servidor, para a tentativa ficar registrada (CA6). O "WhatsApp" do contato envia o mesmo documento pelo Chatwoot. A tarefa sai da Central depois da hora da perícia.
2. **Comparecimento (GGVP-66)**: a confirmação de presença e o comparecimento ficam na marcação; data nova, confirmação nova. "Não consegui confirmar" registra a tentativa e a tarefa segue na Central até confirmar ou a perícia passar. "Faltou" usa a mesma remarcação da GGVP-53.
3. **Resultado (GGVP-70)**: na avaliação social, as conferências são "Li o laudo na íntegra" e a contradição com o benefício (G18); o parecer médico (G17) e a DII (G19) ficam para a perícia médica. O laudo vai para a pasta como "Laudo da perícia". O prazo para manifestar (G12) conta 15 dias corridos do registro. "Perícias da semana" são as marcadas de hoje a seis dias. Quesitos, impugnação e manifestação aparecem desabilitados: são peças da IA de outra história (G6). O chat da advogada usa o mesmo componente do chat do Jurídico administrativo.
4. **Perfil do perito (GGVP-73)**: a referência do caso no perfil é o número do processo (sem ele, `caso-n`), nunca o nome do cliente. O assunto do laudo é simulado pelo tipo (médica: coluna; social: renda familiar). A IA pode rodar de novo sobre o mesmo laudo sem duplicar (`atualizarPerfilComOLaudo`).

## A perícia anda de verdade no servidor (GGVP-137, varredura de 09/10)

1. **Endereços**: a decisão da advogada (D2.03) fica em `/casos/:id/pericia/decidir`; `/casos/:id/pericia` é a página da perícia para todos, também no caso do servidor. A tarefa que o sistema abre (DP.01) leva à tela de marcar; na Central do Jurídico administrativo, quando a perícia já calcula a tarefa de marcar, a do sistema sai (fica uma).
2. **Liberação do INSS (D2.E1)**: o Jurídico administrativo, que acompanha o Meu INSS, registra na tela de marcar ("O INSS liberou o agendamento").
3. **Anexar (DP.03)**: no caso do servidor, o documento sobe por `POST /api/processos/:id/pericia/documentos` (multipart: `dados` com o item e o arquivo, PDF ou imagem), vai à pasta do caso com o tipo do item (sensível na perícia médica) e o item fica anexado.
4. **Cofre (G9)**: a tela de marcar tem o "Ver a senha do gov.br" da tela do protocolo, enquanto há o que marcar; o servidor aceita a tarefa DP.01 e, na remarcação (sem linha na tabela de tarefas), a perícia para marcar.
5. **Data do juízo (D3a)**: o servidor lê data, hora e local da frase que nomeia a perícia daquele tipo ("perícia médica"; "perícia social", "avaliação social" ou "estudo social") na publicação da exigência do juiz (`dataDoJuizoNaPublicacao`, código com teste). Só "perícia" não basta: "laudo pericial" não é a perícia, e com as duas na mesma publicação cada uma fica com a sua data. Com a data de todas as perícias pedidas, elas nascem na agenda e a tarefa de marcar daquela exigência fecha pelo sistema; faltando uma, fica aberta.
6. **Data do juízo registrada**: sem data lida (a publicação fora do formato do diário, ou a perícia do despacho), a tela de marcar diz que a data ainda não saiu e o Jurídico administrativo registra a data, a hora e o local (`POST /api/processos/:id/pericia/data-do-juizo`; o servidor confere de novo, a data não pode ser passada). Vai à agenda e à ficha como a lida, com o lembrete e a orientação; sem o fluxo do comprovante do INSS. A tarefa de marcar do sistema fecha quando nenhuma perícia do caso fica para marcar.
7. **Saúde simples na tela**: `doJuridico` segue `dado_saude.ver_detalhe` (advogada, sênior e Jurídico administrativo), como o servidor; registrar parecer e dado de saúde segue com a advogada e a sênior (`registraSaude`). Na linha do tempo da deficiência, no parecer e no cartão da criança, o Jurídico administrativo vê o conteúdo só para ler: sem os campos de conferir nem os botões de salvar e registrar.
