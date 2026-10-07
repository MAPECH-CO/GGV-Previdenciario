> Fonte versionada: [`docs/bpmn/D3b.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/bpmn/D3b.md) no repositório. Edite lá (por PR), não na wiki.

# D3b · Desfecho do mérito (revisão BPMN)

**Fonte:** frame "D3b · Desfecho do mérito · revisão BPMN (para conferência)" no Miro, board `uXjVHjbveV4=`. [Abrir no Miro](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978188052) (frame `3458764684978188052`).
**Estado:** revisão feita com o PO em setembro de 2026. Vale este frame; a versão antiga fica no board só como histórico.
**Início:** Decisão de mérito, vinda do D3a. **Fim:** "Vencemos: baixa registrada" (procedente) ou "Perdemos: estudo registrado" (improcedente).

Resumo do frame: *Procedente: acompanha o pagamento, presta contas, passa pelo Financeiro e avisa o cliente; vira processo bom no RAG. Improcedente: o Jurídico decide se recorre; se não, vira processo ruim com estudo de caso.*

Cada passo aponta para o código acordado no README (`D3b.01`…). O executor segue a legenda "Como ler" do board pela cor do cartão: **[Pessoa]** (azul), **[IA]** (verde), **[Sistema]** (cinza), **[Scanner]** (laranja). Toda ação da IA tem uma pessoa que confere.

## Raias

Na ordem das faixas do frame (de cima para baixo):

- **FINANCEIRO** — recebe a prestação de contas.
- **ATENDIMENTO** — avisa o cliente do resultado (vitória ou derrota).
- **JURÍDICO** — decide se o mérito foi procedente, dá o OK na prestação de contas e decide se recorre.
- **SISTEMA · REGRAS** — acompanha o pagamento, registra e notifica, guarda no acervo (RAG).
- **IA · LLM** — monta a prestação de contas e gera o estudo de caso; sempre conferida por pessoa.

## Passos

### JURÍDICO

- **Início** Decisão de mérito (D3a) — evento que entra do D3a.
- **Decisão · A ação foi procedente?** (ver Decisões).
- **D3b.02 [Pessoa]** Advogada responsável dá o OK — confere e valida a prestação de contas.
- **Decisão · Vale recorrer?** (ver Decisões) — no ramo improcedente.

### FINANCEIRO

- **D3b.03 [Pessoa]** Financeiro recebe a prestação de contas.

### ATENDIMENTO

- **D3b.03 [Pessoa]** Avisar o cliente — "vencemos", agenda a ida ao banco.
- **D3b.06 [Pessoa]** Falar com o cliente — explica o resultado (ramo improcedente).

### SISTEMA · REGRAS

- **D3b.01 [Sistema]** Acompanhar o pagamento — RPV ou precatório, até cair na conta.
- **[Sistema]** Guardar no RAG — processo bom, referência. *(passo do board sem código no README — ver "A conferir")*
- **D3b.05 [Sistema]** Registrar e notificar — estudo no card, aviso ao sênior.
- **[Sistema]** Guardar no RAG — processo ruim, estudo de caso. *(passo do board sem código no README — ver "A conferir")*
- **[Armazenamento]** Vector Store (RAG) — onde os dois desfechos são gravados.

### IA · LLM

- **D3b.02 [IA]** Montar a prestação de contas — a IA monta; a advogada responsável dá o OK antes de seguir.
- **D3b.05 [IA]** Gerar o estudo de caso — por que foi improcedente.

## Decisões (gateways)

1. **A ação foi procedente?** (raia JURÍDICO, logo depois do evento "Decisão de mérito (D3a)")
   - **Sim: procedente (total ou parcial)** → `D3b.01` Acompanhar o pagamento.
   - **Não: improcedente** → decisão "Vale recorrer?".
2. **Vale recorrer?** (raia JURÍDICO)
   - **Sim: recorre** → segue para **D3a** (recurso protocolado, vigília segue).
   - **Não** → `D3b.05` Gerar o estudo de caso.

## Fluxos e sequência

Ramo procedente: evento "Decisão de mérito (D3a)" → gateway "A ação foi procedente?" → (Sim) `D3b.01` Acompanhar o pagamento → `D3b.02` Montar a prestação de contas (IA) → Advogada responsável dá o OK → `D3b.03` Financeiro recebe a prestação de contas → Avisar o cliente → Guardar no RAG (processo bom) → **fim "Vencemos: baixa registrada"**. Guardar no RAG grava no Vector Store (linha pontilhada roxa, rótulo "grava").

Ramo improcedente: gateway "A ação foi procedente?" → (Não) gateway "Vale recorrer?"; se **Sim: recorre**, segue para o D3a; se **Não**, `D3b.05` Gerar o estudo de caso (IA) → Registrar e notificar → Guardar no RAG (processo ruim) e → `D3b.06` Falar com o cliente → **fim "Perdemos: estudo registrado"**. Guardar no RAG (ruim) também grava no Vector Store.

Ligações com outros diagramas:
- **Entra de D3a** — evento inicial "Decisão de mérito (D3a)".
- **Segue para D3a** — pastilha "▶ SEGUE PARA D3a · recurso protocolado, vigília segue" (ramo "Sim: recorre").
- **Alimenta o acervo (D4)** — os dois "Guardar no RAG" gravam o desfecho no Vector Store, base que o D4 usa para aprender.

## Documentos e sistemas citados

- **RPV / precatório** — formas de pagamento acompanhadas em `D3b.01`.
- **Prestação de contas** — montada pela IA (`D3b.02`), recebida pelo Financeiro (`D3b.03`).
- **Vector Store (RAG)** — acervo onde processo bom e processo ruim são guardados como exemplo.
- **Card do processo** — onde o estudo de caso é registrado e o sênior é avisado (`D3b.05`).
- **Banco** — o cliente é levado ao banco quando vencemos (agendado em `D3b.03`).

## Regras e travas

Os comentários do board são regra de negócio; viram critério de aceite ou portão em `docs/requisitos/portoes-governanca.md`.

- **💡 DICA** — "O aviso ao cliente só nasce depois do OK da advogada responsável na prestação de contas." → portão **G8** (`docs/requisitos/portoes-governanca.md`).
- **📝 OBSERVAÇÃO** — "Processo bom e ruim viram exemplo: a próxima petição parecida consulta os dois." → alimenta o acervo do D4 (busca antes de escrever).
- **📝 OBSERVAÇÃO** (D3b.03, Financeiro) — "Valores: o financeiro do escritório é todo do Financeiro. A advogada vê os valores só na prestação de contas, que é ela quem faz; o Sócio vê só totais (Pedro, 06/10/2026)." Colocada no Miro em 06/10/2026.

## A conferir (divergências board × README)

- O board tem dois passos **"Guardar no RAG"** (processo bom e processo ruim) e o armazenamento **Vector Store (RAG)** que não têm código no inventário do README. Confirmar se entram como passos próprios de D3b ou se pertencem ao D4 (acervo). Registrado em `docs/requisitos/duvidas-abertas.md` quando for validado.
- **D3b.02** cobre dois cartões no board ("Montar a prestação de contas" [IA] e "Advogada responsável dá o OK" [Pessoa]); **D3b.03** cobre dois cartões ("Financeiro recebe a prestação de contas" e "Avisar o cliente"). Manter os dois pares sob o mesmo código ou desmembrar é decisão do PO na validação.
