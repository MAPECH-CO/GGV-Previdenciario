# Governança da documentação médica por benefício

**Fonte:** "Roteiro de conteúdo mínimo para laudos, relatórios e prontuários médicos" (PDF do escritório, recebido em 26/09/2026). Cobre BPC/LOAS Deficiente, Aposentadoria da Pessoa com Deficiência, Auxílio por Incapacidade Temporária (previdenciária ou acidentária), Aposentadoria por Incapacidade Permanente e Auxílio-Acidente.

**Regra que esta seção cria:** o caso só anda quando a documentação médica demonstra o que o benefício exige. A IA lê e aponta; uma pessoa do Jurídico confirma; só a sênior dispensa, e com justificativa registrada.

**Passos novos, a incluir no BPMN:** `D1.21M` Analisar a documentação médica (entre o checklist e a liberação ao Jurídico), `DP.00` Recomendação sobre a perícia, `D4.02N` Nomeação de perito e identificação do juízo. Pela regra do repositório ("nenhuma história nasce de opinião"), essas histórias só ficam Prontas quando os passos estiverem desenhados no Miro.

## Tipos de documento médico (o que cada um prova)
| Tipo | O que prova | Limite |
|---|---|---|
| Atestado | Um fato pontual: afastamento por N dias numa data | Indício de incapacidade na data; não descreve quadro nem evolução |
| Relatório médico | Histórico desde o diagnóstico: início da doença, tratamentos, evolução, limitações funcionais, prognóstico | É o documento que mais carrega o que o benefício exige |
| Laudo | Conclusão técnica sobre a condição, com base em exame clínico e complementares | Resumo; precisa estar alinhado ao requisito do benefício |
| Prontuário | Registro cronológico de todos os atendimentos (hospital, UBS, CAPS, clínica) | Prova a continuidade do tratamento e ajuda a fixar a data de início da doença ou da incapacidade |

## Matriz por benefício (vira configuração, PREV-66)
| Benefício | O que precisa ser demonstrado | Itens obrigatórios no laudo ou relatório | Contradição que bloqueia | Documentos complementares |
|---|---|---|---|---|
| **BPC/LOAS Deficiente** | Impedimento de longo prazo (físico, mental, intelectual ou sensorial) que, com barreiras, obstrui a participação social; duração mínima de 2 anos | a. natureza do impedimento · b. data de início e se persiste · c. prognóstico (duração ou permanente) · d. limitações funcionais concretas · e. barreiras (dependência de terceiros, acompanhamento contínuo, transporte, tratamento) | Soma de início até a cessação prevista menor que 24 meses | Menor de 16 anos: relatórios escolares, de terapias (fono, TO, psicologia) e do CAPS; impacto na participação social e nos cuidados que limitam o trabalho dos responsáveis |
| **Aposentadoria da Pessoa com Deficiência** | Deficiência de longo prazo durante os períodos de contribuição, com o grau (leve, moderado, grave) | a. data de início (ou congênita, expressa) · b. permanente ou transitório · c. grau, com justificativa · d. evolução com datas · e. limitações nos domínios sensorial, comunicação, mobilidade, cuidados pessoais, vida doméstica, educação, trabalho e vida econômica, socialização · f. adaptações e barreiras no trabalho · tipo de deficiência e CID | Laudo que afirma incapacidade total para o trabalho (a pessoa precisa ter trabalhado com a deficiência) | Laudos e prontuários contemporâneos aos vínculos; documentos da empresa: contratação por cota, ASO, exame admissional que cita a deficiência |
| **Auxílio por Incapacidade Temporária** (previdenciária ou acidentária) | Incapacidade total e temporária para a atividade habitual por mais de 15 dias, com qualidade de segurado e carência na data de início da incapacidade (DII) | a. profissão ou atividade habitual · b. data de início da doença (DID) e da incapacidade (DII) · c. correlação entre doença e atividade · d. tempo estimado de afastamento ou data provável de recuperação · e. tratamento em curso e cirurgia, procedimento ou exame aguardado, com previsão | Soma de atestados de doenças sem correlação clínica, ou fora da janela de 60 dias | Atestados, exames, comprovante de agendamento de cirurgia ou procedimento |
| **Aposentadoria por Incapacidade Permanente** | Incapacidade total e permanente para qualquer atividade que garanta a subsistência, sem possibilidade de reabilitação | a. incapacidade total e permanente · b. impossibilidade de reabilitação · c. prognóstico (irreversível, crônico, progressivo, degenerativo, sem melhora) · d. histórico de tratamentos · e. condições pessoais (idade, escolaridade, histórico profissional) | Laudo que indica incapacidade temporária ou reabilitação possível | Histórico de tratamentos, internações, cirurgias |
| **Auxílio-Acidente** | Sequela definitiva, após a consolidação das lesões, que reduz a capacidade para o trabalho habitual (acidente de trabalho, trajeto, trânsito, doméstico, ou doença ocupacional) | a. descrição do acidente (data, circunstância, lesão) · b. tratamentos e afastamento · c. consolidação das lesões · d. sequela definitiva descrita de forma objetiva · e. nexo causal · f. repercussão da sequela na atividade habitual · tipo de lesão, CID e data do acidente | Lesão ainda não consolidada | CAT, boletim de ocorrência, ficha do pronto-socorro, prontuário da internação ou cirurgia, exames de imagem da época e posteriores à alta |

**Sobre as frases-chave do roteiro:** o sistema usa as frases-chave para **reconhecer** no documento se o requisito foi atendido, nunca para **ditar** ao médico o que escrever (G20).

## Histórias
- [PREV-66 · Roteiro de conteúdo mínimo por benefício, configurável e versionado](candidatas/PREV-66-roteiro-de-conteudo-minimo-por-beneficio-configuravel.md)
- [PREV-67 · Classificar cada documento médico que entra](candidatas/PREV-67-classificar-cada-documento-medico-que-entra.md)
- [PREV-68 · Parecer de suficiência da documentação médica](candidatas/PREV-68-parecer-de-suficiencia-da-documentacao-medica.md)
- [PREV-69 · Regras objetivas calculadas por código](candidatas/PREV-69-regras-objetivas-calculadas-por-codigo.md)
- [PREV-70 · Pedir o complemento ao médico do cliente](candidatas/PREV-70-pedir-o-complemento-ao-medico-do-cliente.md)
- [PREV-71 · Portão: sem parecer, o caso não anda](candidatas/PREV-71-portao-sem-parecer-o-caso-nao-anda.md)
- [PREV-72 · Recomendação sobre a perícia](candidatas/PREV-72-recomendacao-sobre-a-pericia.md)
- [PREV-73 · Aposentadoria PCD: linha do tempo da deficiência](candidatas/PREV-73-aposentadoria-pcd-linha-do-tempo-da-deficiencia.md)
- [PREV-74 · Auxílio-Acidente: prova do acidente](candidatas/PREV-74-auxilio-acidente-prova-do-acidente.md)
- [PREV-75 · BPC/LOAS de menor de 16 anos](candidatas/PREV-75-bpc-loas-de-menor-de-16-anos.md)
