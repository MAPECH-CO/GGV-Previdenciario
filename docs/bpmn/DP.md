# DP · Perícia padrão (revisão BPMN)

**Fonte:** frame "DP · Perícia padrão · revisão BPMN (para conferência)" no Miro, board `uXjVHjbveV4=`. [Abrir no Miro](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977072953) (frame `3458764684977072953`).
**Imagem exportada:** [`img/DP.jpg`](img/DP.jpg) (mesma que abre em tela cheia no protótipo).
**Estado:** revisão feita com o PO em setembro de 2026. Vale este frame; a versão antiga fica no board só como histórico.
**Início:** Perícia pedida (evento vindo de **D2, D3 ou D3a**). **Fim:** "▶ DEVOLVE PARA o diagrama que pediu", com perícia favorável ou desfavorável.

> **Fluxo chamado por outros diagramas.** O DP é acionado por **D2**, **D3** e **D3a**. Nesses diagramas a perícia aparece como um bloco pontilhado "Entrou no diagrama de perícia"; no fim, o DP devolve o caso para quem chamou.

Resumo do frame: *O Jurídico sempre inicia a tarefa de perícia para o Atendimento. O Atendimento marca com o cliente, coloca a data no card e prepara o cliente com o documento que o sistema monta. Na avaliação social, o sistema identifica o perito nomeado no processo e a IA monta a orientação pelo perfil desse perito, guardado no Vector Store. Depois da perícia, o Jurídico confere o resultado no GERID ou no processo: favorável sobe no card e devolve para quem pediu; desfavorável, o Jurídico decide entre pedir nova perícia ou devolver com o resultado desfavorável.*

Cada passo aponta para o código acordado no README (`DP.01`…). O executor segue a legenda "Como ler" do board pela cor do cartão: **[Pessoa]** (azul), **[IA]** (verde), **[Sistema]** (cinza), **[Scanner]** (laranja), **[Externo]** (borda tracejada). Toda ação da IA tem uma pessoa que confere.

## Raias

Na ordem das faixas do frame (de cima para baixo):

- **ATENDIMENTO** — marca a perícia, coloca a data na ficha e prepara o cliente.
- **DOCUMENTAÇÃO · ADM** — reúne o que a perícia pede.
- **SISTEMA · REGRAS** — agenda o lembrete, identifica o perito e monta a orientação (com a IA); pede nova perícia.
- **JURÍDICO** — inicia a tarefa, confere o resultado, atualiza o perfil do perito (com a IA) e decide o desfecho.
- **INSS OU JUSTIÇA** (externa, faixa tracejada) — o perito realiza a perícia.

## Passos

### JURÍDICO

- **Início** Perícia pedida (D2, D3 ou D3a) — evento que entra dos diagramas que chamam o DP.
- **DP.01 [Pessoa]** Iniciar a tarefa de perícia — para o Atendimento.
- **DP.08 [Pessoa]** Conferir o resultado no GERID ou no processo — o Jurídico acompanha dentro do DP.
- **Decisão · O resultado é favorável?** (ver Decisões).
- **[Pessoa]** Jurídico avalia o resultado — nova perícia, recurso ou aceitar.
- **Decisão · Vale pedir nova perícia?** (ver Decisões).
- **[Pessoa]** Subir no card — perícia favorável.

### ATENDIMENTO

- **DP.02 [Pessoa]** Marcar a perícia — com o cliente.
- **Decisão · A tentativa deu certo?** (ver Decisões).
- **DP.04 [Pessoa]** Colocar a data na ficha — do cliente.
- **DP.06 [Pessoa]** Receber o documento e preparar o cliente — data, local, o que levar e, na social, como é a visita em casa.
- **Decisão · O cliente compareceu?** (ver Decisões).

### DOCUMENTAÇÃO · ADM

- **DP.03 [Pessoa]** Reunir o que a perícia pede — laudos e exames, ou CadÚnico e grupo familiar.

### SISTEMA · REGRAS

- **DP.04 [Sistema]** Receber a data do card — agenda o lembrete da véspera.
- **Decisão · Qual perícia?** (ver Decisões) — abre a orientação (`DP.05`).
- **DP.05 [Sistema]** Identificar o perito nomeado — lê no processo, pela base de processos (acervo).
- **Decisão · O perito tem perfil na base?** (ver Decisões).
- **DP.05 [IA]** Montar a orientação padrão — perícia médica, ou social de perito ainda sem perfil.
- **DP.05 [IA]** Montar a orientação pelo perfil do perito — o que esse perito observa, pergunta e pede na visita.
- **[Sistema]** Pedir nova perícia — já sobe a tarefa para o Atendimento marcar de novo.
- **[Armazenamento]** Vector Store (RAG) — perfil dos peritos, consultado e atualizado.

### IA · LLM (dentro da faixa JURÍDICO)

- **DP.09 [IA]** Atualizar o perfil do perito — lê o laudo da avaliação social e grava no RAG.

### INSS OU JUSTIÇA (externa)

- **[Externo]** Perito do INSS ou do juízo realiza a perícia — na social, visita a casa do cliente (linha tracejada cinza).

## Decisões (gateways)

1. **A tentativa deu certo?** (raia ATENDIMENTO, depois de `DP.02` Marcar a perícia)
   - **Sim: marcado** → `DP.03` Reunir o que a perícia pede.
   - **Não: tenta de novo** → volta para `DP.02` Marcar a perícia.
2. **Qual perícia?** (raia SISTEMA · REGRAS, depois de `DP.04` Receber a data do card) — símbolo ✕ (exclusivo).
   - **Social** → `DP.05` Identificar o perito nomeado.
   - **Médica** → `DP.05` Montar a orientação padrão.
3. **O perito tem perfil na base?** (raia SISTEMA · REGRAS, depois de Identificar o perito nomeado)
   - **Sim** → `DP.05` Montar a orientação pelo perfil do perito.
   - **Não: perito novo** → `DP.05` Montar a orientação padrão.
   - (as duas orientações convergem num gateway ✕ e seguem para `DP.06`.)
4. **O cliente compareceu?** (raia ATENDIMENTO, depois de `DP.06` Preparar o cliente)
   - **Sim: entra na perícia** → o perito realiza a perícia (raia externa).
   - **Não** → o Atendimento marca de novo (volta para `DP.02`).
5. **O resultado é favorável?** (raia JURÍDICO, depois de `DP.08` Conferir o resultado) — corresponde a `DP.10`.
   - **Sim** → Subir no card → **▶ DEVOLVE PARA** o diagrama que pediu (favorável).
   - **Não** → Jurídico avalia o resultado → decisão "Vale pedir nova perícia?".
6. **Vale pedir nova perícia?** (raia JURÍDICO) — parte de `DP.10`.
   - **Sim** → Pedir nova perícia (sobe a tarefa: marcar de novo, volta para `DP.02`).
   - **Não: devolve** → **▶ DEVOLVE PARA** o diagrama que pediu (desfavorável).

## Fluxos e sequência

Marcação e preparo: evento "Perícia pedida (D2, D3 ou D3a)" → `DP.01` Iniciar a tarefa de perícia —(tarefa de perícia)→ `DP.02` Marcar a perícia → gateway "A tentativa deu certo?" (Não volta a marcar) → (Sim) `DP.03` Reunir o que a perícia pede → `DP.04` Colocar a data na ficha → `DP.04` Receber a data do card (lembrete da véspera) → gateway "Qual perícia?".

Orientação (`DP.05`): pelo ramo **Médica** → Montar a orientação padrão; pelo ramo **Social** → Identificar o perito nomeado → gateway "O perito tem perfil na base?" → (Sim) Montar a orientação pelo perfil do perito; (Não: perito novo) Montar a orientação padrão. As duas convergem e o documento segue para `DP.06` Receber o documento e preparar o cliente → gateway "O cliente compareceu?".

Perícia e resultado: (Sim: entra na perícia) o perito realiza a perícia (externa) —(perícia feita, tracejada)→ `DP.08` Conferir o resultado no GERID ou no processo → gateway `DP.10` "O resultado é favorável?". Se **Sim**: Subir no card → devolve favorável. Se **Não**: Jurídico avalia o resultado → "Vale pedir nova perícia?": **Sim** → Pedir nova perícia (volta a `DP.02`); **Não** → devolve desfavorável.

Aprendizado do perfil (`DP.09`): depois de `DP.08`, se for social, o laudo segue para "Atualizar o perfil do perito" (IA), que grava no Vector Store (linha pontilhada roxa, "grava"). O perfil é consultado por "Montar a orientação pelo perfil do perito" (linha pontilhada roxa, "perfil do perito").

Ligações com outros diagramas:
- **Entra de D2, D3 ou D3a** — evento "Perícia pedida (D2, D3 ou D3a)".
- **Devolve para o diagrama que pediu** — duas pastilhas "▶ DEVOLVE PARA": uma com perícia favorável, outra com perícia desfavorável.

## Documentos e sistemas citados

- **GERID** — onde o resultado da perícia do INSS aparece (`DP.08`).
- **Processo** — onde o laudo da perícia da Justiça sai (`DP.08`).
- **CadÚnico e grupo familiar** — documentos da avaliação social (`DP.03`).
- **Laudos e exames** — documentos da perícia médica (`DP.03`).
- **Vector Store (RAG)** — base com o perfil de cada perito; consultada em `DP.05` e atualizada em `DP.09`.
- **Acervo de processos judiciais** — informa quem é o perito nomeado (base usada em `DP.05`).
- **Card do processo / ficha do cliente** — onde entram a data, o lembrete e o resultado.
- **Lembrete da véspera** — agendado pelo sistema em `DP.04`.

## Regras e travas

Os comentários do board são regra de negócio; viram critério de aceite ou portão em `docs/requisitos/portoes-governanca.md`.

- **💡 QUEM CHAMA ESTE FLUXO** — "D2, D3 e D3a. Nesses diagramas a perícia aparece como um bloco pontilhado 'Entrou no diagrama de perícia'. No fim, devolve para quem chamou."
- **⚠️ ATENÇÃO** — "Faltar sem justificativa pode prejudicar o pedido. Se o cliente não foi, o Atendimento entra em contato e marca de novo. Limite de remarcações a definir: passou dele, sobe para o Jurídico." → portão **G15** (`docs/requisitos/portoes-governanca.md`). O limite de remarcações está **a definir** (`docs/requisitos/duvidas-abertas.md`).
- **📝 OBSERVAÇÃO** — "O resultado não sai na hora da perícia: no INSS aparece no GERID; na Justiça, o laudo sai no processo. O Jurídico acompanha dentro do DP e decide o próximo passo."
- **📝 OBSERVAÇÃO** — "O acervo de processos judiciais já informa quem é o perito nomeado. Com o perito definido, o sistema busca o perfil dele no Vector Store."
- **⚠️ ATENÇÃO** — "A orientação prepara o cliente para a visita: o que o perito costuma observar, perguntar e pedir. Nunca orientar o cliente a esconder ou mudar a real situação da casa: isso é fraude e põe o processo e o escritório em risco." → portão **G11** (e, no espírito de G20, `docs/requisitos/portoes-governanca.md`).

## A conferir (divergências board × README)

- **DP.05** cobre no board uma sub-rotina inteira com cinco elementos (gateways "Qual perícia?" e "O perito tem perfil na base?", "Identificar o perito nomeado", "Montar a orientação padrão" e "Montar a orientação pelo perfil do perito"). Confirmar na validação se o código permanece único ou se é desmembrado.
- **DP.04** aparece em dois cartões ("Colocar a data na ficha" [Pessoa, Atendimento] e "Receber a data do card / lembrete" [Sistema]).
- **DP.10** está desenhado como dois gateways em sequência ("O resultado é favorável?" e "Vale pedir nova perícia?") mais os cartões "Jurídico avalia o resultado", "Subir no card" e "Pedir nova perícia".
- O passo novo `DP.00` (Recomendação sobre a perícia), citado no README como ainda não desenhado, **não** aparece neste frame — segue pendente de desenho no Miro.
- Há uma ligação roxa de "Vector Store (RAG)" para "Montar a orientação padrão" no board, além da esperada para "Montar a orientação pelo perfil do perito"; confirmar se a orientação padrão também consulta o acervo ou se é ligação a rever.
