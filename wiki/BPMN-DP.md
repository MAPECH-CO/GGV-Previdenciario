> Fonte versionada: [`docs/bpmn/DP.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/bpmn/DP.md) no repositório. Edite lá (por PR), não na wiki.

# DP · Perícia padrão (revisão BPMN)

**Fonte:** frame "DP · Perícia padrão · revisão BPMN (para conferência)" no Miro, board `uXjVHjbveV4=`. [Abrir no Miro](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977072953) (frame `3458764684977072953`).
**Estado:** revisão feita com o PO em setembro de 2026 e ajustada no Miro em 29/09/2026 (Lucas e Fernando): o Atendimento sai da perícia, a raia dele passa a ser JURÍDICO (ADMINISTRATIVO) e entram as raias externas PERITO, INSS OU JUSTIÇA e CLIENTE. Vale este frame; a versão antiga fica no board só como histórico.
**Início:** Perícia pedida (evento vindo de **D2, D3 ou D3a**), na raia SISTEMA · REGRAS. **Fim:** "▶ DEVOLVE PARA o diagrama que pediu", com perícia favorável ou desfavorável.

> **Fluxo chamado por outros diagramas.** O DP é acionado por **D2**, **D3** e **D3a**. Nesses diagramas a perícia aparece como um bloco pontilhado "Entrou no diagrama de perícia"; no fim, o DP devolve o caso para quem chamou.

Resumo do frame: *O sistema abre sozinho a tarefa de perícia e a advogada só decide. O Jurídico administrativo marca a perícia no INSS, sobe o comprovante em PDF (data, hora, local e tipo; o perito não vem no PDF), liga e orienta o cliente e remarca se ele faltar. O sistema lê o comprovante, agenda o lembrete da véspera e monta a orientação (na social, pelo perfil do perito no Vector Store). Depois da perícia, o Jurídico confere o resultado no GERID ou no processo. Ajuste de 29/09/2026 (Lucas e Fernando): o Atendimento sai da perícia e entram as raias externas PERITO, INSS ou Justiça e CLIENTE.*

Cada passo aponta para o código acordado no README (`DP.01`…). O executor segue a legenda "Como ler" do board pela cor do cartão: **[Pessoa]** (azul), **[IA]** (verde), **[Sistema]** (cinza), **[Scanner]** (laranja), **[Externo]** (borda tracejada; na legenda, "Externo (fora do escritório)"). Toda ação da IA tem uma pessoa que confere. A legenda das linhas diz: "Linha tracejada cinza: mensagem com quem está fora do escritório (INSS, Justiça, perito ou cliente)".

Os cartões externos não têm código no Miro. Os códigos `DP.E1` a `DP.E4` citados abaixo são a **proposta** de 29/09/2026, já usada no Figma e ainda a confirmar com o PO (ver `README.md`).

## Raias

Na ordem das faixas do frame (de cima para baixo):

- **JURÍDICO (ADMINISTRATIVO)** (era ATENDIMENTO) — o estagiário ou assistente jurídico marca a perícia no portal do INSS, decide se ela pede documento novo, sobe o comprovante em PDF, liga e orienta o cliente e, se ele faltar, marca de novo.
- **DOCUMENTAÇÃO · ADM** — reúne o que a perícia pede, quando o Jurídico administrativo decide que ela pede documento novo.
- **SISTEMA · REGRAS** — abre a tarefa de perícia, lê o comprovante e agenda o lembrete, identifica o perito e monta a orientação (com a IA); pede nova perícia.
- **JURÍDICO** — confere o resultado, atualiza o perfil do perito (com a IA) e decide o desfecho.
- **PERITO** (externa, faixa tracejada) — o perito do INSS ou do juízo realiza a perícia.
- **INSS OU JUSTIÇA** (externa, faixa tracejada) — o INSS confirma o agendamento e emite o comprovante; o INSS ou a Justiça divulga o resultado.
- **CLIENTE** (externa, faixa tracejada) — comparece à perícia; na social, recebe a visita em casa.

## Passos

### JURÍDICO (ADMINISTRATIVO)

- **DP.02 [Pessoa]** Marcar a perícia no INSS — o Jurídico administrativo marca no portal do INSS.
- **Decisão · A tentativa deu certo?** (ver Decisões).
- **Decisão · Pede documento novo?** (ver Decisões) — nova em 29/09; quem decide é o Jurídico administrativo.
- **DP.02 [Pessoa]** Subir o comprovante (PDF) — no card do cliente; o sistema lê.
- **DP.06 [Pessoa]** Ligar e orientar o cliente — data, local, o que levar e, na social, como é a visita em casa.
- **Decisão · DP.07 · O cliente compareceu?** (ver Decisões).

### DOCUMENTAÇÃO · ADM

- **DP.03 [Pessoa]** Reunir o que a perícia pede — laudos e exames, ou CadÚnico e grupo familiar.

### SISTEMA · REGRAS

- **Início** Perícia pedida (D2, D3 ou D3a) — evento que entra dos diagramas que chamam o DP.
- **DP.01 [Sistema]** Abrir a tarefa de perícia — o sistema abre sozinho quando a perícia é pedida; a advogada só decide.
- **DP.04 [Sistema]** Ler o comprovante e agendar o lembrete — data, hora, local e tipo (sem o perito); lembrete da véspera.
- **Decisão · Qual perícia?** (ver Decisões) — abre a orientação (`DP.05`).
- **DP.05 [Sistema]** Identificar o perito nomeado — lê no processo, pela base de processos (acervo).
- **Decisão · O perito tem perfil na base?** (ver Decisões).
- **DP.05 [IA]** Montar a orientação padrão — perícia médica, ou social de perito ainda sem perfil.
- **DP.05 [IA]** Montar a orientação pelo perfil do perito — o que esse perito observa, pergunta e pede na visita.
- **DP.10 [Sistema]** Pedir nova perícia — já sobe a tarefa para o Jurídico administrativo marcar de novo.
- **[Armazenamento]** Vector Store (RAG) — perfil dos peritos, consultado e atualizado.

### JURÍDICO

- **DP.08 [Pessoa]** Conferir o resultado no GERID ou no processo — o Jurídico acompanha dentro do DP.
- **Decisão · O resultado é favorável?** (ver Decisões).
- **[Pessoa]** Jurídico avalia o resultado — nova perícia, recurso ou aceitar.
- **Decisão · Vale pedir nova perícia?** (ver Decisões).
- **[Pessoa]** Subir no card — perícia favorável.

### IA · LLM (dentro da faixa JURÍDICO)

- **DP.09 [IA]** Atualizar o perfil do perito — lê o laudo da avaliação social e grava no RAG.

### PERITO (externa)

- **[Externo]** Perito do INSS ou do juízo realiza a perícia · na social, visita a casa do cliente — recebe o "Sim: entra na perícia" do `DP.07` e manda a mensagem "perícia feita" (proposta `DP.E3`).

### INSS OU JUSTIÇA (externa)

- **[Externo]** INSS confirma o agendamento e emite o comprovante (PDF) — data, hora, local e tipo; o perito não vem no PDF. Manda a mensagem "comprovante (PDF)" para `DP.02` Subir o comprovante (proposta `DP.E1`).
- **[Externo]** INSS ou Justiça divulga o resultado — no INSS aparece no GERID; na Justiça, o laudo sai no processo. Recebe "perícia feita" do perito e manda "resultado no GERID ou no processo" para `DP.08` (proposta `DP.E4`).

### CLIENTE (externa)

- **[Externo]** Cliente comparece à perícia — na social, recebe a visita em casa. Manda a mensagem "comparece ou falta" para a decisão `DP.07` (proposta `DP.E2`).

## Decisões (gateways)

1. **A tentativa deu certo?** (raia JURÍDICO (ADMINISTRATIVO), depois de `DP.02` Marcar a perícia no INSS)
   - **Sim: marcado** → decisão "Pede documento novo?".
   - **Não: tenta de novo** → volta para `DP.02` Marcar a perícia no INSS.
2. **Pede documento novo?** (nova em 29/09; quem decide é o Jurídico administrativo)
   - **Sim** → a Documentação faz `DP.03` Reunir o que a perícia pede, que segue para `DP.02` Subir o comprovante (PDF).
   - **Não** → `DP.02` Subir o comprovante (PDF).
3. **Qual perícia?** (raia SISTEMA · REGRAS, depois de `DP.04` Ler o comprovante e agendar o lembrete) — símbolo ✕ (exclusivo).
   - **Social** → `DP.05` Identificar o perito nomeado.
   - **Médica** → `DP.05` Montar a orientação padrão.
4. **O perito tem perfil na base?** (raia SISTEMA · REGRAS, depois de Identificar o perito nomeado)
   - **Sim** → `DP.05` Montar a orientação pelo perfil do perito.
   - **Não: perito novo** → `DP.05` Montar a orientação padrão.
   - (as duas orientações convergem num gateway ✕ e seguem para `DP.06`.)
5. **DP.07 · O cliente compareceu?** (raia JURÍDICO (ADMINISTRATIVO), depois de `DP.06` Ligar e orientar o cliente; recebe a mensagem "comparece ou falta" do cliente)
   - **Sim: entra na perícia** → o perito realiza a perícia (raia PERITO).
   - **Não** → o Jurídico administrativo marca de novo (volta para `DP.02`).
6. **O resultado é favorável?** (raia JURÍDICO, depois de `DP.08` Conferir o resultado) — corresponde a `DP.10`.
   - **Sim** → Subir no card → **▶ DEVOLVE PARA** o diagrama que pediu (favorável).
   - **Não** → Jurídico avalia o resultado → decisão "Vale pedir nova perícia?".
7. **Vale pedir nova perícia?** (raia JURÍDICO) — parte de `DP.10`.
   - **Sim** → `DP.10` Pedir nova perícia (sobe a tarefa para o Jurídico administrativo marcar de novo, volta para `DP.02`).
   - **Não: devolve** → **▶ DEVOLVE PARA** o diagrama que pediu (desfavorável).

## Fluxos e sequência

Marcação: evento "Perícia pedida (D2, D3 ou D3a)" → `DP.01` Abrir a tarefa de perícia (sistema) —(tarefa de perícia)→ `DP.02` Marcar a perícia no INSS → gateway "A tentativa deu certo?" (Não: tenta de novo) → (Sim: marcado) gateway "Pede documento novo?" → (Sim) `DP.03` Reunir o que a perícia pede → `DP.02` Subir o comprovante (PDF); (Não) direto para `DP.02` Subir o comprovante (PDF). O comprovante vem de fora: o INSS confirma o agendamento e emite o PDF, que chega pela mensagem tracejada "comprovante (PDF)". Depois, `DP.04` Ler o comprovante e agendar o lembrete (sistema) → gateway "Qual perícia?".

Orientação (`DP.05`): pelo ramo **Médica** → Montar a orientação padrão; pelo ramo **Social** → Identificar o perito nomeado → gateway "O perito tem perfil na base?" → (Sim) Montar a orientação pelo perfil do perito; (Não: perito novo) Montar a orientação padrão. As duas convergem e o documento segue para `DP.06` Ligar e orientar o cliente → decisão `DP.07` "O cliente compareceu?", que espera a mensagem "comparece ou falta" do cliente.

Perícia e resultado: (Sim: entra na perícia) o perito do INSS ou do juízo realiza a perícia (raia PERITO) —(perícia feita, tracejada)→ o INSS ou a Justiça divulga o resultado (raia INSS OU JUSTIÇA) —(resultado no GERID ou no processo, tracejada)→ `DP.08` Conferir o resultado no GERID ou no processo → gateway `DP.10` "O resultado é favorável?". Se **Sim**: Subir no card → devolve favorável. Se **Não**: Jurídico avalia o resultado → "Vale pedir nova perícia?": **Sim** → `DP.10` Pedir nova perícia (volta a `DP.02`, com o Jurídico administrativo); **Não** → devolve desfavorável.

Esperas: os quatro cartões externos são esperas. O fluxo só segue quando o INSS emite o comprovante (retoma em `DP.02` Subir o comprovante), quando o cliente comparece ou falta (retoma em `DP.07`), quando o perito faz a perícia e quando o resultado aparece (retoma em `DP.08`).

Aprendizado do perfil (`DP.09`): depois de `DP.08`, se for social, o laudo segue para "Atualizar o perfil do perito" (IA), que grava no Vector Store (linha pontilhada roxa, "grava"). O perfil é consultado por "Montar a orientação pelo perfil do perito" (linha pontilhada roxa, "perfil do perito").

Ligações com outros diagramas:
- **Entra de D2, D3 ou D3a** — evento "Perícia pedida (D2, D3 ou D3a)". No D2, o INSS libera o agendamento da perícia ao receber o requerimento (mensagem "agendamento liberado" para o bloco DP do `D2.03`).
- **Devolve para o diagrama que pediu** — duas pastilhas "▶ DEVOLVE PARA": uma com perícia favorável, outra com perícia desfavorável.

## Documentos e sistemas citados

- **Portal do INSS** — onde o Jurídico administrativo marca a perícia (`DP.02`).
- **Comprovante do agendamento (PDF do INSS)** — traz data, hora, local e tipo da perícia; o perito não vem no PDF. Sobe no card do cliente (`DP.02`) e o sistema lê (`DP.04`).
- **GERID** — onde o resultado da perícia do INSS aparece (`DP.08`).
- **Processo** — onde o laudo da perícia da Justiça sai (`DP.08`).
- **CadÚnico e grupo familiar** — documentos da avaliação social (`DP.03`).
- **Laudos e exames** — documentos da perícia médica (`DP.03`).
- **Vector Store (RAG)** — base com o perfil de cada perito; consultada em `DP.05` e atualizada em `DP.09`.
- **Acervo de processos judiciais** — informa quem é o perito nomeado (base usada em `DP.05`); o comprovante do INSS não traz o perito.
- **Card do processo / ficha do cliente** — onde entram o comprovante, a data lida dele, o lembrete e o resultado.
- **Lembrete da véspera** — agendado pelo sistema em `DP.04`, a partir do comprovante.

## Regras e travas

Os comentários do board são regra de negócio; viram critério de aceite ou portão em `docs/requisitos/portoes-governanca.md`.

- **💡 QUEM CHAMA ESTE FLUXO** — "D2, D3 e D3a. Nesses diagramas a perícia aparece como um bloco pontilhado 'Entrou no diagrama de perícia'. No fim, devolve para quem chamou."
- **💡 RAIAS EXTERNAS** (novo em 29/09/2026) — "PERITO, INSS ou Justiça e CLIENTE ficam fora do escritório. O passo numa raia externa é uma espera: o fluxo só segue quando o evento acontece (o INSS emite o comprovante, o cliente comparece, o perito faz a perícia, o resultado aparece)."
- **⚠️ ATENÇÃO** — "Faltar sem justificativa pode prejudicar o pedido. Se o cliente não foi, o Jurídico administrativo entra em contato e marca de novo. Limite de remarcações a definir: passou dele, sobe para a advogada." → portão **G15** (`docs/requisitos/portoes-governanca.md`). O limite de remarcações está **a definir** (`docs/requisitos/duvidas-abertas.md`).
- **📝 OBSERVAÇÃO** — "O resultado não sai na hora da perícia: no INSS aparece no GERID; na Justiça, o laudo sai no processo. O Jurídico acompanha dentro do DP e decide o próximo passo."
- **📝 OBSERVAÇÃO** — "O acervo de processos judiciais já informa quem é o perito nomeado. Com o perito definido, o sistema busca o perfil dele no Vector Store."
- **⚠️ ATENÇÃO** — "A orientação prepara o cliente para a visita: o que o perito costuma observar, perguntar e pedir. Nunca orientar o cliente a esconder ou mudar a real situação da casa: isso é fraude e põe o processo e o escritório em risco." → portão **G11** (e, no espírito de G20, `docs/requisitos/portoes-governanca.md`).

## A conferir (divergências board × README)

- **DP.05** cobre no board uma sub-rotina inteira com cinco elementos (gateways "Qual perícia?" e "O perito tem perfil na base?", "Identificar o perito nomeado", "Montar a orientação padrão" e "Montar a orientação pelo perfil do perito"). Confirmar na validação se o código permanece único ou se é desmembrado.
- **DP.02** cobre dois cartões desde 29/09 ("Marcar a perícia no INSS" e "Subir o comprovante (PDF)"); o **DP.04** voltou a ser um cartão só (o sistema lê o comprovante). Confirmar na validação se o DP.02 continua com um código só.
- **DP.10** está desenhado como dois gateways em sequência ("O resultado é favorável?" e "Vale pedir nova perícia?") mais os cartões "Jurídico avalia o resultado", "Subir no card" e "DP.10 · Pedir nova perícia".
- O passo novo `DP.00` (Recomendação sobre a perícia), citado no README como ainda não desenhado, **não** aparece neste frame — segue pendente de desenho no Miro.
- Há uma ligação roxa de "Vector Store (RAG)" para "Montar a orientação padrão" no board, além da esperada para "Montar a orientação pelo perfil do perito"; confirmar se a orientação padrão também consulta o acervo ou se é ligação a rever.
- Limite de remarcações (G15): **a definir**. Passou dele, sobe para a advogada.
- Códigos dos cartões externos: a proposta `DP.E1` a `DP.E4` **não** foi gravada no Miro; aguarda o Lucas.
