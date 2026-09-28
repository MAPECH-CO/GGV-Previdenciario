> Fonte versionada: [`docs/bpmn/D3.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/bpmn/D3.md) no repositório. Edite lá (por PR), não na wiki.

# D3 · Judicialização (revisão BPMN)

**Frame do Miro:** [D3 · Judicialização · revisão BPMN (para conferência)](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977559113) (id `3458764684977559113`).
**Estado:** revisão BPMN refeita com o PO em setembro de 2026. É a versão que vale (a da direita).
**Início:** Indeferido no INSS (vem de D2). **Fim:** Petição protocolada no tribunal → ▶ SEGUE PARA D3a · vigília do processo (o juízo recebe a petição inicial).

Resumo do board: "Do motivo do indeferimento até a peça protocolada: o motivo é guardado, a IA analisa, a sênior despacha só o que falta (perícia vai para o DP), cada setor acionado fica no próprio laço e sobe o card, e o advogado confere e protocola."

Os textos estão transcritos literalmente do frame. Cada passo aponta para o código do `README.md` (`D3.01`…`D3.07`).

## Como ler (legenda do board)

- **[PESSOA]** caixa azul; **[IA]** caixa verde; **[SISTEMA]** caixa cinza; **[SCANNER]** caixa laranja.
- Losango amarelo: pergunta — `✕` exclusiva, `◯` inclusiva (um ou mais caminhos ao mesmo tempo), `✚` paralela.
- Pílula cinza arredondada: vem de / segue para outro diagrama; caixa pontilhada cinza: entrou em outro diagrama (DP).
- Linha cheia = trabalho segue; tracejada cinza = mensagem com o INSS/Justiça; pontilhada roxa = grava ou consulta o RAG; tracejada fina = liga comentário ao passo.

## Raias

- **ATENDIMENTO** — cumpre a tarefa do laço do cliente (fala com o cliente pelo que falta) e sobe o card.
- **JURÍDICO** — registra o motivo, a sênior despacha, pede a petição, o advogado confere e assina, protocola no tribunal.
- **DOCUMENTAÇÃO · ADM** — cumpre a tarefa do laço de documentos que faltaram e sobe o card.
- **SISTEMA · REGRAS** — guarda o motivo no Drive e no RAG; salva e gera o pacote.
- **IA · LLM** — analisa o motivo e escreve a petição (com o RAG e o histórico do caso).
- **JUSTIÇA** (raia externa, tracejada) — o juízo recebe a petição inicial.

## Passos

Em ordem de fluxo. A raia aparece entre parênteses.

**Evento inicial:** Indeferido no INSS (vem de D2), na raia JURÍDICO.

- **D3.01 [PESSOA]/[SISTEMA] Registrar o motivo do indeferimento** — **Registrar o motivo** [PESSOA] (JURÍDICO): quem viu escreve o porquê → **Guardar no Drive** [SISTEMA] (banco de motivos) → **Guardar no RAG** [SISTEMA]: o motivo vai ao Vector Store.
- **D3.02 [IA] Analisar o motivo** (IA · LLM) — lê o histórico do caso.
- **D3.03 [PESSOA] A sênior despacha** (JURÍDICO) — cria a tarefa de cada setor (com os critérios). Decisão "Falta algo para a petição?".
- **D3.04 [PESSOA] Laços dos setores** — gateway inclusivo `◯` "Quais setores precisam agir?" abre um ou mais laços em paralelo, cada setor no seu ritmo:
    - **Atendimento:** **Atendimento: cumprir a tarefa** — falar com o cliente pelo que falta → "Conseguiu com o cliente?": se sim, **Subir no card** (Atendimento registra e dá o OK); se não, tenta contato de novo.
    - **Documentação:** **Documentação: cumprir a tarefa** — docs que faltaram → "Conseguiu o documento?": se sim, **Subir no card** (Documentação anexa e dá o OK); se não, cobra de novo.
    - **Perícia:** **⤷ ENTROU NO DIAGRAMA DE PERÍCIA (DP)** — perícia ou avaliação social despachada pela sênior; o resultado volta como card.
    - Os laços convergem no gateway inclusivo `◯` "Espera os setores acionados": a petição só é pedida quando cada setor acionado subiu o próprio card e a perícia voltou do DP.
- **D3.05 [PESSOA]/[IA] Pedir e escrever a petição** — **Pedir a petição** [PESSOA] (JURÍDICO, advogada responsável) → **Escrever a petição** [IA] (IA · LLM): RAG + histórico do caso (consulta o Vector Store).
- **D3.06 [PESSOA] Conferir a petição** (JURÍDICO) — o advogado assina o conteúdo. Decisão "A petição está boa?": se não, a IA faz outra versão (volta a Escrever a petição).
- **D3.07 [SISTEMA]/[PESSOA] Pacote, travas e protocolo** — **Salvar e gerar o pacote** [SISTEMA] (Drive + botão do tribunal) → **Protocolar no tribunal** [PESSOA] (JURÍDICO, pelo botão, no site do juízo), depois das três travas → o juízo recebe a petição inicial → **▶ SEGUE PARA D3a · vigília do processo**.

## Decisões (gateways)

1. **Falta algo para a petição?** (JURÍDICO, após D3.03)
   - **Sim** → gateway inclusivo `◯` "Quais setores precisam agir?" (laços dos setores).
   - **Não** → (segue direto para pedir a petição — a validar no board, seta não legível no frame).
2. **`◯` Quais setores precisam agir?** (gateway inclusivo)
   - **Atendimento** → Atendimento: cumprir a tarefa.
   - **Documentação** → Documentação: cumprir a tarefa.
   - **Perícia** → entra no DP.
3. **Conseguiu com o cliente?** (ATENDIMENTO)
   - **Sim** → Subir no card.
   - **Não: tenta contato de novo** → Atendimento: cumprir a tarefa.
4. **Conseguiu o documento?** (DOCUMENTAÇÃO)
   - **Sim** → Subir no card.
   - **Não: cobra de novo** → Documentação: cumprir a tarefa.
5. **`◯` Espera os setores acionados** (gateway inclusivo de junção) → D3.05 Pedir a petição, quando todos os cards subiram e a perícia voltou.
6. **A petição está boa?** (JURÍDICO, após Conferir a petição)
   - **Sim** → Salvar e gerar o pacote.
   - **Não** → a IA faz outra versão (volta a Escrever a petição) — ver portão G6.

## Fluxos entre diagramas

| Rótulo | De | Para |
|---|---|---|
| Indeferido no INSS (D2) | D2 · "Qual foi a decisão?" (Indeferido) | Evento inicial de D3 |
| ⤷ ENTROU NO DIAGRAMA DE PERÍCIA (DP) | D3.04 laço de perícia | DP · Perícia padrão (resultado volta no card) |
| petição (tracejado) | D3.07 Protocolar no tribunal | Juízo recebe a petição inicial (JUSTIÇA) |
| ▶ SEGUE PARA D3a · vigília do processo | D3.07 Protocolar no tribunal | D3a · Vigília e exigências do juiz |

## Documentos e sistemas citados

- **Banco de motivos (Drive)** — onde o motivo do indeferimento é guardado, escrito por quem viu, com as próprias palavras.
- **Vector Store (RAG)** — recebe o motivo (a IA aprende com cada indeferimento) e é consultado para escrever a petição.
- **Card do caso** — cada setor acionado sobe o próprio card; a petição só é pedida quando todos subiram.
- **Botão do tribunal / site do juízo** — canal de protocolo da petição inicial.
- **Pacote** — salvo no Drive e gerado pelo botão do tribunal.

## Regras e travas (comentários do board)

Referência em `docs/requisitos/portoes-governanca.md`.

- **⚠️ ATENÇÃO (análise / D3.02–D3.03):** "A IA analisa e sugere, mas quem despacha é a sênior." → portão **G4**.
- **⚠️ ATENÇÃO (protocolo / D3.07):** "Três travas antes de protocolar: Tema 350, pacote completo e CPF conferido." → portão **G7**.
- **💡 DICA (motivo / D3.01):** "Quem viu o indeferimento escreve o motivo com as próprias palavras. Isso vira o banco de motivos."
- **📝 OBSERVAÇÃO (motivo / D3.01):** "O motivo vai para o Drive e para o RAG: a IA aprende com cada indeferimento."
- **💡 LAÇO DO ATENDIMENTO (D3.04):** "A tarefa da sênior diz o que falta do cliente. O Atendimento entra em contato até conseguir. Passou do limite (a definir), sobe para a sênior decidir." → portão **G15** (limite "a definir").
- **💡 LAÇO DA DOCUMENTAÇÃO (D3.04):** "Busca os documentos que faltaram no pedido do INSS. Passou do limite de cobranças (a definir), sobe para a sênior decidir." → portão **G15** (limite "a definir").
- **💡 DICA (petição / D3.05):** "A petição só é pedida quando cada setor acionado subiu o próprio card e a perícia voltou do DP. Se falta alguém, o card fica aberto."
- Conteúdo da petição assinado pelo advogado; se não está boa, a IA faz outra versão → portão **G6**.

## A conferir / lacunas

- O ramo "Não" de "Falta algo para a petição?" (D3.03) não tem seta legível no frame — presume-se ir direto a Pedir a petição. **A validar no board.**
- O ramo "Não" de "A petição está boa?" (D3.06) não está desenhado como seta; o portão G6 diz que a IA faz outra versão (volta a Escrever a petição). **A validar no board.**
- Limites dos laços de Atendimento e Documentação: "a definir" (D3.04 / G15).
