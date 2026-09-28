# BPMN — visão geral

> Fonte versionada: [`docs/bpmn/README.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/bpmn/README.md) no repositório. Edite lá (por PR), não na wiki.

# Processos do escritório (BPMN)

Fonte de toda história do backlog. Nada entra no Jira sem apontar para um passo daqui.

## Onde está o BPMN
O desenho vive no **Miro**, board `uXjVHjbveV4=`. Cada processo tem duas versões lado a lado; **vale a da direita**, marcada "revisão BPMN (para conferência)", refeita com o PO em setembro de 2026. O D5 tem só uma versão.

| Diagrama | O que cobre | Frame que vale |
|---|---|---|
| D1 · Entrevista, benefício e documentos | Da chegada do cliente ou lead até o caso liberado ao Jurídico: ficha, entrevista gravada, benefício, contrato no ZapSign, scanner, checklist e cobrança | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978799774) |
| D2 · Via administrativa no INSS | OK do sênior, protocolo no Meu INSS, vigília diária, exigências, deferido (prestação de contas e banco) ou indeferido | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977251201) |
| D3 · Judicialização | Motivo do indeferimento, análise da IA, despacho da sênior, laços dos setores, petição escrita pela IA e conferida, três travas e protocolo | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977559113) |
| D3a · Vigília e exigências do juiz | Publicação lida pela IA, exigência analisada pelo advogado, laços dos setores, manifestação e volta à vigília | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977768761) |
| D3b · Desfecho do mérito | Procedente: pagamento, prestação de contas, Financeiro e aviso. Improcedente: recorrer ou estudo de caso | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978188052) |
| D4 · O diário e o acervo que aprende | Publicação casada pelo CNJ, classificada, prazo contado; acervo (RAG) que aprende com os desfechos | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684978380513) |
| DP · Perícia padrão | Chamado por D2, D3 e D3a: marcar, reunir documentos, orientar o cliente (perfil do perito), conferir o resultado | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684977072953) |
| D5 · Conversa com lead ou cliente em análise | Conversa gravada, transcrita, ficha e processo atualizados pela IA, conferidos pelo Jurídico | [abrir](https://miro.com/app/board/uXjVHjbveV4=/?moveToWidget=3458764684983659886) |

Raias usadas: CLIENTE / LEAD, ATENDIMENTO, JURÍDICO, DOCUMENTAÇÃO · ADM, FINANCEIRO, SISTEMA · REGRAS, IA · LLM, SCANNER · OCR, ACERVO · RAG, e as raias externas INSS e JUSTIÇA.

## Transcrição neste repositório
Cada diagrama tem a transcrição em markdown, no formato dos processos do Trabalhista (raias, passos numerados, decisões, fluxos e as regras vindas dos comentários do board). O Miro continua sendo a fonte; estes arquivos são a cópia versionada, corrigida por PR.

- [D1 · Entrevista, benefício e documentos]([[BPMN-D1]])
- [D2 · Via administrativa no INSS]([[BPMN-D2]])
- [D3 · Judicialização]([[BPMN-D3]])
- [D3a · Vigília e exigências do juiz]([[BPMN-D3a]])
- [D3b · Desfecho do mérito]([[BPMN-D3b]])
- [D4 · Diário e acervo (RAG)]([[BPMN-D4]])
- [D5 · Conversa com lead ou cliente]([[BPMN-D5]])
- [DP · Perícia padrão]([[BPMN-DP]])

## Códigos dos passos
O board ainda não numera os passos. Os códigos abaixo foram propostos em 26/09/2026 e **devem ser gravados nos cartões do Miro** para que história e diagrama fiquem ligados. Rótulo no Jira: `bpmn-d1-05`, `bpmn-dp-07`.

| Diagrama | Passos |
|---|---|
| **D1** Entrevista, benefício e documentos | D1.01 Verificar o agendamento · D1.02 Receber documentos avulsos · D1.03 Encaminhar ao setor da etapa · D1.04 Confirmar o agendamento do lead · D1.05 Preencher a ficha de atendimento · D1.06 Preparar a conversa · D1.07 Analisar a ficha (acidentário e segunda ficha) · D1.08 Senha do gov.br · D1.09 Atender e entrevistar (gravado) · D1.10 Cadastrar o lead · D1.11 Transcrever · D1.12 Definir o benefício (RAG) · D1.13 Calcular tempo e pontos · D1.14 Fechou? Registrar motivo e recontatar · D1.15 Kit de documentos por benefício · D1.16 Preencher o contrato pelo modelo · D1.17 Assinatura digital (ZapSign) ou em papel · D1.18 Scanner e leitura dos documentos · D1.19 Verificar o contrato assinado · D1.20 Cópia impressa · D1.21 Checklist do benefício · D1.22 Boas-vindas · D1.23 Cobrança de pendentes · D1.24 Liberar ao Jurídico |
| **D2** Via administrativa no INSS | D2.01 Conferência do sênior · D2.02 Protocolar no Meu INSS · D2.03 Precisa de perícia? · D2.04 Vigiar o Meu INSS · D2.05 Tratar exigência · D2.06 Deferido: prestação de contas e ida ao banco · D2.07 Indeferido: segue para D3 |
| **D3** Judicialização | D3.01 Registrar o motivo do indeferimento · D3.02 IA analisa o motivo · D3.03 A sênior despacha · D3.04 Laços dos setores · D3.05 Pedir e escrever a petição · D3.06 Conferir a petição · D3.07 Pacote, travas e protocolo |
| **D3a** Vigília e exigências do juiz | D3a.01 Vigiar e ler a publicação · D3a.02 Analisar a exigência e criar a tarefa · D3a.03 Laços dos setores · D3a.04 Manifestar e protocolar |
| **D3b** Desfecho do mérito | D3b.01 Procedente: acompanhar o pagamento · D3b.02 Prestação de contas e OK · D3b.03 Financeiro e aviso ao cliente · D3b.04 Improcedente: vale recorrer? · D3b.05 Estudo de caso · D3b.06 Explicar ao cliente |
| **D4** Diário e acervo | D4.01 Receber e casar a publicação · D4.02 Classificar o ato · D4.03 Contar o prazo · D4.04 Encaminhar pelo tipo de ato · D4.05 Medir ganho e perda · D4.06 Gravar no acervo · D4.07 Buscar antes de escrever |
| **DP** Perícia padrão | DP.01 Iniciar a tarefa de perícia · DP.02 Marcar com o cliente · DP.03 Reunir o que a perícia pede · DP.04 Data na ficha e lembrete · DP.05 Orientação (padrão ou pelo perfil do perito) · DP.06 Preparar o cliente · DP.07 Comparecimento e remarcação · DP.08 Conferir o resultado · DP.09 Atualizar o perfil do perito · DP.10 Favorável ou desfavorável |
| **D5** Conversa com lead ou cliente em análise | D5.01 Registrar a conversa (telefone ou presencial) · D5.02 Transcrever e identificar mudanças · D5.03 Atualizar ficha e processo · D5.04 Jurídico confere · D5.05 Pendência vira tarefa |


**Passos novos, ainda não desenhados** (vieram do roteiro de laudos e da conversa de 26/09): `D1.21M` Analisar a documentação médica, `DP.00` Recomendação sobre a perícia, `D4.02N` Nomeação de perito e identificação do juízo. As histórias ligadas a eles só ficam Prontas quando os passos estiverem no Miro.

## Convenção
- Vale o frame "revisão BPMN" da direita. Versão antiga fica no board só como histórico.
- Correção no processo: primeiro no Miro, depois neste arquivo por PR, citando o frame.
- Passo feito por pessoa, pelo sistema ou pela IA segue a cor da legenda do board ("Como ler"). Toda ação da IA tem uma pessoa que confere, como o board desenha.
- Os comentários do board (dica, atenção, observação) são regra de negócio: cada um virou critério de aceite ou portão em `docs/requisitos/portoes-governanca.md`.

## Como validar (Sprint 0)
Para cada diagrama, o PO senta com quem faz o trabalho na raia e confere: os passos existem e nessa ordem; os "a definir" do board têm resposta (`docs/requisitos/duvidas-abertas.md`); o que falta. A história no Jira perde o rótulo `a-validar-bpmn` quando o passo dela é confirmado.
