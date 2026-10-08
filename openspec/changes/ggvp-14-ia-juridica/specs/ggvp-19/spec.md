# Spec Delta · ggvp-19

## Purpose

Estudo de caso do processo perdido (épico Desfecho; entra nesta change porque depende da plataforma de IA). Respostas do Lucas (06/10) no cartão: o estudo é feito automaticamente depois do resultado negativo e vai para uma tela de estudos feitos pela IA, separados por tipo de processo (benefício) e pela chance que o caso tinha; só vira tarefa da Sênior quando o estudo indica entrar com um novo processo, porque há chance de ganho refazendo algumas ações. A Sênior baixa os estudos e manda para a equipe estudar mais a fundo. O estudo é estratégia interna: o Atendimento não vê, e ao cliente vai só o resumo aprovado (GGVP-22). Muda o texto dos CA1 e CA3 do cartão: não há aviso à Sênior por estudo nem a conferência "Li o estudo de caso"; o aviso é a tarefa, só quando há novo processo. CA4 fica: feito o estudo, abre "Aprovar o resumo para o cliente" (GGVP-22), uma vez por caso; quando a confirmação do resultado existir (GGVP-41, GGVP-100), ela abre a explicação direto, sem depender da IA. Fora: abrir o novo processo (nova demanda do cliente, GGVP-124) e medir ganho e perda por matéria, vara e tese (GGVP-41).

## ADDED Requirements

### Requirement: CA1 · O estudo é automático depois do resultado negativo
Para todo caso perdido (improcedente ou extinto sem mérito) ainda sem estudo, a IA SHALL fazer o estudo em segundo plano, sem botão, com o resultado, o texto da decisão, a petição aprovada, o indeferimento do INSS, o despacho, o parecer, as perícias, os documentos e o acervo. O estudo SHALL trazer matéria, vara (se aparece no texto), tese (se a petição está no sistema), resumo, motivo, aprendizado, a chance que o caso tinha ("maior" ou "menor", leitura da IA, sem número) e se vale um novo processo, com o que refazer. Resposta fora do formato MUST NOT virar estudo.

#### Scenario: CA1 · Caso perdido ganha o estudo
- **Dado** um caso improcedente, com a sentença registrada, sem estudo
- **Quando** o sistema faz a rodada de preparo
- **Então** o estudo aparece na tela de estudos, com o motivo e o aprendizado, sem ninguém pedir

#### Scenario: CA1 · Uma vez por caso
- **Dado** um caso perdido que já tem estudo
- **Quando** vem a próxima rodada
- **Então** a IA não é chamada de novo para ele

### Requirement: CA4 · Feito o estudo, a explicação ao cliente
Feito o estudo, SHALL abrir "Aprovar o resumo para o cliente" para a advogada, se o caso ainda não teve essa tarefa; MUST NOT abrir de novo depois de aprovado.

#### Scenario: CA4 · Explicação depois do estudo
- **Dado** um caso perdido sem a explicação ao cliente
- **Quando** o estudo é feito
- **Então** a advogada recebe "Aprovar o resumo para o cliente", uma vez

### Requirement: CA3 · Tarefa só quando o estudo indica novo processo
Quando o estudo indica novo processo, SHALL nascer para a Sênior a tarefa "Revisar estudo de caso", uma vez por caso, que leva à tela de estudos. Ela decide "vamos entrar com novo processo" ou "não vamos"; a decisão fica registrada com quem e quando, com a chamada da IA à parte, e a tarefa fecha. Sem indicação de novo processo, MUST NOT nascer tarefa.

#### Scenario: CA3 · Novo processo indicado
- **Dado** um estudo que indica novo processo
- **Quando** a rodada termina
- **Então** a Sênior tem "Revisar estudo de caso" e, ao decidir, a tarefa fecha com a decisão dela

#### Scenario: CA3 · Sem novo processo
- **Dado** um estudo sem indicação de novo processo
- **Quando** a rodada termina
- **Então** nenhuma tarefa nasce, e o estudo fica só na tela

### Requirement: CA2, CA5 · A tela de estudos e o acervo
A tela "Estudos de caso" SHALL listar os estudos separados por benefício e, dentro dele, por "tínhamos mais chance" e "tínhamos menos chance", com motivo, aprendizado e o que refazer, e um botão para baixar os estudos num arquivo de texto. Só o Jurídico vê (`estudo.ver`); só a Sênior decide a revisão (`estudo.revisar`). O estudo SHALL entrar no acervo (GGVP-45) como "Estudo de caso da IA", com o motivo e o aprendizado e a referência do caso.

#### Scenario: CA5 · Ver e baixar
- **Dado** estudos de dois benefícios
- **Quando** a Sênior abre "Estudos de caso" e baixa
- **Então** vê os estudos separados por benefício e chance, com "Motivo" e "Aprendizado", e o arquivo traz os mesmos estudos

#### Scenario: CA2 · No acervo
- **Dado** o estudo de um caso perdido de BPC
- **Quando** a IA escreve para outro caso de BPC parecido
- **Então** o trecho do estudo entra como fonte "Estudo de caso da IA", com o caso de origem

#### Scenario: Atendimento não vê
- **Dado** o perfil Atendimento
- **Quando** chama a lista de estudos
- **Então** é recusado
