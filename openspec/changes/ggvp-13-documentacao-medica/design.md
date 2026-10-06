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
5. **Quem fez.** A tela manda o nome da pessoa do perfil escolhido (`usePerfil`); sem escolha, o da função da tela. Ao ligar no servidor, vem da sessão.
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
