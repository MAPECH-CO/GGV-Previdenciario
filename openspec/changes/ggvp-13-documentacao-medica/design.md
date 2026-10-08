# Design

## Context

- Esta change continua as changes `ggvp-6-recepcao-e-entrevista` e `ggvp-7-abertura-e-documentacao`: mesma base de telas, mesmo servidor de exemplo, mesmos clientes. As decisões das `design.md` delas valem aqui (servidor de exemplo em `src/dados/`, regras puras em `src/regras/`, `campos` pelo `src/campos.ts`, catálogos únicos em `src/dados/catalogos.ts`, arquivo comum só com acréscimo).
- As pontas que a Recepção e a Abertura deixaram para cá: o laudo novo que espera a análise (GGVP-17, `dados/documentos.ts`), a leitura que separa documento médico (GGVP-81, `dados/leitura.ts`), o parecer "de exemplo, até a GGVP-20" da liberação (GGVP-18, `dados/liberacao.ts`) e o roteiro em `docs/requisitos/roteiro-laudos.md`.
- O main trouxe o monorepo e o login: toda tela passa pela sessão. O usuário de exemplo é do Atendimento; as outras funções se veem pelo "Trocar perfil" (`dados/perfis.ts`), como nas telas anteriores.

## Decisions (valem para o épico)

1. **Arquivo novo por assunto.** Roteiro: `src/regras/roteiro.ts` e `src/dados/roteiro.ts`. Parecer e portão: `src/regras/parecer.ts` e `src/dados/parecer.ts`. Complemento: `src/dados/complemento.ts`. Tipo novo fica no arquivo do assunto.
2. **Arquivo comum só com acréscimo.** Em `servidor.ts` (tipo `Banco`), `exemplo.ts`, `tipos.ts`, `catalogos.ts`, `perfis.ts`, `App.tsx` e nas Centrais: acrescentar no fim, sem reordenar nem reformatar. Campo novo no `Banco` é opcional (`roteiros?`, `pareceres?`, `complementos?`) e a chave do `sessionStorage` não muda. Rota nova vai dentro de `Telas`, depois da conferência de sessão.
3. **Dado de saúde por perfil.** Conteúdo clínico (trecho, página, CID, texto do laudo, a comparação) só para o Jurídico: advogada e sênior. Atendimento e Documentação veem que o documento existe (tipo, data, emitente), o resultado do parecer e o que falta pedir, em linguagem simples. O servidor de exemplo devolve a visão de cada perfil (`visao: 'juridico' | 'atendimento'`); ao ligar no servidor, o perfil vem da sessão. Nada de saúde vai para o histórico: só o que aconteceu.
4. **A IA sugere, a pessoa decide.** A análise da IA é sempre "sugerida"; o parecer só vale com o registro de uma pessoa do Jurídico (G17). A IA nunca sugere diagnóstico, CID, grau nem conclusão (G20). IA simulada por tabelas da semente e, no que sobe pelo card, por pistas no nome do arquivo, como a GGVP-17 e a GGVP-81 já fazem.
5. **Quem fez.** A tela manda o nome da pessoa da sessão (`usePerfil`, desde a junção com o `main` em 08/10 um adaptador do login: o perfil ativo e o nome de quem entrou). O "Trocar perfil" de exemplo saiu; vale o "Entrar como…" da GGVP-96. Sem sessão, só nos testes de uma tela sozinha, vale a função da tela.
6. **Portas.** Portal na 5173. Playwright desta sessão: `PORTA_E2E_API=3193` e `PORTA_E2E_WEB=5193`, para não pegar a porta de outra sessão.

## GGVP-93 · Roteiro de conteúdo mínimo por benefício

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/roteiros` | sem quadro próprio; visual das telas de passo | Lista dos roteiros, com os benefícios de cada um, a versão em vigor e "sem laudo" quando é régua documental |
| `/roteiros/:id` | sem quadro próprio; o roteiro aplicado aparece no Parecer médico `1654:2` e no step_D1.21M `14:195` | Itens por tipo (obrigatório, contradição que bloqueia, complementar) com o texto do escritório; "Editar" só para a sênior; "Salvar nova versão"; as versões anteriores com autor e data |

Quem não é do Jurídico não vê o roteiro: a tela diz que ele é do Jurídico e que o que falta pedir aparece no parecer.

### Contrato (vai para `packages/contratos/roteiros.ts`)

```ts
export const TipoDoItem = z.enum(['obrigatorio', 'contradicao', 'complementar'])
export const ItemDoRoteiro = z.object({
  id: z.string(),
  tipo: TipoDoItem,
  texto: z.string().trim().min(3).max(300),
  pergunta: z.string().trim().max(300).optional(),   // como o item vira pergunta ao médico (GGVP-29, G20)
})
export const VersaoDoRoteiro = z.object({ versao: z.number().int().positive(), autor: z.string(), quando: z.string(), itens: z.array(ItemDoRoteiro).min(1) })
export const Roteiro = z.object({
  id: z.string(), nome: z.string(),
  beneficios: z.array(z.enum(BENEFICIOS)).min(1),
  laudo: z.boolean(),                                 // false: régua documental, sem laudo
  versoes: z.array(VersaoDoRoteiro).min(1),           // a última é a que vale
})
export const EdicaoDoRoteiro = z.object({ itens: z.array(ItemDoRoteiro).min(1) })   // pelo menos um obrigatório
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/roteiros` | | `Roteiro[]` | `obterRoteiros` |
| `GET /api/roteiros/:id` | | `Roteiro` | `obterRoteiro` |
| `POST /api/roteiros/:id/versoes` | `EdicaoDoRoteiro` | `Roteiro` | `salvarRoteiro` |

### Campos

| Campo | Regra |
|---|---|
| Tipo do item | lista fixa: obrigatório, contradição que bloqueia, complementar |
| Texto do item | texto, obrigatório, de 3 a 300 letras |
| Pergunta ao médico | texto, até 300 letras; checada pela regra do G20 na GGVP-29 |

Nenhum campo da biblioteca `campos` (não há CPF, data nem número aqui). O servidor de exemplo valida de novo com `motivoParaNaoSalvar`.

### Decisões da história

1. **A semente** vem da matriz de `docs/requisitos/roteiro-laudos.md` (PDF do escritório, 26/09) para os cinco benefícios com laudo, e da resposta do Lucas de 01/10 (Q18) para LOAS Idoso (socioeconômico), aposentadorias comuns e especial (régua documental, sem laudo), Curatela e Isenção de IR. A checagem de gastos entra também no LOAS Deficiente, como complementar (Lucas, 01/10).
2. **Um roteiro, vários benefícios.** A Aposentadoria PCD vale por contribuição e por idade; a Incapacidade Permanente, também para a acidentária. Benefício fora de todo roteiro é "sem roteiro" (CA3).
3. **Versão.** Salvar cria a versão seguinte com autor e data; nada é sobrescrito. A análise e o parecer guardam o número da versão usada, e mostram essa, não a de agora (CA2, CA4).
4. **Pergunta ao médico** fica no item, para o sênior ajustar junto com a régua. A orientação ao médico (GGVP-29) é montada com elas.
5. **Frases-chave**: o texto do item é para reconhecer no documento se o requisito foi atendido, nunca para ditar ao médico (G20). Por isso a orientação usa a pergunta, não o texto do item.

## GGVP-95 · Classificar cada documento médico que entra

### Telas e rotas

| Rota | Figma | O que muda |
|---|---|---|
| `/clientes/:id/conferir-documentos` | step_D1.18 `10:466` | O documento médico mostra o tipo, a data de emissão, o emitente e o registro profissional (CRM ou outro), sem o conteúdo; "Reclassificar" corrige o tipo e a correção vai para o histórico; o ilegível aparece à parte, com a pendência do Atendimento |
| `/` (Central do Atendimento) | Central · Atendimento `11:2` | Tarefa "Pedir documento legível" para cada documento cuja leitura falhou |

### Contrato (acrescenta ao de `packages/contratos/documentos.ts` da GGVP-81)

```ts
// Os tipos médicos entram no fim do catálogo único (TIPOS_DE_DOCUMENTO):
// atestado, relatorio-medico, exame, cat, boletim-ocorrencia, relatorio-escolar, relatorio-terapia
// (laudo, receita e prontuario já existiam).
export const SituacaoDoLido = z.enum(['a-conferir', 'quarentena', 'arquivado', 'descartado', 'movido', 'ilegivel'])
export const DocumentoLido = DocumentoLidoGgvp81.extend({
  emitente: z.string().max(120).optional(),       // nome do médico ou do serviço, se constar (CA1)
  registro: z.string().max(40).optional(),        // CRM, CRP, CREFITO..., se constar (CA1)
  sugerido: z.string().optional(),                // o tipo que a IA sugeriu, guardado depois da correção (CA2)
})
export const Conferencia = ConferenciaGgvp81.extend({ ilegiveis: z.array(DocumentoLido) })   // CA3
```

Sem endpoint novo: `GET /api/fichas/:id/documentos-lidos` e `POST .../arquivar` (GGVP-81) passam a levar esses campos.

### Decisões da história

1. **Documento médico** (`TIPOS_MEDICOS` em `regras/leitura.ts`): laudo, receita, prontuário e os sete novos. Nunca é descartado (GGVP-81, CA16) e o conteúdo não aparece na tela da Documentação: só tipo, data, emitente e registro. O resto vai para a análise do Jurídico (GGVP-20).
2. **Data de emissão** é a `data` que a leitura já tinha; emitente e registro são campos novos da leitura. A IA simulada lê de uma tabela da semente (o laudo da pilha da Rita) ou põe um emitente de exemplo no que sobe pelo card.
3. **Correção** (CA2): ao arquivar, o tipo que a pessoa escolheu vale; o sugerido fica guardado e o histórico da ficha diz "Corrigiu a classificação: <sugerido> → <escolhido>". Sem o conteúdo do documento.
4. **Ilegível** (CA3): a leitura que falha deixa o documento como "ilegível", fora da conferência e do checklist, com o original guardado. O Atendimento recebe "Pedir documento legível"; a tarefa sai sozinha quando chega, para a mesma ficha, um documento legível do mesmo tipo. A IA simulada marca ilegível pela pista "ilegivel" no nome do arquivo.
5. **Laudo novo pelo card** (CA4) já passa pela mesma leitura (a GGVP-17 marca `aguardaLeitura`); a comparação com o processo é da GGVP-20, que liga a tarefa "Analisar laudo novo" à tela dela.
6. **Pistas do tipo** (`regras/arquivos.ts`): atestado, relatório médico, exame, CAT, boletim de ocorrência, relatório escolar e de terapia ganham pista própria; antes, atestado virava laudo.
7. CA5 a CA10 já valem desde a GGVP-81 e a GGVP-91 (dono identificado, confiança, duplicado, mesma leitura, original guardado, checklist recalculado): a spec repete o critério e os testes provam com documento médico.

## GGVP-20 · Parecer de suficiência da documentação médica

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/laudo-novo` | Laudo novo · resumo e comparação da IA `2087:2` | O resumo da IA, a comparação com o último laudo (o que mudou em destaque), o que o laudo novo passa a cobrir diante do roteiro e o que ainda falta, e "Ir para o parecer" |
| `/casos/:id/parecer` | step_D1.21M `14:195` | O laudo novo, a matriz do roteiro item a item (presente, ausente ou contraditório, com o documento, a página e o trecho), a conferência de cada item, "Suficiente — liberar" ou "Insuficiente — pedir complemento", o campo "o que o documento deve abordar" já sugerido pela IA (G20), "Registrar parecer" e o histórico do parecer |
| janela sobre as telas de passo | Overlay · Parecer médico `1654:2` | O resultado, quem confirmou e quando, os documentos analisados e o roteiro aplicado; para Atendimento e Documentação, só o resultado, os documentos e o que falta pedir |
| `/advogada` (muda) | Central · Advogada `59:449` | "Analisar laudo novo" e "Dar parecer médico" nascem do caso, no lugar da linha fixa |

O "Parecer médico" das instruções das telas de passo (conferir documento, checklist, cobrança, liberar) e o "Abrir ›" da liberação passam a abrir a janela. A ficha do cliente (visão do Atendimento) mostra em "Documentação médica" o resultado e quem confirmou, sem o conteúdo.

### Contrato (vai para `packages/contratos/pareceres.ts`)

```ts
export const SituacaoDoItem = z.enum(['presente', 'ausente', 'contraditorio'])
export const Evidencia = z.object({ documentoId: z.string(), documento: z.string(), pagina: z.number().int().positive(), trecho: z.string() })  // só Jurídico
export const ItemAnalisado = z.object({ id: z.string(), tipo: z.enum(['obrigatorio', 'contradicao']), texto: z.string(), pergunta: z.string().optional(),
  situacao: SituacaoDoItem, evidencia: Evidencia.optional() })
export const AnaliseDaIA = z.object({
  quando: z.string(), roteiro: z.object({ id: z.string(), nome: z.string(), versao: z.number() }).optional(),   // sem roteiro: conferência manual (GGVP-93, CA3)
  documentos: z.array(DocumentoAnalisado), itens: z.array(ItemAnalisado),
  sugestao: z.enum(['suficiente', 'insuficiente', 'contraditorio', 'sem-roteiro']),
  mudou: z.array(z.string()),                                      // CA4: o que mudou desde a análise anterior
})
export const RegistroDoParecer = z.object({
  decisao: z.enum(['suficiente', 'insuficiente']),
  itens: z.array(z.object({ id: z.string(), situacao: SituacaoDoItem })),   // a conferência de cada item (CA3)
  abordar: z.string().trim().max(1000).optional(),                 // obrigatório no Insuficiente e no Contraditório; regra do G20 (CA8)
  conferenciaManual: z.string().trim().max(1000).optional(),       // obrigatório sem roteiro (GGVP-93, CA3)
})
// Resposta: o parecer do caso na visão do perfil da sessão (o Atendimento não recebe trecho, página, resumo nem comparação).
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/processos/:id/parecer` | | parecer do caso na visão do perfil | `obterParecer` |
| `POST /api/processos/:id/parecer` | `RegistroDoParecer` | parecer do caso | `registrarParecer` |

### Campos

| Campo | Regra |
|---|---|
| Conferência de cada item | lista fixa: confere com a IA, ou corrige para presente, ausente ou contraditório |
| A documentação médica é suficiente? | "Suficiente — liberar" ou "Insuficiente — pedir complemento"; com contradição conferida, só "Insuficiente", e o parecer fica "Contraditório" (G18) |
| O que o documento deve abordar | texto, obrigatório no Insuficiente, até 1000 letras; `problemaG20` recusa código de CID, "diagnóstico", grau, conclusão, aspas e "escreva que" |
| O que você conferiu (sem roteiro) | texto, obrigatório, de 10 a 1000 letras |

Nenhum campo da biblioteca `campos`. O servidor de exemplo valida de novo com as mesmas regras de `regras/parecer.ts`.

### Decisões da história

1. **A análise é calculada dos documentos médicos do caso** (os lidos pela GGVP-95, a conferir ou arquivados, fora a quarentena e o ilegível, mais os da semente do Sebastião e do Antônio). Quando o conjunto muda, nasce uma análise nova com o roteiro em vigor e "o que mudou" (CA4, GGVP-93 CA4). A análise guarda o texto dos itens e a versão do roteiro: o caso analisado mostra a versão que usou (GGVP-93 CA2).
2. **IA simulada.** Tabelas da semente dizem o que cada documento cobre (o laudo da Rita cobre três dos cinco itens do LOAS; os do Sebastião, todos; os do Antônio, todos, com o laudo novo de 29/09 do Figma `2087:2`). Laudo, relatório e prontuário que sobem pelo card cobrem todo item obrigatório, salvo pistas no nome: "incapacidade total", "nao consolidada" e "temporaria" acham a contradição do roteiro; "incompleto" não cobre nada. Atestado, exame e os outros não cobrem item obrigatório.
3. **Regra numérica do LOAS** (contradição "menos de 24 meses", G19): `mesesEntre` e `abaixoDe24Meses` em `regras/parecer.ts`, com teste; a IA só extrai as datas.
4. **A IA sugere, a advogada registra.** Sem registro, o portão vê "pendente" (sem confirmação humana). O registro exige cada item conferido; "Suficiente" só com todo obrigatório presente e nenhuma contradição; com contradição conferida, o parecer é "Contraditório" (G18). Quem registra é a pessoa do perfil (Dra. Paula na semente), com a data (CA3).
5. **Insuficiente e Contraditório abrem a pendência de complemento** (CA5): o registro guarda "o que o documento deve abordar", já sugerido pela IA com as perguntas do roteiro para os itens ausentes (resposta do Lucas, 01/10, na GGVP-29) e, na contradição, os documentos complementares. A tela e o laço do complemento são da GGVP-29.
6. **Laudo novo** (CA6): a ficha e o processo mostram "Laudo novo" até o registro do parecer, que limpa a marca e conclui a tarefa "Analisar laudo novo". A comparação usa o último laudo antes dele; o resumo diz o que o laudo novo passa a cobrir e o que ainda falta (resposta do Lucas, 01/10). A IA só compara o que está nos documentos: não sugere CID, grau nem conclusão (CA7).
7. **O parecer de exemplo da liberação sai.** `PARECERES_DE_EXEMPLO` (GGVP-18) dá lugar ao registro de verdade do servidor de exemplo: o Sebastião (Suficiente, Dra. Paula, 15/07, Figma `1654:2`) e o Antônio (Suficiente em 20/09, com o laudo novo de 29/09 esperando) vêm da semente; a Rita passa a depender do parecer da advogada.
8. **Tarefas da advogada** nascem do caso: "Analisar laudo novo" (laudo novo esperando) e "Dar parecer médico" (análise mais nova que o último registro). A linha fixa do Antônio sai de `advogada.ts`; a tarefa que o envio pelo card cria (GGVP-17) passa a abrir a tela do laudo novo.

## GGVP-29 · Pedir o complemento ao médico do cliente

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/complemento` | sem quadro próprio; no visual de "Cobrar documento · pendentes do checklist" `2106:3` | O resultado do parecer (sem conteúdo clínico), a orientação ao médico com as perguntas do que falta e o que a advogada confirmou, "Imprimir a orientação", o contato com "Ligar" e "Chatwoot", "Enviar orientação" (Chatwoot simulado, conta como tentativa), as tentativas e o próximo lembrete, o limite (G15), "Anexar o documento recebido" (sobe como laudo novo), a prévia da IA sobre o documento novo e, para a sênior no limite, "Nova tentativa com prazo" |
| `/` (Central do Atendimento) | Central · Atendimento `11:2` | "Pedir complemento ao médico" com a tentativa e o próximo lembrete |
| `/advogada` (Central da Advogada) | Central · Advogada `59:449` | "Decidir complemento" quando passa do limite |

### Contrato (acrescenta a `packages/contratos/pareceres.ts`)

```ts
export const Complemento = z.object({
  processoId: z.string(), fichaId: z.string(), abertaEm: z.string(),
  parecer: z.enum(['insuficiente', 'contraditorio']),
  abordar: z.string(), perguntas: z.array(z.string()), quem: z.string(),
  tentativas: z.array(TentativaDeCobranca), decisoes: z.array(DecisaoDaSenior),   // o laço da GGVP-101 (G15)
  prazo: PrazoExterno.optional(),                                                 // o prazo do juiz ou do INSS do caso
  encerrado: z.object({ quando: z.string(), porque: z.literal('parecer-suficiente') }).optional(),
})
export const TentativaDoComplemento = z.object({ canal: z.enum(['chatwoot', 'ligacao']), resultado: z.enum(['sem-resposta', 'respondeu']) })
export const DecisaoDoComplemento = z.object({ justificativa: z.string().trim().min(5), prazo: dataIso })  // nova tentativa da sênior
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/processos/:id/complemento` | | o complemento na visão do Atendimento | `obterComplemento` |
| `POST /api/processos/:id/complemento/tentativas` | `TentativaDoComplemento` | o complemento | `registrarTentativaDoComplemento` |
| `POST /api/processos/:id/complemento/decisoes` | `DecisaoDoComplemento` | o complemento | `decidirComplemento` |

### Campos

| Campo | Função |
|---|---|
| Como foi a ligação | lista fixa: atendeu ou não atendeu |
| Novo prazo (sênior) | `normalizarData`, `dataParaIso` da biblioteca `campos`; depois de hoje (`motivoParaNaoDecidir` da GGVP-101) |
| Justificativa (sênior) | texto, obrigatório |

### Decisões da história

1. **Quem escreve a orientação**: a IA sugere no parecer e a advogada confirma (resposta do Lucas, 01/10, Q1). A tela do Atendimento só mostra e envia; não edita o texto. A orientação usa as perguntas do roteiro, nunca o texto do item (as frases-chave), e passa pela regra do G20 (CA2).
2. **O laço é o da cobrança (GGVP-101)**: 2 tentativas, 3 dias entre elas, lembrete e, no limite, a sênior. Com prazo do juiz ou do INSS no caso (a cobrança aberta do processo), o limite é esse prazo e a tarefa fica urgente (resposta do Lucas, Q2). O limite sem prazo externo segue o da cobrança até o refinamento da régua geral (GGVP-94).
3. **A pendência é uma só** (Q4): o parecer novo Insuficiente atualiza o que pedir; o Suficiente encerra (GGVP-20). O documento novo sobe pelo card como laudo novo (D1.02) e vai à comparação; a tela mostra ao Atendimento a prévia da IA (o que o documento novo responde e o que ainda falta, em perguntas), sem o conteúdo clínico. A palavra final é da advogada (G17).
4. **A sênior no limite** decide uma nova tentativa com prazo ou a dispensa do parecer (GGVP-33).

## GGVP-33 · Portão: sem parecer, o caso não anda

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/parecer/dispensa` | sem quadro da dispensa; visual das telas de passo e o aviso do Parecer médico `1654:2` ("Só a sênior dispensa o parecer, com justificativa") | A situação do parecer, a justificativa obrigatória, "Pedir a dispensa (1ª sênior)", "Aprovar a dispensa (2ª sênior)" ou "Recusar" para outra sênior, e o feito com as duas aprovações |
| `/casos/:id/liberar` (muda) | step_D1.24 `10:264` | O item "Parecer médico" diz o que falta (Insuficiente, Contraditório ou sem confirmação humana) ou a dispensa com as duas sêniores |
| janela do Parecer médico (muda) | `1654:2` | Para a sênior, "Dispensar o parecer"; a dispensa aprovada aparece com a justificativa |
| `/advogada` (muda) | Central · Advogada `59:449` | "Aprovar dispensa do parecer" para a segunda sênior |
| chat das Centrais (muda) | "Pergunte ou peça" | Pedido para pular o parecer é recusado, com o portão que falta |

### Contrato (acrescenta a `packages/contratos/pareceres.ts`)

```ts
export const AcaoDoPortao = z.enum(['liberar', 'aprovar-inss', 'pedir-peticao'])   // D1.24, D2.01, D3.05
export const Dispensa = z.object({
  justificativa: z.string().trim().min(10).max(1000),
  pedidaPor: z.string(), pedidaEm: z.string(),                 // 1ª sênior
  aprovadaPor: z.string().optional(), aprovadaEm: z.string().optional(),   // 2ª sênior, outra pessoa
  recusadaPor: z.string().optional(), recusadaEm: z.string().optional(),
})
// O Parecer do portão ganha a situação "dispensado".
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/processos/:id/parecer/dispensa` | `{ justificativa }` | parecer do caso | `pedirDispensa` |
| `POST /api/processos/:id/parecer/dispensa/aprovacao` | `{ aprova: boolean }` | parecer do caso | `responderDispensa` |

### Campos

| Campo | Regra |
|---|---|
| Justificativa | texto, obrigatório, de 10 a 1000 letras |

### Regras em comum com o servidor (junção de 08/10)

- **24 meses do LOAS**: a conta (`mesesEntre`) e o mínimo (`MESES_LOAS`) estão em `@ggv/contratos`; a tela (`regras/parecer.ts`) e a regra `loas_24_meses` do servidor (GGVP-25) importam de lá.
- **Tempo com deficiência (PCD)**: a tela calcula a linha do tempo com o grau e a conversão (`regras/deficiencia.ts`); o servidor tem a regra `periodos_pcd`, só com o tempo na condição. As duas contam cada dia uma vez quando dois vínculos correm juntos (decisão do Pedro, 08/10). Ao ligar no servidor (GGVP-125), a conversão por grau e o mínimo de 15 anos (Lucas, 07/10) passam para a regra do servidor, e a tela chama `/api/regras/periodos_pcd`.

### Decisões da história

1. **A regra do portão é uma só** (`travaDoParecer` em `@ggv/contratos`, da GGVP-109; `regras/liberacao.ts` só traduz o benefício da tela para o catálogo do servidor e acrescenta a sugestão de troca do Auxílio-Acidente) e vale para as três ações: liberar ao Jurídico (D1.24, esta change), aprovar para o INSS (D2.01, GGVP-23) e pedir a petição (D3.05, GGVP-63). As telas do D2.01 e do D3.05 são dessas histórias; elas chamam a mesma regra. A validação no servidor contra chamada direta é da GGVP-109.
2. **Duas sêniores** (resposta do Lucas de 01/10, Q14): a primeira pede com a justificativa, a segunda, outra pessoa, aprova ou recusa. As duas aprovações e a justificativa ficam no histórico da ficha e na janela do parecer. O painel de indicadores (GGVP-75) não existe ainda: a dispensa fica registrada para ele ler.
3. **Quem é a sênior**: vem da sessão. Os usuários de exemplo têm duas sêniores (Helena e Otávio), para a segunda aprovação ser de outra pessoa. A dispensa esperando a segunda sênior e o complemento a decidir aparecem na tela inicial da Sênior, não na Central da Advogada.
4. **O parecer novo manda** (CA5): a dispensa vale até um parecer registrado depois dela; o portão sempre olha o registro ou a dispensa mais nova.
5. **O chat recusa** (CA3): o pedido para pular, dispensar ou ignorar o parecer não vira ação: o chat responde que falta o parecer "Suficiente" confirmado por pessoa (G17) e que só duas sêniores dispensam, na tela do parecer. Sem card de confirmação.

## GGVP-42 · Aposentadoria PCD: linha do tempo da deficiência

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/deficiencia` | sem quadro da linha do tempo; o mais próximo é a exigência do INSS da Aposentadoria PCD (`1581:764` e `1581:418`, "grau moderado · 20 anos · calculado por código (G19)") e o step_D1.13 `14:159` | Os dados da deficiência (início, grau, agravamentos, sexo para a contagem), a linha do tempo com cada vínculo do CNIS partido em "sem deficiência" e "com deficiência" por grau, o indicador PCD e a insalubridade do CNIS, os documentos da época de cada período e "sem prova da época" em cor de ação, e o enquadramento (grau preponderante, tempo convertido, mínimo e o que falta) calculado por código |
| `/casos/:id/parecer` (muda) | step_D1.21M `14:195` | Na Aposentadoria PCD, a linha do enquadramento com o atalho para a linha do tempo |

### Contrato (vai para `packages/contratos/deficiencia.ts`)

```ts
export const Grau = z.enum(['leve', 'moderada', 'grave'])
export const DadosDaDeficiencia = z.object({
  inicio: dataIso,                                            // a data de início da deficiência (CA1)
  grau: Grau,                                                 // o grau no início
  agravamentos: z.array(z.object({ data: dataIso, grau: Grau })),   // o grau muda a partir da data (CA2)
  sexo: z.enum(['feminino', 'masculino']),                    // o mínimo da LC 142 muda com o sexo
})
// O Vinculo do CNIS (GGVP-57) ganha, opcionais: indicadorPcd (o indicador PCD do CNIS) e insalubre (resposta do Lucas, 01/10).
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/processos/:id/deficiencia` | | a linha do tempo e o enquadramento | `obterLinhaDoTempo` |
| `PUT /api/processos/:id/deficiencia` | `DadosDaDeficiencia` | a linha do tempo | `salvarDeficiencia` |

### Campos

| Campo | Função de `campos` |
|---|---|
| Início da deficiência, data do agravamento | `normalizarData`, `validarData`, `dataParaIso`, `isoParaData`; não futura (`regras/formularios.ts`) |
| Grau, novo grau, sexo para a contagem | lista fixa |

### Decisões da história

1. **O cálculo é código com teste (G19)**, em `regras/deficiencia.ts`: cada vínculo vira dias, partido na data de início e em cada agravamento; o tempo de cada grau é somado; o grau preponderante é o de mais tempo com deficiência (Decreto 3.048, art. 70-E, § 1º); o tempo dos outros graus e o sem deficiência são convertidos pelos fatores da tabela do art. 70-E (redação do Decreto 8.145/2013), por sexo; o mínimo é o da LC 142, art. 3º (grave 25/20, moderada 29/24, leve 33/28 anos, homem/mulher). A IA nunca calcula. Levar ao Lucas: conferir a tabela.
2. **Documento da época** (CA3): laudo, atestado, relatório, prontuário, exame, ASO e contratação por cota com a data dentro do período com deficiência. ASO e contratação por cota entram no fim do catálogo único (o ASO como documento médico). Vêm da pasta do cliente (a leitura da GGVP-95) e, na semente da Cleide, de uma lista de exemplo.
3. **Semente**: a Cleide (Aposentadoria PCD) ganha o CNIS de exemplo (três vínculos, com o indicador PCD e a insalubridade), a deficiência desde 06/2014, leve, com agravamento para moderada em 03/2019. O período moderado de 2019 fica sem prova da época, para a tela mostrar o aviso.
4. **"Em qualquer tela"** (CA4): o enquadramento sai de uma função só, usada na linha do tempo e no parecer da Aposentadoria PCD. A tela da exigência do INSS (D2.05) é de outra história e usa a mesma função.
5. **Insalubridade** (resposta do Lucas, 01/10): o período com deficiência e insalubridade fica marcado, como informativo para o processo; o cálculo da atividade especial não entra aqui.
6. **Respostas do Lucas, 07/10**: a tabela do art. 70-E e os mínimos da LC 142 estão confirmados. Na entrevista, a tela mostra todos os cenários: todo o tempo com deficiência contado como leve, como moderada e como grave (`cenarios`), cada um com o convertido, o mínimo e o que falta. E mostra o tempo como pessoa com deficiência, sem conversão, contra o mínimo de 15 anos (`MINIMO_COM_DEFICIENCIA`).

## GGVP-47 · Auxílio-Acidente: prova do acidente

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/checklist` (muda) | step_D1.21 `1818:2`; não há quadro da escolha da circunstância | No Auxílio-Acidente, o cartão "Circunstância do acidente" (circunstância, categoria do segurado, data do acidente, internação ou cirurgia e a recusa do empregador na CAT e no PPP), com a espécie (B94 ou B36) e a sugestão da segunda ficha; o checklist com os complementares, cada um com a exigência e a situação |
| `/casos/:id/liberar` (muda) | step_D1.24 `10:264` | A trava do G18 quando a análise da IA acha laudo de lesão não consolidada ou sem redução da capacidade, com a sugestão de troca para auxílio por incapacidade temporária |

### Contrato (vai para `packages/contratos/acidente.ts`)

```ts
export const Circunstancia = z.enum(['trabalho', 'trajeto', 'ocupacional', 'transito', 'domestico'])
export const Categoria = z.enum(['empregado', 'domestico', 'avulso', 'especial', 'individual', 'facultativo'])
export const DadosDoAcidente = z.object({
  circunstancia: Circunstancia,          // define a espécie: B94 (trabalho, trajeto, ocupacional) ou B36 (trânsito, doméstico)
  categoria: Categoria,                  // individual e facultativo travam; doméstico só a partir da LC 150/2015
  acidenteEm: dataIso,                   // não futura
  internacao: z.boolean(),               // puxa o prontuário (condicional)
  recusados: z.array(z.enum(['cat', 'ppp'])),   // a válvula: o empregador recusou, vira pendência e não trava
})
// O checklist (GGVP-91) ganha, opcionais: no item, a exigência e "não conta"; no checklist, o bloqueio.
// O Parecer do portão (GGVP-33) ganha, opcional: as contradições da análise da IA que ninguém conferiu ainda.
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/processos/:id/acidente` | | os dados salvos e a sugestão da segunda ficha | `obterAcidente` |
| `PUT /api/processos/:id/acidente` | `DadosDoAcidente` | os dados salvos | `salvarAcidente` |

### Campos

| Campo | Função de `campos` |
|---|---|
| Data do acidente | `normalizarData`, `validarData`, `dataParaIso`, `isoParaData`; não futura (`regras/formularios.ts`) |
| Circunstância, categoria | lista fixa |
| Auxílio por incapacidade temporária antes, recusa do empregador | caixa de marcar |

### Decisões da história

1. **A tabela por circunstância é configuração do escritório**, como a lista de cada benefício (GGVP-91, CA10): fica em `dados/checklist.ts`; a regra (o que se aplica, a válvula, o bloqueio da categoria e o completo) fica em `regras/acidente.ts`, com teste. O Lucas fixou a CAT, o PPP, o boletim e a regra dos condicionais; a ficha do pronto-socorro e os exames seguem a lista da história como obrigatórios, e o prontuário como condicional da internação ou cirurgia. Levar ao Lucas: conferir essas células.
2. **"CAT só quando há vínculo"** (CA2): a CAT e o PPP entram só para empregado, empregado doméstico e avulso. Levar ao Lucas: o segurado especial fica sem a CAT no checklist.
3. **Os exames** viram dois tipos no catálogo único (exame de imagem da época do acidente e exame posterior à alta), mais a ficha do pronto-socorro e o PPP, acrescentados no fim. A pessoa confere o tipo na leitura; a IA sugere pelo nome do arquivo. O exame da semente do Sebastião passa a ser "posterior à alta".
4. **Antes de marcar a circunstância** o checklist mostra a lista base (RG, CPF, CNIS e laudo, do kit do Figma `10:264`) e trava: "Marque a circunstância do acidente". A segunda ficha sugere a data e o "foi acidente de trabalho"; quem salva é a Documentação ou o Jurídico.
5. **G18** (CA4): a análise da IA que acha a contradição trava a liberação até uma pessoa do Jurídico conferir o parecer; depois, vale o parecer registrado. A contradição "sem redução da capacidade" entra no roteiro do Auxílio-Acidente.
6. **Os documentos da semente do parecer** (a CAT, os exames e os laudos do Sebastião) contam no checklist, como os da pasta.
7. **Respostas do Lucas, 07/10** (fecham os itens 1 e 2): a nova tabela. Trabalho e trajeto: CAT, ficha do pronto-socorro, prontuário e exames da época e posteriores à alta obrigatórios, boletim desejável. Doença ocupacional: CAT, PPP, prontuário e os exames do quadro e da evolução. Trânsito e doméstico: boletim de ocorrência e fotos do acidente obrigatórios, mais o pronto-socorro, o prontuário e os exames. O prontuário vale para todos, sem depender de internação ou cirurgia. O condicional passa a ser a cópia do processo do auxílio por incapacidade temporária, quando houve um antes (a caixa "Houve auxílio por incapacidade temporária antes" troca a da internação). Sem empregador (o segurado especial, o rural), não há CAT: o boletim vira obrigatório e entram as fotos, salvo na doença ocupacional. Três tipos novos no fim do catálogo: fotos do acidente, exames do quadro e da evolução (documento médico) e a cópia do processo do auxílio anterior.

## GGVP-50 · BPC/LOAS de menor de 16 anos

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id/parecer` (muda) | step_D1.21M `14:195`; não há quadro do roteiro infantil | No LOAS Deficiente de menor de 16 anos, a análise com o roteiro infantil e o cartão "Criança · condição e terapias": a advogada marca a condição e as terapias, e vê os relatórios que o caso pede, cada um recebido ou faltando |
| `/casos/:id/checklist` (muda) | step_D1.21 `1818:2` | Os relatórios da criança entram como obrigatórios; sem a condição marcada, o checklist trava e diz que a advogada marca no parecer |

### Contrato (vai para `packages/contratos/infantil.ts`)

```ts
export const CondicaoDaCrianca = z.enum(['saude-mental', 'neurologica'])   // CAPS; neurologia (paralisia cerebral, má formação e parecidos)
export const Terapia = z.enum(['fono', 'to', 'psicologia'])
export const DadosDaCrianca = z.object({ condicoes: z.array(CondicaoDaCrianca), terapias: z.array(Terapia) })
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/processos/:id/crianca` | | se é infantil, os dados e os relatórios | `obterCrianca` |
| `PUT /api/processos/:id/crianca` | `DadosDaCrianca` | os relatórios | `salvarCrianca` |

### Campos

| Campo | Função de `campos` |
|---|---|
| Condição, terapias, frequenta escola ou creche | caixas de marcar (lista fixa) |

### Decisões da história

1. **Menor de 16 anos é código com teste (G19)**: `idadeEm(nascimento, hoje) < 16`, pela data de nascimento da ficha (a ficha é do beneficiário; o responsável é o representante legal). Sem data de nascimento, vale o roteiro do adulto.
2. **O roteiro infantil é outro roteiro da semente** (`loas-infantil`), editável pela sênior como os outros (GGVP-93): troca as limitações e barreiras do adulto pelo impacto na participação social e nas atividades da idade, e pela necessidade de cuidados que limitam o trabalho dos responsáveis. O complementar "Menor de 16 anos" do roteiro do adulto passa a apontar para ele.
3. **Os relatórios por condição** (resposta do Lucas, 01/10) entram no checklist de documentos como obrigatórios, pelo mesmo caminho dos complementares do Auxílio-Acidente. Os cinco relatórios novos entram no fim do catálogo único como documentos médicos; a IA sugere o tipo pelo nome do arquivo (fono, terapia ocupacional, psicologia, CAPS, neurologia).
4. **A condição é dado de saúde**: só o Jurídico marca e vê; o histórico registra que marcou, sem dizer a condição. A Documentação vê no checklist só o nome do relatório que falta.
5. **Semente**: nenhum cliente da semente tinha menos de 16 anos; entra no fim o Davi Exemplo (7 anos, sem CPF), com o LOAS Deficiente esperando o parecer e um laudo de exemplo da neuropediatria.
6. **Resposta do Lucas, 07/10**: o relatório escolar só entra se a criança vai à escola ou à creche (caixa no cartão, com o que o relatório conta: comunicação, interação, participação, comportamento, autonomia e dificuldades). Sem escola, valem os relatórios dos profissionais que acompanham a criança. Sem a condição marcada, o checklist não pede relatório e fica travado.
