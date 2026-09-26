# Histórias candidatas do GGV Previdenciário

89 candidatas, uma por arquivo, no template de `../template-historia.md`. Geradas em 26/09/2026 a partir do BPMN do Miro (frames "revisão BPMN") e do roteiro de laudos do escritório.

Cada candidata vira cartão no Jira (`GGVP`) com o rótulo `a-validar-bpmn` e o rótulo do passo (`bpmn-d1-05`). Quando o cartão existir, renomeie o arquivo para `GGVP-<n>-<descricao>.md` e troque a chave no título.

| Diagrama | Chave | História | Perfil | Passo | Prio. | Est. |
|---|---|---|---|---|---|---|
| Histórias transversais | [T-01](T-01-tela-inicial-o-que-e-meu-hoje.md) | Tela inicial "O que é meu hoje" por perfil | qualquer pessoa da equipe | todas as raias humanas | 1 | M |
| Histórias transversais | [T-02](T-02-conversar-com-o-portal-em-linguagem-natural.md) | Conversar com o portal em linguagem natural | qualquer pessoa da equipe | transversal | 2 | G |
| Histórias transversais | [T-03](T-03-navegar-pelo-caso-numa-linha-so.md) | Navegar pelo caso numa linha só | pessoa do Jurídico ou do Atendimento | transversal (D1 a D3b) | 2 | M |
| Histórias transversais | [T-04](T-04-tarefa-com-laco-lembrete-e-escalonamento.md) | Tarefa com laço, lembrete e escalonamento | sênior | D1.23, D2.05, D3.04, D3a.03, DP.02, DP.07 | 1 | M |
| Histórias transversais | [T-05](T-05-perfis-e-permissoes.md) | Perfis e permissões | gestão do escritório |  |  |  |
| Histórias transversais | [T-06](T-06-historico-de-quem-fez-o-que-incluindo.md) | Histórico de quem fez o quê, incluindo a IA | sênior |  |  |  |
| Histórias transversais | [T-07](T-07-mensagens-ao-cliente-com-modelo-e-registro.md) | Mensagens ao cliente com modelo e registro | Atendimento |  |  |  |
| Histórias transversais | [T-08](T-08-cofre-de-senhas-do-gov-br.md) | Cofre de senhas do gov.br | Atendimento ou Jurídico | D1.05, D1.08, D1.09, D5.02 |  |  |
| Histórias transversais | [T-09](T-09-configuracao-do-escritorio.md) | Configuração do escritório | gestão do escritório |  |  |  |
| D1 | [PREV-01](PREV-01-reconhecer-quem-chegou-e-para-que.md) | Reconhecer quem chegou e para quê | Atendimento | `D1.01`, `D1.04` | 1 | M |
| D1 | [PREV-02](PREV-02-receber-documento-entregue-no-balcao.md) | Receber documento entregue no balcão | Documentação | `D1.02` | 2 | P |
| D1 | [PREV-03](PREV-03-confirmar-o-agendamento-do-lead.md) | Confirmar o agendamento do lead | Atendimento | `D1.04` | 2 | P |
| D1 | [PREV-04](PREV-04-preencher-a-ficha-de-atendimento.md) | Preencher a ficha de atendimento | cliente ou lead | `D1.05` | 1 | M |
| D1 | [PREV-05](PREV-05-segunda-ficha-para-auxilio-acidentario.md) | Segunda ficha para auxílio acidentário | advogada responsável | `D1.07` | 3 | P |
| D1 | [PREV-06](PREV-06-preparar-a-conversa-lendo-a-ficha.md) | Preparar a conversa lendo a ficha | advogada responsável | `D1.06`, `D1.07` | 2 | P |
| D1 | [PREV-07](PREV-07-renovar-a-senha-do-gov-br-antes.md) | Renovar a senha do gov.br antes da entrevista | Atendimento | `D1.08` | 2 | P |
| D1 | [PREV-08](PREV-08-entrevistar-com-gravacao.md) | Entrevistar com gravação | advogada responsável | `D1.09` | 1 | M |
| D1 | [PREV-09](PREV-09-cadastrar-o-lead-depois-da-entrevista.md) | Cadastrar o lead depois da entrevista | advogada responsável | `D1.10` | 2 | P |
| D1 | [PREV-10](PREV-10-transcrever-a-entrevista.md) | Transcrever a entrevista | advogada responsável | `D1.11` | 2 | M |
| D1 | [PREV-11](PREV-11-definir-o-beneficio-com-apoio-do-acervo.md) | Definir o benefício com apoio do acervo | advogada responsável | `D1.12` | 1 | M |
| D1 | [PREV-12](PREV-12-calcular-tempo-e-pontos-sobre-o-cnis.md) | Calcular tempo e pontos sobre o CNIS | advogada responsável | `D1.13` | 2 | M |
| D1 | [PREV-13](PREV-13-registrar-por-que-nao-virou-cliente-e.md) | Registrar por que não virou cliente e recontatar | Atendimento | `D1.14` | 2 | M |
| D1 | [PREV-14](PREV-14-kit-de-documentos-por-beneficio.md) | Kit de documentos por benefício | Atendimento | `D1.15` | 1 | M |
| D1 | [PREV-15](PREV-15-preencher-o-contrato-pelo-modelo-e-conferir.md) | Preencher o contrato pelo modelo e conferir | Atendimento | `D1.16` | 1 | M |
| D1 | [PREV-16](PREV-16-assinatura-digital-pelo-zapsign.md) | Assinatura digital pelo ZapSign | Atendimento | `D1.17` | 1 | M |
| D1 | [PREV-17](PREV-17-assinatura-em-papel-na-entrevista.md) | Assinatura em papel na entrevista | Atendimento | `D1.17` | 2 | P |
| D1 | [PREV-18](PREV-18-ler-e-arquivar-os-documentos.md) | Ler e arquivar os documentos | Documentação | `D1.18` | 1 | M |
| D1 | [PREV-19](PREV-19-verificar-o-contrato-assinado.md) | Verificar o contrato assinado | Atendimento | `D1.19` | 2 | M |
| D1 | [PREV-20](PREV-20-copia-do-contrato-para-o-cliente-levar.md) | Cópia do contrato para o cliente levar | Atendimento | `D1.20` | 4 | P |
| D1 | [PREV-21](PREV-21-checklist-de-documentos-obrigatorios-do-beneficio.md) | Checklist de documentos obrigatórios do benefício | Documentação | `D1.21` | 1 | M |
| D1 | [PREV-22](PREV-22-boas-vindas-ao-cliente.md) | Boas-vindas ao cliente | Atendimento | `D1.22` | 3 | P |
| D1 | [PREV-23](PREV-23-cobrar-os-documentos-pendentes.md) | Cobrar os documentos pendentes | Atendimento | `D1.23` | 1 | M |
| D1 | [PREV-24](PREV-24-liberar-o-caso-ao-juridico.md) | Liberar o caso ao Jurídico | Atendimento | `D1.24` | 1 | P |
| D2 | [PREV-25](PREV-25-conferencia-do-senior-antes-do-inss.md) | Conferência do sênior antes do INSS | sênior | `D2.01` | 1 | M |
| D2 | [PREV-26](PREV-26-protocolar-no-meu-inss.md) | Protocolar no Meu INSS | estagiário ou assistente jurídico | `D2.02` | 1 | M |
| D2 | [PREV-27](PREV-27-mandar-para-pericia-quando-o-beneficio-pede.md) | Mandar para perícia quando o benefício pede | advogada responsável | `D2.03` | 2 | P |
| D2 | [PREV-28](PREV-28-vigiar-o-meu-inss-todo-dia.md) | Vigiar o Meu INSS todo dia | advogada responsável | `D2.04` | 1 | G |
| D2 | [PREV-29](PREV-29-tratar-exigencia-do-inss.md) | Tratar exigência do INSS | advogada responsável | `D2.05` | 1 | M |
| D2 | [PREV-30](PREV-30-beneficio-deferido-prestacao-de-contas-e-ida.md) | Benefício deferido: prestação de contas e ida ao banco | advogada responsável | `D2.06` | 2 | M |
| D2 | [PREV-31](PREV-31-indeferido-segue-para-a-justica.md) | Indeferido segue para a Justiça | advogada responsável | `D2.07` | 1 | P |
| D3 | [PREV-32](PREV-32-registrar-o-motivo-do-indeferimento.md) | Registrar o motivo do indeferimento | quem viu o indeferimento | `D3.01` | 1 | P |
| D3 | [PREV-33](PREV-33-a-ia-analisa-o-motivo-e-a.md) | A IA analisa o motivo e a sênior despacha | sênior | `D3.02`, `D3.03` | 1 | G |
| D3 | [PREV-34](PREV-34-lacos-dos-setores-ate-subir-o-card.md) | Laços dos setores até subir o card | Atendimento ou Documentação | `D3.04` | 1 | M |
| D3 | [PREV-35](PREV-35-pedir-a-peticao-e-a-ia-escrever.md) | Pedir a petição e a IA escrever | advogada responsável | `D3.05` | 1 | G |
| D3 | [PREV-36](PREV-36-conferir-a-peticao.md) | Conferir a petição | advogada responsável | `D3.06` | 1 | M |
| D3 | [PREV-37](PREV-37-pacote-travas-e-protocolo-no-tribunal.md) | Pacote, travas e protocolo no tribunal | advogada responsável | `D3.07` | 1 | G |
| D3a | [PREV-38](PREV-38-vigiar-o-processo-e-ler-a-publicacao.md) | Vigiar o processo e ler a publicação | advogada responsável | `D3a.01` | 1 | M |
| D3a | [PREV-39](PREV-39-analisar-a-exigencia-e-criar-a-tarefa.md) | Analisar a exigência e criar a tarefa do setor | advogada responsável | `D3a.02` | 1 | M |
| D3a | [PREV-40](PREV-40-lacos-dos-setores-na-exigencia-do-juiz.md) | Laços dos setores na exigência do juiz | Atendimento, Jurídico ou Documentação | `D3a.03` | 1 | P |
| D3a | [PREV-41](PREV-41-manifestar-e-protocolar.md) | Manifestar e protocolar | advogada responsável | `D3a.04` | 1 | M |
| D3b | [PREV-42](PREV-42-procedente-acompanhar-o-pagamento.md) | Procedente: acompanhar o pagamento | advogada responsável | `D3b.01` | 2 | M |
| D3b | [PREV-43](PREV-43-prestacao-de-contas-montada-pela-ia-e.md) | Prestação de contas montada pela IA e OK da advogada | advogada responsável | `D3b.02` | 1 | M |
| D3b | [PREV-44](PREV-44-financeiro-recebe-e-cliente-e-avisado.md) | Financeiro recebe e cliente é avisado | Atendimento | `D3b.03` | 2 | P |
| D3b | [PREV-45](PREV-45-improcedente-decidir-se-recorre.md) | Improcedente: decidir se recorre | advogada responsável | `D3b.04` | 1 | P |
| D3b | [PREV-46](PREV-46-estudo-de-caso-do-processo-perdido.md) | Estudo de caso do processo perdido | sênior | `D3b.05` | 2 | M |
| D3b | [PREV-47](PREV-47-explicar-o-resultado-ao-cliente.md) | Explicar o resultado ao cliente | Atendimento | `D3b.06` | 3 | P |
| D4 | [PREV-48](PREV-48-receber-e-casar-a-publicacao-pelo-numero.md) | Receber e casar a publicação pelo número CNJ | advogada responsável | `D4.01` | 1 | M |
| D4 | [PREV-49](PREV-49-vigiar-3-vezes-por-dia-com-alarme.md) | Vigiar 3 vezes por dia com alarme de falha | sênior | `D4.01` | 1 | P |
| D4 | [PREV-50](PREV-50-classificar-o-ato-e-contar-o-prazo.md) | Classificar o ato e contar o prazo | advogada responsável | `D4.02`, `D4.03` | 1 | G |
| D4 | [PREV-51](PREV-51-encaminhar-pelo-tipo-de-ato.md) | Encaminhar pelo tipo de ato | advogada responsável | `D4.04` | 1 | P |
| D4 | [PREV-52](PREV-52-medir-ganho-e-perda-e-gravar-no.md) | Medir ganho e perda e gravar no acervo | sênior | `D4.05`, `D4.06` | 2 | G |
| D4 | [PREV-53](PREV-53-buscar-no-acervo-antes-de-escrever.md) | Buscar no acervo antes de escrever | advogada responsável | `D4.07` | 1 | M |
| DP | [PREV-54](PREV-54-iniciar-a-tarefa-de-pericia.md) | Iniciar a tarefa de perícia | advogada responsável | `DP.01` | 1 | P |
| DP | [PREV-55](PREV-55-marcar-a-pericia-com-o-cliente.md) | Marcar a perícia com o cliente | Atendimento | `DP.02`, `DP.04` | 1 | M |
| DP | [PREV-56](PREV-56-reunir-o-que-a-pericia-pede.md) | Reunir o que a perícia pede | Documentação | `DP.03` | 2 | P |
| DP | [PREV-57](PREV-57-orientacao-da-pericia-padrao-ou-pelo-perfil.md) | Orientação da perícia, padrão ou pelo perfil do perito | Atendimento | `DP.05` | 2 | G |
| DP | [PREV-58](PREV-58-preparar-o-cliente.md) | Preparar o cliente | Atendimento | `DP.06` | 2 | P |
| DP | [PREV-59](PREV-59-comparecimento-e-remarcacao.md) | Comparecimento e remarcação | Atendimento | `DP.07` | 1 | P |
| DP | [PREV-60](PREV-60-conferir-o-resultado-e-decidir-o-proximo.md) | Conferir o resultado e decidir o próximo passo | advogada responsável | `DP.08`, `DP.10` | 1 | M |
| DP | [PREV-61](PREV-61-atualizar-o-perfil-do-perito.md) | Atualizar o perfil do perito | advogada responsável | `DP.09` | 3 | M |
| D5 | [PREV-62](PREV-62-registrar-a-conversa-por-telefone-ou-presencial.md) | Registrar a conversa por telefone ou presencial | Atendimento ou advogada | `D5.01` | 2 | M |
| D5 | [PREV-63](PREV-63-transcrever-e-identificar-o-que-mudou.md) | Transcrever e identificar o que mudou | advogada responsável | `D5.02` | 2 | M |
| D5 | [PREV-64](PREV-64-atualizar-ficha-e-processo-com-desfazer.md) | Atualizar ficha e processo com desfazer | advogada responsável | `D5.03`, `D5.04` | 2 | M |
| D5 | [PREV-65](PREV-65-pendencia-da-conversa-vira-tarefa.md) | Pendência da conversa vira tarefa | advogada responsável | `D5.05` | 3 | P |
| Governança da documentação médica por benefício | [PREV-66](PREV-66-roteiro-de-conteudo-minimo-por-beneficio-configuravel.md) | Roteiro de conteúdo mínimo por benefício, configurável e versionado | sênior | `D1.21M` | 1 | M |
| Governança da documentação médica por benefício | [PREV-67](PREV-67-classificar-cada-documento-medico-que-entra.md) | Classificar cada documento médico que entra | Documentação | `D1.18` | 1 | M |
| Governança da documentação médica por benefício | [PREV-68](PREV-68-parecer-de-suficiencia-da-documentacao-medica.md) | Parecer de suficiência da documentação médica | advogada responsável | `D1.21M` | 1 | G |
| Governança da documentação médica por benefício | [PREV-69](PREV-69-regras-objetivas-calculadas-por-codigo.md) | Regras objetivas calculadas por código | advogada responsável | `D1.21M` | 1 | M |
| Governança da documentação médica por benefício | [PREV-70](PREV-70-pedir-o-complemento-ao-medico-do-cliente.md) | Pedir o complemento ao médico do cliente | Atendimento | `D1.21M`, `D1.23` | 1 | M |
| Governança da documentação médica por benefício | [PREV-71](PREV-71-portao-sem-parecer-o-caso-nao-anda.md) | Portão: sem parecer, o caso não anda | sênior | `D1.24`, `D2.01`, `D3.05` | 1 | P |
| Governança da documentação médica por benefício | [PREV-72](PREV-72-recomendacao-sobre-a-pericia.md) | Recomendação sobre a perícia | advogada responsável | `DP.00` (novo) | 2 | G |
| Governança da documentação médica por benefício | [PREV-73](PREV-73-aposentadoria-pcd-linha-do-tempo-da-deficiencia.md) | Aposentadoria PCD: linha do tempo da deficiência | advogada responsável | `D1.13`, `D1.21M` | 2 | G |
| Governança da documentação médica por benefício | [PREV-74](PREV-74-auxilio-acidente-prova-do-acidente.md) | Auxílio-Acidente: prova do acidente | Documentação | `D1.21`, `D1.21M` | 2 | P |
| Governança da documentação médica por benefício | [PREV-75](PREV-75-bpc-loas-de-menor-de-16-anos.md) | BPC/LOAS de menor de 16 anos | advogada responsável | `D1.21M` | 2 | P |
| Jurimetria de perito e de juiz | [PREV-76](PREV-76-importar-o-estudo-previo-de-peritos-e.md) | Importar o estudo prévio de peritos e juízes | sênior | `D4.05` | 2 | M |
| Jurimetria de perito e de juiz | [PREV-77](PREV-77-perito-nomeado-identificar-e-mostrar-a-jurimetria.md) | Perito nomeado: identificar e mostrar a jurimetria | advogada responsável | `D4.02N` (novo), `DP.05` | 1 | G |
| Jurimetria de perito e de juiz | [PREV-78](PREV-78-juizo-identificado-mostrar-a-jurimetria.md) | Juízo identificado: mostrar a jurimetria | advogada responsável | `D4.02N` (novo), `D3.05`, `D3b.04` | 2 | G |
| Exigências do juízo: nenhum processo extinto sem julgamento do mérito | [PREV-79](PREV-79-lista-de-exigencias-com-prazo-responsavel-e.md) | Lista de exigências com prazo, responsável e prova | advogada responsável | `D3a.02`, `D3a.03`, `D3a.04`, `D2.05` | 1 | G |
| Exigências do juízo: nenhum processo extinto sem julgamento do mérito | [PREV-80](PREV-80-painel-de-resultado-para-os-socios.md) | Painel de resultado para os sócios | sócio do escritório | `D4.05` | 2 | G |
