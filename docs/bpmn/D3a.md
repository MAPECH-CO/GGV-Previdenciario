# D3a · Depois do protocolo: vigília e exigências do juiz (revisão BPMN)

**Frame do Miro:** [D3a · Depois do protocolo: vigília e exigências do juiz · revisão BPMN (para conferência)](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977768761) (id `3458764684977768761`).
**Imagem exportada:** [`img/D3a.jpg`](img/D3a.jpg) (mesma que abre em tela cheia no protótipo).
**Estado:** revisão BPMN refeita com o PO em setembro de 2026. É a versão que vale (a da direita).
**Início:** Petição protocolada (vem de D3). **Fim:** decisão de mérito → ▶ SEGUE PARA D3b · desfecho do mérito; a manifestação sobre exigência/laudo volta o processo para a vigília (ciclo).

Resumo do board: "O sistema vigia o processo, a IA lê cada publicação, o advogado analisa a exigência e cria a tarefa do setor responsável, com prazo. Cada setor acionado fica no próprio laço até cumprir (perícia pedida pelo juiz vai para o DP); depois o Jurídico manifesta e o processo volta para a vigília."

Os textos estão transcritos literalmente do frame. Cada passo aponta para o código do `README.md` (`D3a.01`…`D3a.04`).

## Como ler (legenda do board)

- **[PESSOA]** caixa azul; **[IA]** caixa verde; **[SISTEMA]** caixa cinza; **[SCANNER]** caixa laranja.
- Losango amarelo: pergunta — `✕` exclusiva, `◯` inclusiva, `✚` paralela.
- Pílula cinza arredondada: vem de / segue para outro diagrama; caixa pontilhada cinza: entrou em outro diagrama (DP).
- Linha cheia = trabalho segue; tracejada cinza = mensagem com o INSS/Justiça; pontilhada roxa = RAG; tracejada fina = liga comentário ao passo.

## Raias

- **ATENDIMENTO** — cumpre a exigência que pede informação do cliente (contata o cliente) e sobe o card.
- **JURÍDICO** — analisa a exigência e cria a tarefa do setor com prazo; cumpre a tarefa jurídica; manifesta e protocola.
- **DOCUMENTAÇÃO · ADM** — cumpre a exigência que pede documento e sobe o card.
- **SISTEMA · REGRAS** — vigia o processo por API (AASP + DJEN, casa pelo CNJ).
- **IA · LLM** — lê a publicação no contexto do processo e sugere as tarefas.
- **JUSTIÇA** (raia externa, tracejada) — o juízo publica no diário e recebe a manifestação.

## Passos

Em ordem de fluxo. A raia aparece entre parênteses.

**Evento inicial:** Petição protocolada (vem de D3), na raia SISTEMA · REGRAS.

- **D3a.01 [SISTEMA]/[IA] Vigiar e ler a publicação** — **Vigiar por API** [SISTEMA] (AASP + DJEN, casa pelo CNJ; o juízo publica no diário) → **Ler a publicação** [IA] no contexto do processo. Decisão "O que saiu?".
- **D3a.02 [PESSOA] Analisar a exigência e criar a tarefa** (JURÍDICO) — o advogado analisa a exigência ou o despacho e cria a tarefa do setor responsável, com prazo na agenda. Decisão "Precisa cumprir algo?".
- **D3a.03 [PESSOA] Laços dos setores** — gateway inclusivo `◯` "Quem precisa cumprir?" abre um ou mais laços em paralelo, cada setor no seu ritmo:
    - **Atendimento:** **Atendimento: cumprir a exigência** — contatar o cliente pela informação → "Conseguiu a informação?": se sim, **Subir no card** (Atendimento registra e dá o OK); se não, tenta contato de novo.
    - **Jurídico:** **Jurídico: cumprir a exigência** — tarefa definida pela advogada → "Tarefa cumprida?": se sim, **Subir no card** (Jurídico cumpriu e dá o OK); se não, continua na tarefa.
    - **Documentação:** **Documentação: cumprir a exigência** — buscar os documentos pedidos → "Conseguiu o documento?": se sim, **Subir no card** (Documentação anexa e dá o OK); se não, cobra de novo.
    - **Perícia:** **⤷ ENTROU NO DIAGRAMA DE PERÍCIA (DP)** — perícia ou avaliação social pedida pelo juiz; o resultado volta como card.
    - Os laços convergem no gateway inclusivo `◯` "Espera os setores acionados".
- **D3a.04 [PESSOA] Manifestar e protocolar** (JURÍDICO) — sobre a exigência ou o laudo; o juízo recebe a manifestação. Depois, o processo volta para a vigília (D3a.01): a próxima publicação recomeça o ciclo.

## Decisões (gateways)

1. **O que saiu?** (na leitura da publicação)
   - **Só andamento: continua vigiando** → volta para Vigiar por API.
   - **Exigência ou despacho** → D3a.02 Analisar a exigência.
   - **Decisão de mérito** → ▶ SEGUE PARA D3b · desfecho do mérito.
2. **Precisa cumprir algo?** (JURÍDICO, após analisar)
   - **Sim** → gateway inclusivo `◯` "Quem precisa cumprir?".
   - **Não: só ciência, continua vigiando** → volta para Vigiar por API.
3. **`◯` Quem precisa cumprir?** (gateway inclusivo)
   - **Atendimento** → Atendimento: cumprir a exigência.
   - **Jurídico** → Jurídico: cumprir a exigência.
   - **Documentação** → Documentação: cumprir a exigência.
   - **Perícia** → entra no DP.
4. **Conseguiu a informação?** (ATENDIMENTO): Sim → Subir no card; Não → tenta contato de novo.
5. **Tarefa cumprida?** (JURÍDICO): Sim → Subir no card; Não → continua na tarefa.
6. **Conseguiu o documento?** (DOCUMENTAÇÃO): Sim → Subir no card; Não → cobra de novo.
7. **`◯` Espera os setores acionados** (gateway inclusivo de junção) → D3a.04 Manifestar e protocolar, quando todos os cards subiram e a perícia voltou.

## Fluxos entre diagramas

| Rótulo | De | Para |
|---|---|---|
| Petição protocolada (D3) | D3 · Protocolar no tribunal | Evento inicial de D3a |
| publicação (tracejado) | Juízo publica no diário (JUSTIÇA) | D3a.01 Vigiar por API |
| ⤷ ENTROU NO DIAGRAMA DE PERÍCIA (DP) | D3a.03 laço de perícia | DP · Perícia padrão (resultado volta no card) |
| manifestação (tracejado) | D3a.04 Manifestar e protocolar | Juízo recebe a manifestação (JUSTIÇA) |
| ▶ SEGUE PARA D3b · desfecho do mérito | "O que saiu?" (Decisão de mérito) | D3b · Desfecho do mérito |

## Documentos e sistemas citados

- **AASP + DJEN** — APIs usadas para vigiar o processo; a publicação é casada pelo número CNJ (detalhe no D4).
- **Número CNJ** — chave que casa a publicação com o processo.
- **Card do caso / tarefa com prazo na agenda** — cada setor acionado sobe o próprio card; a manifestação só sai quando todos subiram.

## Regras e travas (comentários do board)

Referência em `docs/requisitos/portoes-governanca.md`.

- **⚠️ ATENÇÃO (análise / D3a.02):** "Quem analisa a exigência e define o setor dono da tarefa são os advogados, não a IA." → portão **G5**.
- **💡 DICA (leitura / D3a.01):** "A IA lê a decisão com o histórico do processo e já sugere as tarefas."
- **📝 OBSERVAÇÃO (vigília / D3a.01):** "Vigiar por API: como a publicação chega e é casada pelo número CNJ está detalhado no D4."
- **💡 LAÇO DO ATENDIMENTO (D3a.03):** "A tarefa diz qual informação a exigência pede. O Atendimento contata o cliente até conseguir. Passou do limite (a definir), sobe para a sênior." → portão **G15** (limite "a definir").
- **💡 LAÇO DO JURÍDICO (D3a.03):** "Cumpre a tarefa que a advogada definiu. Só sai do laço quando cumprir. Passou do limite (a definir), sobe para a sênior." → portão **G15** (limite "a definir").
- **💡 LAÇO DA DOCUMENTAÇÃO (D3a.03):** "Busca o documento que a exigência pede. Passou do limite de cobranças (a definir), sobe para a sênior decidir." → portão **G15** (limite "a definir").
- **💡 DICA (manifestação / D3a.04):** "Depois da manifestação o processo volta para a vigília: a próxima publicação recomeça o ciclo."
- Toda exigência do juízo vira item com prazo, responsável e prova → relacionado ao portão **G21**.

## A conferir / lacunas

- Após **Manifestar e protocolar** (e "Juízo recebe a manifestação"), o retorno à vigília é descrito só pela dica, sem seta sólida no frame. **A validar no board.**
- Limites dos laços de Atendimento, Jurídico e Documentação: "a definir" (D3a.03 / G15).
