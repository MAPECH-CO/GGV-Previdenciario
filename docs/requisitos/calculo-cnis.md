# Memória de cálculo do CNIS — versão rgps-comum-1

Implementada na parte 3 do fechamento das telas. Pedro informou em 11/10/2026 que não conhece uma planilha aprovada e autorizou consulta exclusivamente às fontes públicas oficiais do INSS e do Planalto. Consulta em 11/10/2026. Nenhum CNIS real foi consultado.

## Fundamentos

A [IN PRES/INSS 128 consolidada, arts. 190, 191 e 206 a 210](https://portalin.inss.gov.br/in/214) distingue a carência conforme a categoria, trata de recolhimentos em atraso e do mínimo mensal. Até a reforma a contagem é de data a data; depois, novembro de 2019 inclusive pode contar integralmente. A consolidação consultada informa atualização em 12/08/2026. A advogada precisa reconhecer a validade dos períodos e dos ajustes; a tela não infere essa validade do intervalo.

A [EC 103/2019, art. 15, § 2º](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm) determina a apuração da idade e do tempo em dias para o somatório de pontos. A pontuação isolada não comprova elegibilidade.

## Convenções explícitas da implementação

Datas passam por campos e são calculadas em UTC. Limites do vínculo são inclusivos, com união dos dias até outubro/2019. A partir da referência em 13/11/2019, novembro/2019 e os meses seguintes são competências inteiras, sem duplicação. Referência anterior conserva contagem diária. Data futura, fim antes do início e período anterior ao nascimento são rejeitados.

A interpretação aritmética do art. 207, parágrafo único, é: grupos de 12 competências = 365 dias; meses residuais = 30 dias. Soma-se essa parcela aos dias anteriores. Pontos = (dias civis completos desde o nascimento até a referência + dias de contribuição) / 365. A tela exibe todas as parcelas e trunca a apresentação em duas casas, preservando a fração na função. Essa convenção é identificada por versão e deve ser conferida pelo Jurídico na revisão; não é uma planilha homologada pelo escritório.

Carência é a quantidade de competências distintas marcadas como conferidas. O marcador de carência é independente do marcador de tempo. Pendências não contam para a respectiva parcela e mantêm a prévia identificada como parcial; não significam zero definitivo. A exceção mensal atua sobre todos os vínculos do mês, após avaliação conjunta das remunerações, e não promove vínculo pendente a conferido. A fonte normativa define critérios de reconhecimento; os marcadores são decisões humanas sobre esses critérios, não conclusão automática do programa.

## Limites e integração

Somente memória de tempo comum do RGPS. Não reconhece atividade especial, rural, deficiência, RPPS/CTC, período em benefício, alíquota reduzida, direito adquirido, pedágio ou elegibilidade. Esses períodos exigem análise própria e não devem ser marcados como tempo comum sem essa análise. Vínculo com afastamento deve ser dividido. O início e o fim precisam ser digitados, inclusive o último dia conferido de vínculo aberto.

O formulário usa validação compartilhada em contratos, disponível ao futuro servidor. Ainda não há envio: a rota atual recebe só totais, usa CNIS de exemplo e não associa a memória ao caso. O adaptador antigo não envia esse registro em ficha real. A prévia fica só no estado da tela, desaparece ao sair e não conclui tarefa, portão ou caso. A Sênior vê aviso explícito de consulta indisponível. Persistência, validação no servidor e leitura por caso **esperam a rota do Mateus**.

## Testes

Dados integralmente inventados. Cobrem sobreposições, lacunas, limites inclusivos, fevereiro bissexto, corte da reforma, doze competências e mês residual, carência independente, mínimo mensal sem ajuste, pendências, frações dos pontos, datas inválidas, referência futura e exceções duplicadas/fora dos vínculos. Tela verifica invalidação ao editar, perda do rascunho, API sem fallback e bloqueio de gravação. Playwright fica para o GitHub.
