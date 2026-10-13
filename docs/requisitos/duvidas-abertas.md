# Dúvidas e decisões do produto

Atualizado em 12/10/2026 na GGVP-159, com as decisões fornecidas pelo Pedro. “Respondida” registra a regra do produto; não significa que toda tela ou integração já foi entregue. As pendências abaixo continuam abertas para o Lucas. Não houve consulta ao Jira nesta atualização.

## Perguntas originais

| # | Situação | Resposta ou ponto que falta | Histórias |
|---|---|---|---|
| Q1 | Respondida | Cobrança de documento e confirmação do lead: 2 tentativas, com 3 dias entre elas; depois, Sênior. Remarcação de perícia: 1; depois, advogada responsável. Espera por resposta: lembrete diário. | GGVP-94, 101, 29, 34, 40, 55, 59 |
| Q2 | Respondida | Modelos do escritório em Word, com `{{VARIÁVEIS}}` e sem dados de cliente. Conferência por script que só imprime contagens; limpeza em cópia quando necessária. Pedro faz a subida com a senha da Sênior. ZapSign e variações de honorários ficam fora. A revisão local dos nove modelos está no PR #64, sem modelos versionados. | GGVP-69, 104 |
| Q3 | Parcial | O kit usa o catálogo único de 34 benefícios. Sem checklist aprovado, o caso fica bloqueado e leva à Configuração. A composição pendente do modelo 7 continua com Lucas. Não presumir aprovação dos modelos ou dos checklists. | GGVP-65, 91 |
| Q4 | Parcial | A IA preenche a ficha depois da entrevista e quem atende confere. A Sênior confere e desfaz alterações da IA. O acesso futuro do cliente à ficha pelo celular/tablet não foi decidido nesta história. | GGVP-24, 84 |
| Q5 | Respondida no escopo | Mensagens pelo Chatwoot; orientação da perícia revisada pelo Jurídico. A tela distingue envio real, falha e simulação. O Financeiro liga para avisar o resultado e marcar o banco; mensagem é complemento. | GGVP-102, 97, 98 |
| Q6 | Aberta | Confirmar a operação da vigília do Meu INSS (manual ou automatizada). Não confundir com a vigília de publicações já implementada. | GGVP-35 |
| Q7 | Respondida | O OK continua com a advogada da prestação. A Sênior só consulta, até nova decisão de Pedro. Há entrada e parcelas do contrato, Pix, boleto do escritório e parte na Caixa; valores editáveis antes do OK, com fonte identificada. | GGVP-44, 98 |
| Q8 | Parcial | As travas do Tema 350 continuam. Falta a regra para quando o INSS não enviou carta e a confirmação operacional do peticionamento, se ainda não definida no tribunal. | GGVP-71 |
| Q9 | Respondida | Advogada e Sênior são perfis distintos na matriz versão 28. A Sênior tem conferência, despacho e atribuição no Jurídico; o limite e o resultado da perícia ficam com a advogada responsável. Na prestação, a Sênior lê e a advogada dá o OK. | GGVP-96 |
| Q10 | Parcial | O banco do portal é PostgreSQL no Supabase. O armazenamento e o arquivamento de documentos são outro assunto: há código de armazenamento e de integração com o Drive; a configuração operacional não foi verificada nesta história. | GGVP-81, 71, 107 |
| Q11 | Parcial | Áudio e transcrição ficam guardados para sempre. Documento médico por tempo indeterminado, com controle de guarda posterior; saída da IA segue a regra do conteúdo de origem. A retenção específica de outros dados do perfil do perito não foi definida. Ver ADR-008. | GGVP-40, 62, 61 |
| Q12 | Respondida quanto ao fluxo | O advogado do Atendimento digita os vínculos do CNIS impresso ou baixado do Meu INSS. Tempo, pontos e carência são cálculo em código com teste, nunca IA. Pedro não conhece planilha/regra interna aprovada; não tratar o rascunho do PR #64 como parecer de elegibilidade validado pelo escritório. | GGVP-57 |
| Q13 | Parcial | A jurimetria usa o acervo do servidor e apresenta “N casos · base de dd/mm”, só para o Jurídico e os sócios. Fonte, atualização da base histórica e medição dos fatores ainda precisam de definição. Importador Raio-X adiado por Pedro em 12/10; formato não informado. | GGVP-55, 77, 78 |
| Q14 | Respondida no repositório | Dispensa por duas Sêniores de acordo, com justificativa no histórico (Lucas, 01/10; spec da GGVP-33 e conferência dos critérios). Esta história não muda a regra. | GGVP-33 |
| Q15 | Aberta | Confirmar diferenças de roteiro médico entre a via administrativa e a judicial onde ainda não houver checklist aprovado. | GGVP-20, 71 |
| Q16 | Respondida no repositório | Sem amostra mínima: toda amostra conta, sempre com quantidade e data da base (G22; Lucas, 06/10, e Pedro, 07/10). Sem base, não inventar porcentagem. | GGVP-59, 78 |
| Q17 | Parcial | Jurídico e Sócio acessam conteúdo médico; status, resultado, datas e etapas são de todos que veem o caso. Sem filtro por palavra e sem conteúdo sensível em log. IA pode usar saúde (Lucas, 07/10). Retenção conforme Q11/ADR-008. Região do banco, base contratual e fornecedores seguem pendentes. | GGVP-95, 68, 70 |
| Q18 | Parcial | O catálogo tem 34 benefícios. Checklist não aprovado bloqueia a liberação e leva à Configuração; ter o benefício no catálogo não aprova seu checklist. Roteiros ainda não aprovados continuam pendentes. | GGVP-93 |
| Q19 | Aberta com Lucas | Doença ocupacional do segurado rural sem boletim de ocorrência; confirmar também complementares obrigatórios/desejáveis que ainda não tenham checklist aprovado. | GGVP-47 |
| Q20 | Respondida | O Sócio lê tudo: conteúdo médico, peças, valores e dados bancários; não executa etapas do caso. Valores gerais são do Financeiro e Sócio; advogada vê prestação, valor da causa e renda por pessoa do LOAS. Sênior consulta a prestação. Jurimetria e chance só do Jurídico e sócios. | GGVP-75, 96 |
| Q21 | Respondida (Mateus, 08/10) | Separação de funções fica sem número próprio entre G1–G22. Quem deu o OK na prestação não registra o recebimento; o servidor recusa e registra o código neutro `funcoes`. | GGVP-98, 96 |

## Outras decisões registradas por Pedro

- Documentação trabalha na Central do Atendimento. Pendências aparecem no card de cada cliente e processo; líder do Atendimento e Sênior do Jurídico veem e atribuem as tarefas dos respectivos setores.
- A data da perícia judicial lida da publicação vai à agenda automaticamente, com aviso no processo; o Jurídico revisa a orientação pelo Chatwoot.
- Antes de encerrar item de exigência do juiz sem documento, pedir dilação de prazo ou reagendamento da perícia; só depois justificar.
- A IA recomenda o benefício sempre e a advogada confirma. A IA preenche a ficha depois da entrevista, quem atende confere e a Sênior pode desfazer.
- Valor da causa e renda por pessoa do LOAS ficam visíveis para advogada, Sócio e Financeiro; a disponibilidade dos campos depende das rotas do Mateus, sem ampliar o acesso do Financeiro ao caso ou às peças.

## Continuam abertas com Lucas

| Assunto | O que precisa de resposta |
|---|---|
| Modelo 7 do kit | Conteúdo e aprovação do modelo. |
| Segurado rural | Doença ocupacional sem boletim de ocorrência. |
| Tema 350 | Como proceder quando o INSS não enviou carta. |
| RPV e precatório | Fonte da informação e momento em que nasce a prestação de contas. |
| Custas do processo | Regra, responsável e registro. |
| Chance e resultado de cada ação | Como medir quanto cada ação ajuda e quais fatores pesam na chance; não inventar pesos. |
| Painel “Resultados” | Se todos os resultados devem contar só recebimento confirmado; a implementação atual de cada indicador não substitui a decisão. |
| Logins reais | Pessoas, perfis e entrega dos acessos. Nenhuma credencial neste documento. |
| Importação sem CPF | Tratamento do cliente sem CPF. |
| Justiça Estadual | Escopo e operação. |
| OAB do Dr. Glauco | Informação a confirmar. |
| LGPD e fornecedores | Contratos com OpenAI e Mistral e condições do tratamento/transferência. A autorização funcional de usar saúde não encerra esta pendência. |
| Região do banco | Região do Supabase a aprovar. Não verificada nem alterada nesta história. |
| Treinamento | Data, participantes, responsável e aceite. O material em `docs/treinamento/por-perfil.md` não significa treinamento realizado. |
