# BPMN — visão geral

> Fonte versionada: [`docs/bpmn/README.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/bpmn/README.md) no repositório. Edite lá (por PR), não na wiki.

# Processos do escritório (BPMN)

Fonte de toda história do backlog. Nada entra no Jira sem apontar para um passo daqui.

## Onde está o BPMN
O desenho vive no **Miro**, board `uXjVHjbveV4=`. Cada processo tem duas versões lado a lado; **vale a da direita**, marcada "revisão BPMN (para conferência)", refeita com o PO em setembro de 2026 e ajustada em 29/09/2026 (raias externas e perícia com o Jurídico administrativo, ver abaixo). O frame do D5 foi apagado do board em 28/09/2026; a transcrição do D5 fica como histórico.

| Diagrama | O que cobre | Frame que vale |
|---|---|---|
| D1 · Entrevista, benefício e documentos | Da chegada do cliente ou lead até o caso liberado ao Jurídico: ficha, entrevista gravada, benefício, contrato no ZapSign, scanner, checklist e cobrança; laudo novo em qualquer fase | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978799774) |
| D2 · Via administrativa no INSS | OK do sênior, protocolo no Meu INSS, vigília diária, exigências, deferido (prestação de contas e banco) ou indeferido | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977251201) |
| D3 · Judicialização | Motivo do indeferimento, análise da IA, despacho da sênior, laços dos setores, petição escrita pela IA e conferida, três travas e protocolo | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977559113) |
| D3a · Vigília e exigências do juiz | Publicação lida pela IA, exigência analisada pelo advogado, laços dos setores, manifestação e volta à vigília | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977768761) |
| D3b · Desfecho do mérito | Procedente: pagamento, prestação de contas, Financeiro e aviso. Improcedente: recorrer ou estudo de caso | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978188052) |
| D4 · O diário e o acervo que aprende | Publicação casada pelo CNJ, classificada, prazo contado; acervo (RAG) que aprende com os desfechos | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978380513) |
| DP · Perícia padrão | Chamado por D2, D3 e D3a: o sistema abre a tarefa; o Jurídico administrativo marca no INSS, sobe o comprovante e orienta o cliente (perfil do perito); o Jurídico confere o resultado | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977072953) |
| D5 · Conversa com lead ou cliente em análise | Conversa gravada, transcrita, ficha e processo atualizados pela IA, conferidos pelo Jurídico | frame apagado do board em 28/09 (a transcrição fica como histórico) |

> **Imagens desatualizadas.** As imagens de `docs/bpmn/img/` no repositório são o export de 28/09/2026. Elas não mostram o ajuste de 29/09 (raias externas, perícia com o Jurídico administrativo, laudo novo no D1) e ficam desatualizadas até novo export do Miro. No Figma, as telas "BPMN · tela cheia" já mostram o desenho de 29/09, numa imagem gerada a partir do conteúdo do board (não é o "Exportar imagem" do Miro; o cabeçalho diz "gerado do Miro em 29/09").

Raias internas: ATENDIMENTO, JURÍDICO, JURÍDICO (ADMINISTRATIVO) (no DP, no lugar do ATENDIMENTO), DOCUMENTAÇÃO · ADM, FINANCEIRO, SISTEMA · REGRAS, IA · LLM, SCANNER · OCR e ACERVO · RAG.

Raias externas (faixa tracejada, fora do escritório): CLIENTE / LEAD no D1; CLIENTE no D2, D3, D3a e DP; INSS no D2; INSS OU JUSTIÇA e PERITO no DP; JUSTIÇA no D3, D3a, D3b e D4. O ajuste de 29/09/2026, pedido pelo Fernando, tracejou a CLIENTE / LEAD do D1 e criou a CLIENTE no D2, D3, D3a e DP, a PERITO no DP e a JUSTIÇA no D3b.

**Regra da espera.** O passo numa raia externa é uma espera: o fluxo do escritório só segue quando o evento acontece (o INSS emite o comprovante, o cliente entrega ou comparece, o perito faz a perícia, a Justiça publica ou libera o pagamento). A ligação com o escritório é a linha tracejada cinza, a mensagem com quem está fora do escritório. Na legenda dos frames, o cartão externo aparece como "Externo (fora do escritório)".

## Transcrição neste repositório
Cada diagrama tem a transcrição em markdown, no formato dos processos do Trabalhista (raias, passos numerados, decisões, fluxos e as regras vindas dos comentários do board). O Miro continua sendo a fonte; estes arquivos são a cópia versionada, corrigida por PR.

- [D1 · Entrevista, benefício e documentos]([[BPMN-D1]])
- [D2 · Via administrativa no INSS]([[BPMN-D2]])
- [D3 · Judicialização]([[BPMN-D3]])
- [D3a · Vigília e exigências do juiz]([[BPMN-D3a]])
- [D3b · Desfecho do mérito]([[BPMN-D3b]])
- [D4 · Diário e acervo (RAG)]([[BPMN-D4]])
- [D5 · Conversa com lead ou cliente]([[BPMN-D5]]) (histórico: o frame foi apagado do board em 28/09)
- [DP · Perícia padrão]([[BPMN-DP]])

## Códigos dos passos
Os códigos abaixo foram propostos em 26/09/2026 e, em 28/09, **gravados nos cartões do Miro** (frames "revisão BPMN" de D1, D2, D3, D3a, D3b, D4 e DP): cada caixa começa com o código, ex. "D1.13 · Calcular tempo e pontos"; nas decisões, "D2.03 · Precisa de perícia?". Em 29/09 os cartões do DP mudaram de nome e de raia; a tabela já traz os nomes novos. O frame do D5 foi apagado do board em 28/09, e os códigos `D5.01` a `D5.05` ficam só como histórico. O glossário dos códigos, com os fluxos numerados, está no Figma ([[Prototipo-Figma]]). Rótulo no Jira: `bpmn-d1-05`, `bpmn-dp-07`.

| Diagrama | Passos |
|---|---|
| **D1** Entrevista, benefício e documentos | D1.01 Verificar o agendamento · D1.02 Receber os documentos (em qualquer fase) e subir o laudo novo · D1.03 Encaminhar ao setor da etapa · D1.04 Confirmar o agendamento do lead · D1.05 Preencher a ficha de atendimento · D1.06 Preparar a conversa · D1.07 Analisar a ficha (acidentário e segunda ficha) · D1.08 Senha do gov.br · D1.09 Atender e entrevistar (gravado) · D1.10 Cadastrar o lead · D1.11 Transcrever · D1.12 Definir o benefício (RAG) · D1.13 Calcular tempo e pontos · D1.14 Fechou? Registrar motivo e recontatar · D1.15 Kit de documentos por benefício · D1.16 Preencher o contrato pelo modelo · D1.17 Assinatura digital (ZapSign) ou em papel · D1.18 Scanner e leitura dos documentos · D1.19 Verificar o contrato assinado · D1.20 Cópia impressa · D1.21 Checklist do benefício · D1.21M Analisar a documentação médica (no subfluxo do laudo novo: a IA lê, compara e resume; a advogada confere) · D1.22 Boas-vindas · D1.23 Cobrança de pendentes · D1.24 Liberar ao Jurídico |
| **D2** Via administrativa no INSS | D2.01 Conferência do sênior · D2.02 Protocolar no Meu INSS · D2.03 Precisa de perícia? · D2.04 Vigiar o Meu INSS · D2.05 Tratar exigência · D2.06 Deferido: prestação de contas e ida ao banco · D2.07 Indeferido: segue para D3 |
| **D3** Judicialização | D3.01 Registrar o motivo do indeferimento · D3.02 IA analisa o motivo · D3.03 A sênior despacha · D3.04 Laços dos setores · D3.05 Pedir e escrever a petição · D3.06 Conferir a petição · D3.07 Pacote, travas e protocolo |
| **D3a** Vigília e exigências do juiz | D3a.01 Vigiar e ler a publicação · D3a.02 Analisar a exigência e criar a tarefa · D3a.03 Laços dos setores · D3a.04 Manifestar e protocolar |
| **D3b** Desfecho do mérito | D3b.01 Procedente: acompanhar o pagamento · D3b.02 Prestação de contas e OK · D3b.03 Financeiro e aviso ao cliente · D3b.04 Improcedente: vale recorrer? · D3b.05 Estudo de caso · D3b.06 Explicar ao cliente |
| **D4** Diário e acervo | D4.01 Receber e casar a publicação · D4.02 Classificar o ato · D4.03 Contar o prazo · D4.04 Encaminhar pelo tipo de ato · D4.05 Medir ganho e perda · D4.06 Gravar no acervo · D4.07 Buscar antes de escrever |
| **DP** Perícia padrão | DP.01 Abrir a tarefa de perícia (o sistema abre sozinho) · DP.02 Marcar a perícia no INSS e subir o comprovante (PDF) · DP.03 Reunir o que a perícia pede (quando pede documento novo) · DP.04 Ler o comprovante e agendar o lembrete · DP.05 Orientação (padrão ou pelo perfil do perito) · DP.06 Ligar e orientar o cliente · DP.07 O cliente compareceu? (comparecimento e remarcação) · DP.08 Conferir o resultado · DP.09 Atualizar o perfil do perito · DP.10 Favorável ou desfavorável (pedir nova perícia) |
| **D5** Conversa com lead ou cliente em análise (histórico) | D5.01 Registrar a conversa (telefone ou presencial) · D5.02 Transcrever e identificar mudanças · D5.03 Atualizar ficha e processo · D5.04 Jurídico confere · D5.05 Pendência vira tarefa |


**Passos novos** (vieram do roteiro de laudos e da conversa de 26/09): `D1.21M` Analisar a documentação médica foi desenhado em 29/09 no subfluxo do laudo novo do D1 (a IA lê o laudo, compara com o que já está no processo e resume; a advogada confere). `DP.00` Recomendação sobre a perícia e `D4.02N` Nomeação de perito e identificação do juízo seguem sem desenho. As histórias ligadas a eles só ficam Prontas quando os passos estiverem no Miro.

**Passos externos (proposta de 29/09/2026, a confirmar com o PO).** Os cartões das raias externas foram desenhados no Miro sem código: a numeração aguarda o Lucas. A proposta põe a letra E depois do diagrama e numera na ordem do fluxo; é a que as listas do BPMN no Figma já usam.

| Código proposto | Raia | Cartão no Miro | O escritório retoma em |
|---|---|---|---|
| D1.E1 | CLIENTE / LEAD | Cliente ou médico manda um laudo novo — em qualquer fase do caso | D1.02 Subir o laudo novo ("manda o laudo") |
| D1.E2 | CLIENTE / LEAD | Cliente assina o contrato — pelo link do ZapSign | "O cliente assinou?" ("assina ou não"), depois do D1.17 Pedir a assinatura ("link do ZapSign") |
| D1.E3 | CLIENTE / LEAD | Cliente entrega os documentos pendentes — o checklist só fecha com tudo (G1) | "O cliente enviou?" ("envia"), na cobrança do D1.23 |
| D2.E1 | INSS | INSS recebe o requerimento — e libera o agendamento da perícia | bloco DP do D2.03 ("agendamento liberado") |
| D2.E2 | INSS | INSS analisa e decide — deferido, indeferido ou nova exigência | D2.04 Vigiar o Meu INSS ("aparece no Meu INSS") |
| D2.E3 | CLIENTE | Cliente entrega o documento — pedido na exigência | "O documento foi conseguido?" ("entrega ou não entrega"), depois do D2.05 Cobrar o cliente ("cobrança") |
| D2.E4 | INSS | INSS analisa a resposta — à exigência | "INSS analisa e decide" ("decide de novo") |
| D3.E1 | CLIENTE | Cliente responde ou entrega o que falta — informação para o Atendimento ou documento para a Documentação | "Conseguiu com o cliente?" ("responde") e "Conseguiu o documento?" ("entrega"), no D3.04 |
| D3.E2 | JUSTIÇA | Juízo recebe a petição inicial | segue para o D3a (vigília do processo) |
| D3a.E1 | JUSTIÇA | Juízo publica no diário | D3a.01 Vigiar por API ("publicação") |
| D3a.E2 | CLIENTE | Cliente responde ou entrega — a informação ou o documento que a exigência pede | "Conseguiu a informação?" ("responde ao Atendimento") e "Conseguiu o documento?" ("entrega o documento"), no D3a.03 |
| D3a.E3 | JUSTIÇA | Juízo recebe a manifestação | volta à vigília (D3a.01) |
| D3b.E1 | JUSTIÇA | Justiça libera o pagamento — RPV ou precatório | D3b.01 Acompanhar o pagamento ("pagamento liberado") |
| D4.E1 | JUSTIÇA | Juízo disponibiliza a intimação | Publicação chega (AASP · DJEN), antes do D4.01 ("publicação") |
| DP.E1 | INSS OU JUSTIÇA | INSS confirma o agendamento e emite o comprovante (PDF) — data, hora, local e tipo; o perito não vem no PDF | DP.02 Subir o comprovante ("comprovante (PDF)") |
| DP.E2 | CLIENTE | Cliente comparece à perícia — na social, recebe a visita em casa | DP.07 O cliente compareceu? ("comparece ou falta") |
| DP.E3 | PERITO | Perito do INSS ou do juízo realiza a perícia · na social, visita a casa do cliente | "INSS ou Justiça divulga o resultado" ("perícia feita") |
| DP.E4 | INSS OU JUSTIÇA | INSS ou Justiça divulga o resultado — no INSS aparece no GERID; na Justiça, o laudo sai no processo | DP.08 Conferir o resultado ("resultado no GERID ou no processo") |

## BPMN dentro do portal (a decidir com o PO)
No protótipo, cada código (ex.: `D1.24`) mostra uma dica ao passar o mouse e abre o fluxo em popup.
Para o portal real há três caminhos, do mais barato ao mais completo:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| 1. Miro embutido | iframe do board com `moveToWidget=<id do frame>` (os mesmos links da tabela acima) | zero exportação; sempre atual | quem vê precisa de login no Miro; a dica por passo fica no portal, não no desenho |
| 2. Imagem exportada | "Exportar como imagem" de cada frame no Miro, guardada em `docs/bpmn/img/`; o portal mostra a imagem | funciona sem login; simples | estática; alguém reexporta a cada mudança; sem hover no desenho (a API do Miro só exporta o board inteiro, e só no plano Enterprise) |
| 3. Diagrama desenhado pelo portal | gerar o diagrama a partir da transcrição versionada (`D1.md`…), por exemplo com bpmn-js | hover e clique em cada passo; versionado e corrigido por PR | mais trabalho; o desenho do Miro continua sendo a fonte visual |

Decisão do PO em 28/09: o BPMN abre **fora do Miro**, dentro do portal, em tela cheia com "Fechar" que
volta à tela anterior. Isso descarta a opção 1; a 2 está em uso (imagens exportadas do Miro em
`docs/bpmn/img/` no repositório, uma por diagrama; no Figma, desde 29/09, imagens geradas a partir do conteúdo do board) e a 3 é o alvo.

**Imagens** (`img/<diagrama>.jpg`, exportadas do Miro em 28/09 pelo Fernando, frames "revisão BPMN"):
quando o desenho mudar no Miro, reexportar o frame (Export → Image, JPG) e substituir o arquivo, no mesmo PR
que corrige o `D<n>.md`. Os frames mudaram em 29/09 e as imagens ainda não foram reexportadas: até lá, elas mostram o desenho de 28/09. O frame do D5 foi apagado do board em 28/09, então o D5 não tem imagem. A dica por passo (código, nome, tipo, raia, descrição) vem de `docs/bpmn/`
nos três casos.

## Convenção
- Vale o frame "revisão BPMN" da direita. Versão antiga fica no board só como histórico.
- Correção no processo: primeiro no Miro, depois neste arquivo por PR, citando o frame.
- Passo feito por pessoa, pelo sistema ou pela IA segue a cor da legenda do board ("Como ler"). Toda ação da IA tem uma pessoa que confere, como o board desenha.
- Passo de quem está fora do escritório fica numa raia externa tracejada e é uma espera (ver "Regra da espera").
- Os comentários do board (dica, atenção, observação) são regra de negócio: cada um virou critério de aceite ou portão em `docs/requisitos/portoes-governanca.md`.

## Como validar (Sprint 0)
Para cada diagrama, o PO senta com quem faz o trabalho na raia e confere: os passos existem e nessa ordem; os "a definir" do board têm resposta (`docs/requisitos/duvidas-abertas.md`); o que falta. A história no Jira perde o rótulo `a-validar-bpmn` quando o passo dela é confirmado.
