# Histórias candidatas do GGV Previdenciário

89 candidatas, uma por arquivo, no template de `../template-historia.md`. Geradas em 26/09/2026 a partir do BPMN do Miro (frames "revisão BPMN") e do roteiro de laudos do escritório.

Cada candidata tem o cartão no Jira `GGVP` (mesma chave do arquivo), com os rótulos `a-validar-bpmn`, o do passo (`bpmn-d1-05`) e a chave provisória original (`prev-01`). Épicos GGVP-1 a GGVP-15.

Ajuste de 29/09/2026 (Lucas): a perícia saiu do Atendimento. GGVP-53, 61, 62 e 66 passaram para o Jurídico administrativo (estagiário ou assistente jurídico); GGVP-49 (o sistema abre a tarefa), 56 (só quando a perícia pede documento novo) e 59 (o perito não vem no PDF do INSS) mudaram o texto; GGVP-31, 70 e 94 foram acertados no mesmo sentido.

| Diagrama | Chave | História | Perfil | Passo | Prio. | Est. |
|---|---|---|---|---|---|---|
| Histórias transversais | [GGVP-78](GGVP-78-tela-inicial-o-que-e-meu-hoje.md) | Tela inicial "O que é meu hoje" por perfil | qualquer pessoa da equipe | todas as raias humanas | 1 | M |
| Histórias transversais | [GGVP-82](GGVP-82-conversar-com-o-portal-em-linguagem-natural.md) | Conversar com o portal em linguagem natural | qualquer pessoa da equipe | transversal | 2 | G |
| Histórias transversais | [GGVP-86](GGVP-86-navegar-pelo-caso-numa-linha-so.md) | Navegar pelo caso numa linha só | pessoa do Jurídico ou do Atendimento | transversal (D1 a D3b) | 2 | M |
| Histórias transversais | [GGVP-94](GGVP-94-tarefa-com-laco-lembrete-e-escalonamento.md) | Tarefa com laço, lembrete e escalonamento | sênior | D1.23, D2.05, D3.04, D3a.03, DP.02, DP.07 | 1 | M |
| Histórias transversais | [GGVP-96](GGVP-96-perfis-e-permissoes.md) | Perfis e permissões | gestão do escritório |  |  |  |
| Histórias transversais | [GGVP-99](GGVP-99-historico-de-quem-fez-o-que-incluindo.md) | Histórico de quem fez o quê, incluindo a IA | sênior |  |  |  |
| Histórias transversais | [GGVP-102](GGVP-102-mensagens-ao-cliente-com-modelo-e-registro.md) | Mensagens ao cliente com modelo e registro | Atendimento |  |  |  |
| Histórias transversais | [GGVP-103](GGVP-103-cofre-de-senhas-do-gov-br.md) | Cofre de senhas do gov.br | Atendimento ou Jurídico | D1.05, D1.08, D1.09, D5.02 |  |  |
| Histórias transversais | [GGVP-104](GGVP-104-configuracao-do-escritorio.md) | Configuração do escritório | gestão do escritório |  |  |  |
| D1 | [GGVP-16](GGVP-16-reconhecer-quem-chegou-e-para-que.md) | Reconhecer quem chegou e para quê | Atendimento | `D1.01`, `D1.04` | 1 | M |
| D1 | [GGVP-17](GGVP-17-receber-documento-entregue-no-balcao.md) | Receber documento entregue no balcão | Documentação | `D1.02` | 2 | P |
| D1 | [GGVP-21](GGVP-21-confirmar-o-agendamento-do-lead.md) | Confirmar o agendamento do lead | Atendimento | `D1.04` | 2 | P |
| D1 | [GGVP-24](GGVP-24-preencher-a-ficha-de-atendimento.md) | Preencher a ficha de atendimento | cliente ou lead | `D1.05` | 1 | M |
| D1 | [GGVP-28](GGVP-28-segunda-ficha-para-auxilio-acidentario.md) | Segunda ficha para auxílio acidentário | advogada responsável | `D1.07` | 3 | P |
| D1 | [GGVP-32](GGVP-32-preparar-a-conversa-lendo-a-ficha.md) | Preparar a conversa lendo a ficha | advogada responsável | `D1.06`, `D1.07` | 2 | P |
| D1 | [GGVP-36](GGVP-36-renovar-a-senha-do-gov-br-antes.md) | Renovar a senha do gov.br antes da entrevista | Atendimento | `D1.08` | 2 | P |
| D1 | [GGVP-40](GGVP-40-entrevistar-com-gravacao.md) | Entrevistar com gravação | advogada responsável | `D1.09` | 1 | M |
| D1 | [GGVP-43](GGVP-43-cadastrar-o-lead-depois-da-entrevista.md) | Cadastrar o lead depois da entrevista | advogada responsável | `D1.10` | 2 | P |
| D1 | [GGVP-46](GGVP-46-transcrever-a-entrevista.md) | Transcrever a entrevista | advogada responsável | `D1.11` | 2 | M |
| D1 | [GGVP-51](GGVP-51-definir-o-beneficio-com-apoio-do-acervo.md) | Definir o benefício com apoio do acervo | advogada responsável | `D1.12` | 1 | M |
| D1 | [GGVP-57](GGVP-57-calcular-tempo-e-pontos-sobre-o-cnis.md) | Calcular tempo e pontos sobre o CNIS | advogada responsável | `D1.13` | 2 | M |
| D1 | [GGVP-60](GGVP-60-registrar-por-que-nao-virou-cliente-e.md) | Registrar por que não virou cliente e recontatar | Atendimento | `D1.14` | 2 | M |
| D1 | [GGVP-65](GGVP-65-kit-de-documentos-por-beneficio.md) | Kit de documentos por benefício | Atendimento | `D1.15` | 1 | M |
| D1 | [GGVP-69](GGVP-69-preencher-o-contrato-pelo-modelo-e-conferir.md) | Preencher o contrato pelo modelo e conferir | Atendimento | `D1.16` | 1 | M |
| D1 | [GGVP-72](GGVP-72-assinatura-digital-pelo-zapsign.md) | Assinatura digital pelo ZapSign | Atendimento | `D1.17` | 1 | M |
| D1 | [GGVP-77](GGVP-77-assinatura-em-papel-na-entrevista.md) | Assinatura em papel na entrevista | Atendimento | `D1.17` | 2 | P |
| D1 | [GGVP-81](GGVP-81-ler-e-arquivar-os-documentos.md) | Ler e arquivar os documentos | Documentação | `D1.18` | 1 | M |
| D1 | [GGVP-85](GGVP-85-verificar-o-contrato-assinado.md) | Verificar o contrato assinado | Atendimento | `D1.19` | 2 | M |
| D1 | [GGVP-89](GGVP-89-copia-do-contrato-para-o-cliente-levar.md) | Cópia do contrato para o cliente levar | Atendimento | `D1.20` | 4 | P |
| D1 | [GGVP-91](GGVP-91-checklist-de-documentos-obrigatorios-do-beneficio.md) | Checklist de documentos obrigatórios do benefício | Documentação | `D1.21` | 1 | M |
| D1 | [GGVP-97](GGVP-97-boas-vindas-ao-cliente.md) | Boas-vindas ao cliente | Atendimento | `D1.22` | 3 | P |
| D1 | [GGVP-101](GGVP-101-cobrar-os-documentos-pendentes.md) | Cobrar os documentos pendentes | Atendimento | `D1.23` | 1 | M |
| D1 | [GGVP-18](GGVP-18-liberar-o-caso-ao-juridico.md) | Liberar o caso ao Jurídico | Atendimento | `D1.24` | 1 | P |
| D2 | [GGVP-23](GGVP-23-conferencia-do-senior-antes-do-inss.md) | Conferência do sênior antes do INSS | sênior | `D2.01` | 1 | M |
| D2 | [GGVP-27](GGVP-27-protocolar-no-meu-inss.md) | Protocolar no Meu INSS | estagiário ou assistente jurídico | `D2.02` | 1 | M |
| D2 | [GGVP-31](GGVP-31-mandar-para-pericia-quando-o-beneficio-pede.md) | Mandar para perícia quando o benefício pede | advogada responsável | `D2.03` | 2 | P |
| D2 | [GGVP-35](GGVP-35-vigiar-o-meu-inss-todo-dia.md) | Vigiar o Meu INSS todo dia | advogada responsável | `D2.04` | 1 | G |
| D2 | [GGVP-39](GGVP-39-tratar-exigencia-do-inss.md) | Tratar exigência do INSS | advogada responsável | `D2.05` | 1 | M |
| D2 | [GGVP-44](GGVP-44-beneficio-deferido-prestacao-de-contas-e-ida.md) | Benefício deferido: prestação de contas e ida ao banco | advogada responsável | `D2.06` | 2 | M |
| D2 | [GGVP-48](GGVP-48-indeferido-segue-para-a-justica.md) | Indeferido segue para a Justiça | advogada responsável | `D2.07` | 1 | P |
| D3 | [GGVP-52](GGVP-52-registrar-o-motivo-do-indeferimento.md) | Registrar o motivo do indeferimento | quem viu o indeferimento | `D3.01` | 1 | P |
| D3 | [GGVP-54](GGVP-54-a-ia-analisa-o-motivo-e-a.md) | A IA analisa o motivo e a sênior despacha | sênior | `D3.02`, `D3.03` | 1 | G |
| D3 | [GGVP-58](GGVP-58-lacos-dos-setores-ate-subir-o-card.md) | Laços dos setores até subir o card | Atendimento ou Documentação | `D3.04` | 1 | M |
| D3 | [GGVP-63](GGVP-63-pedir-a-peticao-e-a-ia-escrever.md) | Pedir a petição e a IA escrever | advogada responsável | `D3.05` | 1 | G |
| D3 | [GGVP-67](GGVP-67-conferir-a-peticao.md) | Conferir a petição | advogada responsável | `D3.06` | 1 | M |
| D3 | [GGVP-71](GGVP-71-pacote-travas-e-protocolo-no-tribunal.md) | Pacote, travas e protocolo no tribunal | advogada responsável | `D3.07` | 1 | G |
| D3a | [GGVP-74](GGVP-74-vigiar-o-processo-e-ler-a-publicacao.md) | Vigiar o processo e ler a publicação | advogada responsável | `D3a.01` | 1 | M |
| D3a | [GGVP-79](GGVP-79-analisar-a-exigencia-e-criar-a-tarefa.md) | Analisar a exigência e criar a tarefa do setor | advogada responsável | `D3a.02` | 1 | M |
| D3a | [GGVP-83](GGVP-83-lacos-dos-setores-na-exigencia-do-juiz.md) | Laços dos setores na exigência do juiz | Atendimento, Jurídico ou Documentação | `D3a.03` | 1 | P |
| D3a | [GGVP-87](GGVP-87-manifestar-e-protocolar.md) | Manifestar e protocolar | advogada responsável | `D3a.04` | 1 | M |
| D3b | [GGVP-90](GGVP-90-procedente-acompanhar-o-pagamento.md) | Procedente: acompanhar o pagamento | advogada responsável | `D3b.01` | 2 | M |
| D3b | [GGVP-92](GGVP-92-prestacao-de-contas-montada-pela-ia-e.md) | Prestação de contas montada pela IA e OK da advogada | advogada responsável | `D3b.02` | 1 | M |
| D3b | [GGVP-98](GGVP-98-financeiro-recebe-e-cliente-e-avisado.md) | Financeiro recebe e cliente é avisado | Atendimento | `D3b.03` | 2 | P |
| D3b | [GGVP-100](GGVP-100-improcedente-decidir-se-recorre.md) | Improcedente: decidir se recorre | advogada responsável | `D3b.04` | 1 | P |
| D3b | [GGVP-19](GGVP-19-estudo-de-caso-do-processo-perdido.md) | Estudo de caso do processo perdido | sênior | `D3b.05` | 2 | M |
| D3b | [GGVP-22](GGVP-22-explicar-o-resultado-ao-cliente.md) | Explicar o resultado ao cliente | Atendimento | `D3b.06` | 3 | P |
| D4 | [GGVP-26](GGVP-26-receber-e-casar-a-publicacao-pelo-numero.md) | Receber e casar a publicação pelo número CNJ | advogada responsável | `D4.01` | 1 | M |
| D4 | [GGVP-30](GGVP-30-vigiar-3-vezes-por-dia-com-alarme.md) | Vigiar 3 vezes por dia com alarme de falha | sênior | `D4.01` | 1 | P |
| D4 | [GGVP-34](GGVP-34-classificar-o-ato-e-contar-o-prazo.md) | Classificar o ato e contar o prazo | advogada responsável | `D4.02`, `D4.03` | 1 | G |
| D4 | [GGVP-37](GGVP-37-encaminhar-pelo-tipo-de-ato.md) | Encaminhar pelo tipo de ato | advogada responsável | `D4.04` | 1 | P |
| D4 | [GGVP-41](GGVP-41-medir-ganho-e-perda-e-gravar-no.md) | Medir ganho e perda e gravar no acervo | sênior | `D4.05`, `D4.06` | 2 | G |
| D4 | [GGVP-45](GGVP-45-buscar-no-acervo-antes-de-escrever.md) | Buscar no acervo antes de escrever | advogada responsável | `D4.07` | 1 | M |
| DP | [GGVP-49](GGVP-49-iniciar-a-tarefa-de-pericia.md) | Iniciar a tarefa de perícia | advogada responsável | `DP.01` | 1 | P |
| DP | [GGVP-53](GGVP-53-marcar-a-pericia-com-o-cliente.md) | Marcar a perícia com o cliente | Jurídico administrativo (estagiário ou assistente jurídico) | `DP.02`, `DP.04` | 1 | M |
| DP | [GGVP-56](GGVP-56-reunir-o-que-a-pericia-pede.md) | Reunir o que a perícia pede | Documentação | `DP.03` | 2 | P |
| DP | [GGVP-61](GGVP-61-orientacao-da-pericia-padrao-ou-pelo-perfil.md) | Orientação da perícia, padrão ou pelo perfil do perito | Jurídico administrativo (estagiário ou assistente jurídico) | `DP.05` | 2 | G |
| DP | [GGVP-62](GGVP-62-preparar-o-cliente.md) | Preparar o cliente | Jurídico administrativo (estagiário ou assistente jurídico) | `DP.06` | 2 | P |
| DP | [GGVP-66](GGVP-66-comparecimento-e-remarcacao.md) | Comparecimento e remarcação | Jurídico administrativo (estagiário ou assistente jurídico) | `DP.07` | 1 | P |
| DP | [GGVP-70](GGVP-70-conferir-o-resultado-e-decidir-o-proximo.md) | Conferir o resultado e decidir o próximo passo | advogada responsável | `DP.08`, `DP.10` | 1 | M |
| DP | [GGVP-73](GGVP-73-atualizar-o-perfil-do-perito.md) | Atualizar o perfil do perito | advogada responsável | `DP.09` | 3 | M |
| D5 | [GGVP-76](GGVP-76-registrar-a-conversa-por-telefone-ou-presencial.md) | Registrar a conversa por telefone ou presencial | Atendimento ou advogada | `D5.01` | 2 | M |
| D5 | [GGVP-80](GGVP-80-transcrever-e-identificar-o-que-mudou.md) | Transcrever e identificar o que mudou | advogada responsável | `D5.02` | 2 | M |
| D5 | [GGVP-84](GGVP-84-atualizar-ficha-e-processo-com-desfazer.md) | Atualizar ficha e processo com desfazer | advogada responsável | `D5.03`, `D5.04` | 2 | M |
| D5 | [GGVP-88](GGVP-88-pendencia-da-conversa-vira-tarefa.md) | Pendência da conversa vira tarefa | advogada responsável | `D5.05` | 3 | P |
| Governança da documentação médica por benefício | [GGVP-93](GGVP-93-roteiro-de-conteudo-minimo-por-beneficio-configuravel.md) | Roteiro de conteúdo mínimo por benefício, configurável e versionado | sênior | `D1.21M` | 1 | M |
| Governança da documentação médica por benefício | [GGVP-95](GGVP-95-classificar-cada-documento-medico-que-entra.md) | Classificar cada documento médico que entra | Documentação | `D1.18` | 1 | M |
| Governança da documentação médica por benefício | [GGVP-20](GGVP-20-parecer-de-suficiencia-da-documentacao-medica.md) | Parecer de suficiência da documentação médica | advogada responsável | `D1.21M` | 1 | G |
| Governança da documentação médica por benefício | [GGVP-25](GGVP-25-regras-objetivas-calculadas-por-codigo.md) | Regras objetivas calculadas por código | advogada responsável | `D1.21M` | 1 | M |
| Governança da documentação médica por benefício | [GGVP-29](GGVP-29-pedir-o-complemento-ao-medico-do-cliente.md) | Pedir o complemento ao médico do cliente | Atendimento | `D1.21M`, `D1.23` | 1 | M |
| Governança da documentação médica por benefício | [GGVP-33](GGVP-33-portao-sem-parecer-o-caso-nao-anda.md) | Portão: sem parecer, o caso não anda | sênior | `D1.24`, `D2.01`, `D3.05` | 1 | P |
| Governança da documentação médica por benefício | [GGVP-38](GGVP-38-recomendacao-sobre-a-pericia.md) | Recomendação sobre a perícia | advogada responsável | `DP.00` (novo) | 2 | G |
| Governança da documentação médica por benefício | [GGVP-42](GGVP-42-aposentadoria-pcd-linha-do-tempo-da-deficiencia.md) | Aposentadoria PCD: linha do tempo da deficiência | advogada responsável | `D1.13`, `D1.21M` | 2 | G |
| Governança da documentação médica por benefício | [GGVP-47](GGVP-47-auxilio-acidente-prova-do-acidente.md) | Auxílio-Acidente: prova do acidente | Documentação | `D1.21`, `D1.21M` | 2 | P |
| Governança da documentação médica por benefício | [GGVP-50](GGVP-50-bpc-loas-de-menor-de-16-anos.md) | BPC/LOAS de menor de 16 anos | advogada responsável | `D1.21M` | 2 | P |
| Jurimetria de perito e de juiz | [GGVP-55](GGVP-55-importar-o-estudo-previo-de-peritos-e.md) | Importar o estudo prévio de peritos e juízes | sênior | `D4.05` | 2 | M |
| Jurimetria de perito e de juiz | [GGVP-59](GGVP-59-perito-nomeado-identificar-e-mostrar-a-jurimetria.md) | Perito nomeado: identificar e mostrar a jurimetria | advogada responsável | `D4.02N` (novo), `DP.05` | 1 | G |
| Jurimetria de perito e de juiz | [GGVP-64](GGVP-64-juizo-identificado-mostrar-a-jurimetria.md) | Juízo identificado: mostrar a jurimetria | advogada responsável | `D4.02N` (novo), `D3.05`, `D3b.04` | 2 | G |
| Exigências do juízo: nenhum processo extinto sem julgamento do mérito | [GGVP-68](GGVP-68-lista-de-exigencias-com-prazo-responsavel-e.md) | Lista de exigências com prazo, responsável e prova | advogada responsável | `D3a.02`, `D3a.03`, `D3a.04`, `D2.05` | 1 | G |
| Exigências do juízo: nenhum processo extinto sem julgamento do mérito | [GGVP-75](GGVP-75-painel-de-resultado-para-os-socios.md) | Painel de resultado para os sócios | sócio do escritório | `D4.05` | 2 | G |

## Chave provisória → Jira
Mapa completo em `mapa-chaves.json` (para quem tiver a versão anterior deste documento com as chaves PREV-nn e T-nn).
