> Fonte versionada: [`docs/bpmn/D2.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/bpmn/D2.md) no repositório. Edite lá (por PR), não na wiki.

# D2 · Via administrativa no INSS (revisão BPMN)

**Frame do Miro:** [D2 · Via administrativa no INSS · revisão BPMN (para conferência)](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977251201) (id `3458764684977251201`).
**Estado:** revisão BPMN refeita com o PO em setembro de 2026 e ajustada no Miro em 29/09/2026 (raias externas INSS e CLIENTE; perícia aberta pelo sistema e marcada pelo Jurídico administrativo). É a versão que vale (a da direita).
**Início:** Caso liberado pelo Atendimento (vem de D1). **Fim:** Deferido → Financeiro com a prestação de contas + Ida ao banco agendada (dois eventos finais); ou Indeferido → ▶ SEGUE PARA D3 · indeferido vai para a Justiça.

Resumo do board: "Jurídico e Documentação: o sênior libera, o Jurídico administrativo protocola e o Meu INSS é vigiado todo dia. Ao protocolar, o INSS libera o agendamento da perícia e o sistema abre a tarefa do DP. Toda exigência nasce como tarefa no Jurídico e desce como card para a Documentação; se pede perícia e documentos, a Documentação cobra primeiro e o Jurídico marca a perícia quando eles chegam. Ajuste de 29/09/2026: raias externas INSS e CLIENTE."

Os textos estão transcritos literalmente do frame. Cada passo aponta para o código do `README.md` (`D2.01`…`D2.07`). Os cartões externos não têm código no Miro; os códigos `D2.E1` a `D2.E4` citados abaixo são a **proposta** de 29/09/2026, a confirmar com o PO.

## Como ler (legenda do board)

- **[PESSOA]** caixa azul; **[IA]** caixa verde; **[SISTEMA]** caixa cinza; **[SCANNER]** caixa laranja; **[EXTERNO]** borda tracejada ("Externo (fora do escritório)"): o passo de quem está fora do escritório é uma espera.
- Losango amarelo: pergunta (decisão) — `✕` exclusiva, `✚` paralela ("os dois ao mesmo tempo").
- Pílula cinza arredondada: vem de / segue para outro diagrama; caixa pontilhada cinza: entrou em outro diagrama (DP).
- Linha cheia = trabalho segue; tracejada cinza = mensagem com quem está fora do escritório (INSS ou cliente); pontilhada roxa = RAG; tracejada fina = liga comentário ao passo.

## Raias

- **FINANCEIRO** — recebe a prestação de contas do benefício deferido.
- **ATENDIMENTO** — agenda a ida ao banco com o cliente.
- **JURÍDICO** — o sênior confere e aprova; o Jurídico administrativo (estagiário) protocola no Meu INSS; vigia; decide o que fazer com a exigência; presta contas.
- **DOCUMENTAÇÃO · ADM** — recebe os cards das exigências, cobra o cliente e responde a exigência no portal.
- **INSS** (raia externa, tracejada) — recebe o requerimento e libera o agendamento da perícia; analisa e decide; analisa a resposta às exigências.
- **CLIENTE** (raia externa, tracejada; nova em 29/09) — entrega o documento pedido na exigência.

## Passos

Em ordem de fluxo. A raia aparece entre parênteses.

**Evento inicial:** Caso liberado pelo Atendimento (vem de D1), na raia JURÍDICO.

- **D2.01 [PESSOA] Conferência do sênior** (JURÍDICO) — o advogado valida o caso.
- **D2.02 [PESSOA] Protocolar no Meu INSS** (JURÍDICO) — Jurídico administrativo (estagiário). Depois do OK do sênior, o protocolo e a pergunta de perícia rodam **ao mesmo tempo** (gateway paralelo `✚`). Ao protocolar, o INSS recebe o requerimento (mensagem para a raia INSS).
- **[EXTERNO] INSS recebe o requerimento — e libera o agendamento da perícia** (INSS; proposta `D2.E1`) — manda "agendamento liberado" para o bloco DP do D2.03 e "analisa o pedido" para "INSS analisa e decide".
- **D2.03 [decisão] Precisa de perícia médica ou avaliação social?** (JURÍDICO) — se sim, **⤷ ENTROU NO DIAGRAMA DE PERÍCIA — DP · o sistema abre a tarefa; o Jurídico administrativo marca**. A advogada só decide; o sistema abre a tarefa de perícia (`DP.01`).
- **[EXTERNO] INSS analisa e decide — deferido, indeferido ou nova exigência** (INSS; proposta `D2.E2`) — novo em 29/09; manda "aparece no Meu INSS" para o D2.04.
- **D2.04 [PESSOA] Vigiar o Meu INSS** (JURÍDICO) — todo dia, com certificado digital. Roda depois que o protocolo está feito e a perícia resolvida (ou quando não há perícia) — gateway paralelo de junção `✚`.
- **D2.05 [PESSOA] Tratar exigência** — quando a vigília acha uma exigência ("O que a exigência pede?"):
    - **Documentos (ou documentos e perícia):** **Criar tarefa: documentos** [PESSOA] (JURÍDICO, card para a Documentação) → **Cobrar o cliente** [PESSOA] (`D2.05`, DOCUMENTAÇÃO) o documento pedido, com a mensagem "cobrança" para o cliente → **[EXTERNO] Cliente entrega o documento — pedido na exigência** (CLIENTE; proposta `D2.E3`), que volta com "entrega ou não entrega" → "O documento foi conseguido?": se não, cobra de novo; se sim, "Também pede perícia?": se não, **Responder a exigência** [PESSOA] (`D2.05`, DOCUMENTAÇÃO) anexando no portal do INSS; se sim, o bloco DP da exigência ("Sim: o Jurídico marca a perícia de novo").
    - **Perícia:** **⤷ ENTROU NO DIAGRAMA DE PERÍCIA — DP · perícia pedida na exigência; com documentos, depois que eles chegam**.
    - A resposta vai ao INSS: **[EXTERNO] INSS analisa a resposta — à exigência** (INSS; proposta `D2.E4`) → "decide de novo" → "INSS analisa e decide" → "aparece no Meu INSS" → D2.04 Vigiar o Meu INSS.
- **D2.06 [PESSOA] Deferido: prestação de contas e ida ao banco** — quando "Qual foi a decisão?" = Deferido:
    - **Prestação de contas** [PESSOA] (JURÍDICO) do benefício deferido → gateway paralelo `✚` ("os dois ao mesmo tempo"):
    - **Financeiro** [PESSOA] recebe a prestação de contas → evento final "Financeiro com a prestação de contas".
    - **Agendar a ida ao banco** [PESSOA] (ATENDIMENTO) com o cliente → evento final "Ida ao banco agendada".
- **D2.07 [handoff] Indeferido: segue para D3** — quando "Qual foi a decisão?" = Indeferido → **▶ SEGUE PARA D3 · indeferido vai para a Justiça**.

## Decisões (gateways)

1. **O sênior aprova o caso?** (JURÍDICO, após D2.01)
   - **Sim** → gateway paralelo `✚` (protocolo + pergunta de perícia ao mesmo tempo).
   - **Não** → ▶ SEGUE PARA D1 · o Atendimento ajusta o caso.
2. **`✚` Os dois ao mesmo tempo** (gateway paralelo de abertura) → D2.02 Protocolar no Meu INSS **e** D2.03 Precisa de perícia?
3. **Precisa de perícia médica ou avaliação social?** (JURÍDICO)
   - **Sim** → entra no DP: o sistema abre a tarefa e o Jurídico administrativo marca.
   - **Não** → (segue direto para a junção).
4. **`✚` Protocolo feito e perícia resolvida (ou sem perícia)** (gateway paralelo de junção) → D2.04 Vigiar o Meu INSS.
5. **O que apareceu no INSS?** (JURÍDICO, na vigília)
   - **Nada novo: vigia de novo amanhã** → volta para D2.04 Vigiar o Meu INSS.
   - **Decisão** → "Qual foi a decisão?".
   - **Exigência** → "O que a exigência pede?".
6. **Qual foi a decisão?** (JURÍDICO)
   - **Deferido** → D2.06 Prestação de contas.
   - **Indeferido** → D2.07 ▶ SEGUE PARA D3.
7. **O que a exigência pede?** (JURÍDICO)
   - **Documentos (ou documentos e perícia)** → Criar tarefa: documentos.
   - **Perícia** → entra no DP.
8. **O documento foi conseguido?** (DOCUMENTAÇÃO; espera a mensagem "entrega ou não entrega" do cliente)
   - **Sim: documento conseguido** → "Também pede perícia?".
   - **Não** → cobra de novo (volta para Cobrar o cliente).
9. **Também pede perícia?** (nova em 29/09, depois de "O documento foi conseguido?")
   - **Não** → D2.05 Responder a exigência.
   - **Sim** → bloco DP da exigência ("Sim: o Jurídico marca a perícia de novo").
10. **`✚` Os dois ao mesmo tempo** (gateway paralelo no deferimento) → Financeiro **e** Agendar a ida ao banco.

## Fluxos entre diagramas

| Rótulo | De | Para |
|---|---|---|
| Caso liberado pelo Atendimento (D1) | D1 · Liberar ao Jurídico | Evento inicial de D2 |
| ⤷ ENTROU NO DIAGRAMA DE PERÍCIA — DP · o sistema abre a tarefa; o Jurídico administrativo marca | D2.03 Precisa de perícia? (Sim) | DP · Perícia padrão |
| ⤷ ENTROU NO DIAGRAMA DE PERÍCIA — DP · perícia pedida na exigência; com documentos, depois que eles chegam | D2.05: ramo "Perícia" de "O que a exigência pede?" ou "Também pede perícia?" (Sim) | DP · Perícia padrão |
| ▶ SEGUE PARA D1 · o Atendimento ajusta o caso | "O sênior aprova o caso?" (Não) | D1 |
| ▶ SEGUE PARA D3 · indeferido vai para a Justiça | "Qual foi a decisão?" (Indeferido) | D3 · Judicialização |
| requerimento (tracejado) | D2.02 Protocolar no Meu INSS | INSS recebe o requerimento |
| agendamento liberado (tracejado) | INSS recebe o requerimento | bloco DP do D2.03 |
| analisa o pedido (tracejado) | INSS recebe o requerimento | INSS analisa e decide |
| aparece no Meu INSS (tracejado) | INSS analisa e decide | D2.04 Vigiar o Meu INSS |
| cobrança (tracejado) | D2.05 Cobrar o cliente | Cliente entrega o documento |
| entrega ou não entrega (tracejado) | Cliente entrega o documento | "O documento foi conseguido?" |
| resposta (tracejado) | D2.05 Responder a exigência | INSS analisa a resposta |
| decide de novo (tracejado) | INSS analisa a resposta | INSS analisa e decide |

## Documentos e sistemas citados

- **Meu INSS** — portal onde se protocola o requerimento, se faz a vigília diária e se responde às exigências.
- **Agendamento da perícia** — o INSS libera ao receber o requerimento; o Jurídico administrativo marca no DP.
- **Certificado digital** — usado na vigília do Meu INSS.
- **Cards de exigência** — ficam na Documentação; a decisão sobre o que fazer fica no Jurídico.
- **Prestação de contas** — do benefício deferido, entregue ao Financeiro.

## Regras e travas (comentários do board)

Referência em `docs/requisitos/portoes-governanca.md`.

- **💡 DICA (D2.02):** "Nada é protocolado sem o OK do sênior." → portão **G2**.
- **⚠️ ATENÇÃO (exigência / D2.05):** "Toda exigência vira tarefa com prazo na agenda e lembretes automáticos. Passou do limite de cobranças (a definir), sobe para o sênior decidir." → portões **G15** e **G21** (limite ainda "a definir").
- **📝 OBSERVAÇÃO (exigência / D2.05):** "Os cards ficam na Documentação; a decisão sobre o que fazer fica no Jurídico."
- Exigência que pede perícia e documentos: a Documentação cobra primeiro e o Jurídico marca a perícia quando os documentos chegam (resumo do frame e decisão "Também pede perícia?").
- **📝 OBSERVAÇÃO (D2.06, Financeiro):** "Valores: o financeiro do escritório é todo do Financeiro. A advogada vê os valores só na prestação de contas, que é ela quem faz; o Sócio vê só totais (Pedro, 06/10/2026)." Colocada no Miro em 06/10/2026.

## A conferir / lacunas

- Limite de cobranças da exigência: "a definir" (D2.05 / G15).
- Códigos dos cartões externos: a proposta `D2.E1` a `D2.E4` **não** foi gravada no Miro; aguarda o Lucas.
