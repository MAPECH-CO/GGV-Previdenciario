# Spec Delta · ggvp-158-provas-que-faltam

## Purpose

As provas do servidor dos critérios que a auditoria de 15/10 deixou "não conferido" ou "parcial" por falta de teste. Um
requisito por critério, com o comportamento que o critério pede; cada um tem o seu teste do servidor.

## ADDED Requirements

### Requirement: GGVP-93 CA3 · Benefício sem roteiro pede a conferência manual
Quando o caso chega à análise do parecer e o benefício não tem roteiro cadastrado, o servidor SHALL avisar "benefício sem
roteiro" (na análise e na tarefa do Jurídico) e MUST NOT registrar o parecer sem a conferência manual escrita pela advogada.

#### Scenario: GGVP-93 CA3 · Pensão por morte com laudo
- **Dado** um caso de benefício sem roteiro, com um laudo
- **Quando** a advogada abre o parecer e tenta registrar sem escrever a conferência manual
- **Então** a análise vem como "sem roteiro", sem chamar a IA, a tarefa diz "benefício sem roteiro: conferência manual",
  o registro é recusado com o motivo, e com a conferência escrita ele grava

### Requirement: GGVP-36 CA1 · Ficha sem senha abre "Renovar senha do gov.br"
Quando o Jurídico analisa a ficha de quem não tem a senha do gov.br no cofre, o servidor SHALL abrir para o Atendimento a
tarefa "Renovar senha do gov.br", ligada à entrevista. Com a senha no cofre, MUST NOT abrir.

#### Scenario: GGVP-36 CA1 · Análise sem senha
- **Dado** a entrevista marcada de quem está sem a senha no cofre
- **Quando** a advogada registra a análise da ficha
- **Então** o Atendimento recebe "Renovar senha do gov.br"; com a senha no cofre, a análise não abre a tarefa

### Requirement: GGVP-36 CA4 · O prazo da renovação é o horário da entrevista
A tarefa "Renovar senha do gov.br" SHALL ter como prazo o dia e a hora da entrevista.

#### Scenario: GGVP-36 CA4 · Entrevista amanhã às 14:00
- **Dado** a entrevista de amanhã às 14:00
- **Quando** a análise abre a tarefa de renovar
- **Então** o prazo é "até 09/10 14:00", e no dia da entrevista seria "até 14:00", urgente

### Requirement: GGVP-36 CA7 · A advogada vê o resultado da renovação
O resultado da renovação (renovou ou não conseguiu, com o motivo) SHALL chegar à advogada pela ficha que o servidor devolve,
e a preparação da entrevista MUST mostrá-lo.

#### Scenario: GGVP-36 CA7 · Não conseguiu, depois renovou
- **Dado** o Atendimento que registra "não conseguiu" com o motivo, e depois "renovou"
- **Quando** a advogada abre a ficha da entrevista
- **Então** ela vê, a cada vez, o motivo de não ter conseguido e depois a senha no cofre com a data em que funcionou

### Requirement: GGVP-28 CA1 · "Pode ser acidentário" abre a pendência da segunda ficha
Quando a advogada marca "pode ser acidentário" na análise da ficha, o servidor SHALL abrir para o Atendimento a pendência de
passar a segunda ficha (a FICHA DE ATENDIMENTO AUXILIO ACIDENTE) ao cliente, uma só, com o prazo da entrevista.

#### Scenario: GGVP-28 CA1 · Análise acidentária
- **Dado** a entrevista marcada de quem tem a senha no cofre
- **Quando** a advogada analisa e marca "pode ser acidentário"
- **Então** o Atendimento recebe "Preencher segunda ficha", com a ficha em papel no detalhe; analisar de novo não duplica,
  e "não é acidentário" não abre a pendência

### Requirement: GGVP-51 CA2 · Sem benefício citado, a IA propõe com os casos da casa
Quando a advogada não citou benefício na entrevista, a sugestão do servidor SHALL trazer o benefício proposto pela IA, os
trechos do acervo da casa que ela usou e uma frase dizendo o porquê. A advogada MUST continuar livre para confirmar ou trocar.

#### Scenario: GGVP-51 CA2 · Entrevista sem citar benefício, com caso parecido na casa
- **Dado** a entrevista transcrita sem citar benefício e um caso da casa indeferido pelo mesmo motivo
- **Quando** a sugestão do benefício é pedida
- **Então** o citado vem vazio e a sugestão traz o benefício, o porquê e o trecho do acervo; o pedido à IA leva esse trecho

### Requirement: GGVP-86 CA2 · O bloco "Em perícia" ligado à etapa que pediu
Com uma perícia em andamento, a página do processo do servidor SHALL trazer o bloco da perícia: o tipo, a origem (a etapa
que pediu), a situação e a data marcada.

#### Scenario: GGVP-86 CA2 · Perícia pedida no INSS, ainda sem resultado
- **Dado** a perícia social pedida no D2.03, ainda sem resultado
- **Quando** o Jurídico abre o processo
- **Então** a perícia vem com a origem do D2, e a tela a liga à etapa do INSS

### Requirement: GGVP-86 CA3 · Os setores que ainda não subiram o card
Com o caso parado esperando setores, a página do processo SHALL trazer, por setor, o que cada um deve e quem já cumpriu,
para a tela listar os setores que ainda não subiram o card.

#### Scenario: GGVP-86 CA3 · Exigência com itens de dois setores
- **Dado** a exigência aberta com um item da Documentação cumprido e um do Atendimento pendente
- **Quando** o Jurídico abre o processo
- **Então** os itens vêm por setor, com quem cumpriu e quando, e só o Atendimento fica como setor pendente

### Requirement: GGVP-86 CA5 · "Laudo novo" no cabeçalho do processo
Com um laudo novo ainda não conferido, a página do processo do servidor SHALL dizer que há laudo novo, com a data, e levar
à análise do laudo.

#### Scenario: GGVP-86 CA5 · Laudo que chegou depois do parecer
- **Dado** o caso com parecer registrado e um laudo novo que o Jurídico ainda não conferiu
- **Quando** o Jurídico abre o processo
- **Então** a página traz o laudo novo, com a data, e o caminho da análise

### Requirement: GGVP-86 CA8 · Quem estamos esperando, desde quando e o prazo
Com o caso esperando alguém de fora (cliente, INSS, perito ou Justiça), a página do processo SHALL dizer quem se espera,
desde quando e o prazo ou o lembrete da espera.

#### Scenario: GGVP-86 CA8 · Esperando o cliente
- **Dado** o caso esperando o cliente entregar o documento desde 03/10
- **Quando** o Jurídico abre o processo
- **Então** a página diz o que se espera e desde quando, com o prazo ou o lembrete

### Requirement: GGVP-86 CA9 · As tarefas por setor, as paralelas e as perícias abertas
A página do processo SHALL trazer as tarefas abertas de todos os setores, inclusive as paralelas e as das perícias abertas,
cada uma com o setor, o responsável e o prazo.

#### Scenario: GGVP-86 CA9 · Três setores ao mesmo tempo
- **Dado** tarefas abertas da advogada, da Documentação e do Jurídico administrativo (a de marcar a perícia)
- **Quando** o Jurídico abre o processo
- **Então** as três vêm, cada uma com o setor, o responsável (ou nenhum ainda) e o prazo

### Requirement: GGVP-86 CA11 · A origem e a data do documento
Cada documento do caso na página do processo SHALL vir com a origem (por onde chegou) e a data.

#### Scenario: GGVP-86 CA11 · Documentos do portal e do scanner
- **Dado** um documento que chegou pelo portal e outro pelo scanner
- **Quando** o Jurídico abre o processo
- **Então** cada um vem com a sua origem e a data em que chegou

### Requirement: GGVP-151 CA2 · A chance do caso com a recomendação da perícia aberta
Com a recomendação da perícia aberta (perícia sem resultado), a chance do caso SHALL vir com o número de casos e a data da
base, para a advogada ver antes de marcar.

#### Scenario: GGVP-151 CA2 · Três casos decididos do mesmo benefício
- **Dado** a perícia sem resultado e três desfechos conferidos do mesmo benefício no acervo
- **Quando** a advogada abre a recomendação e a chance
- **Então** a chance traz a porcentagem, os três casos e a data da base

### Requirement: GGVP-38 CA7 · O número vem do código; a IA só explica
O número que aparece junto da recomendação da perícia SHALL vir do código, a partir do acervo; a IA MUST NOT mudar o número
e só explica, com as fontes. A recomendação MUST NOT levar à IA número do perito.

#### Scenario: GGVP-38 CA7 · A IA escreve outro número
- **Dado** a IA de mentira que responde "a chance é de 99%"
- **Quando** a advogada abre a recomendação e a chance
- **Então** a porcentagem é a da conta do código, a explicação da IA vem à parte, com a regra como fonte, e o pedido da
  recomendação diz que o perito não foi identificado

### Requirement: GGVP-156 CA2 · Documentação e Atendimento veem o perito sem os números
A página da perícia SHALL mostrar à Documentação e ao Atendimento o perito e a situação da perícia, e MUST NOT mandar a eles
os números do perito nem os laudos do perfil dele. O Jurídico recebe os números.

#### Scenario: GGVP-156 CA2 · Perito com laudos no perfil
- **Dado** a perícia ligada a um perito com três laudos no perfil
- **Quando** a Documentação, o Atendimento e a advogada abrem a perícia
- **Então** os três veem o nome do perito; só a advogada recebe os números e os laudos

### Requirement: GGVP-95 CA3 · O ilegível vira "reenviar legível" para o Atendimento
Quando a leitura do documento falha, o servidor SHALL guardar o original e abrir para o Atendimento a pendência de pedir o
documento legível ao cliente; o legível do mesmo tipo que chega depois MUST fechar a pendência.

#### Scenario: GGVP-95 CA3 · Laudo ilegível pelo card
- **Dado** o laudo que a leitura não consegue ler
- **Quando** o Atendimento abre a ficha e a sua Central
- **Então** o original fica na pasta, a conferência o lista como ilegível e o Atendimento tem "Pedir documento legível"

### Requirement: GGVP-24 CA9 · A senha de teste fora da exportação e do kit
A senha do gov.br guardada a partir da ficha MUST NOT aparecer na exportação do histórico do caso nem no kit do contrato,
em PDF ou em Word.

#### Scenario: GGVP-24 CA9 · Senha de teste guardada, kit gerado e histórico exportado
- **Dado** a senha de teste guardada no cofre pela ficha, o caso com o kit gerado e a exportação autorizada
- **Quando** o Atendimento baixa o kit (PDF e Word) e a gestão exporta o histórico
- **Então** a senha de teste não aparece em nenhum dos três

### Requirement: GGVP-52 CA2 · O motivo do indeferimento entra no acervo
O motivo salvo no registro do indeferido SHALL ir ao banco de motivos e ao acervo, onde a busca de outro caso o acha, sem o
nome do cliente.

#### Scenario: GGVP-52 CA2 · Indeferido pela renda
- **Dado** o indeferido registrado com o motivo escrito
- **Quando** outro caso busca no acervo pelo motivo, e a rodada alimenta o acervo
- **Então** a busca traz o motivo, com a referência do caso, e o trecho fica gravado no acervo

### Requirement: GGVP-52 CA5 · A falha de gravação fica visível e é refeita sem duplicar
Cada gravação do motivo (o banco de motivos e o acervo) SHALL guardar a referência do caso. A falha em qualquer uma MUST
ficar visível e a nova tentativa MUST gravar uma vez só.

#### Scenario: GGVP-52 CA5 · O armazenamento cai no registro e a IA cai no vetor
- **Dado** o armazenamento que falha na primeira tentativa de registrar o indeferido, e a IA que falha no primeiro vetor
- **Quando** a advogada registra de novo e a rodada do acervo roda de novo
- **Então** a primeira falha volta como erro, sem gravar nada; a segunda grava um resultado só; a falha do vetor aparece nas
  chamadas da IA do caso, e a rodada seguinte completa o mesmo trecho, sem outro
