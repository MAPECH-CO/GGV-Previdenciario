# Spec Delta · ggvp-107

## Purpose

Integração com o Drive do escritório (passos D1.18, D3.01 e D3.07). Todo documento do caso vai sozinho para a pasta do
cliente, com nome padronizado, e o pacote do protocolo é salvo numa pasta dentro da do cliente. A regra de achar e criar
a pasta é a mesma da automação do balcão (n8n), que já grava em "#5. CLIENTES" e manda para "A REVISAR" o que não tem
dono certo. O Drive guarda arquivo (imagem, PDF, a digitalização do balcão); ninguém trabalha nele. Por isso o motivo de
indeferimento, que é dado, fica no banco do portal (decisão do Mateus em 08/10).

## ADDED Requirements

### Requirement: CA1 · Pasta única por cliente e nome padronizado
O portal SHALL arquivar cada documento do caso na pasta do cliente em "#5. CLIENTES". A pasta é achada pela regra do
balcão: o CPF no título, depois o nome igual sem acento, depois o nome com uma letra de diferença, desde que só uma pasta
fique tão perto. O nome do cliente é o que vem antes do primeiro " X " do título. Sem pasta, o portal SHALL criar
"<Nome> X A CLASSIFICAR". Com mais de uma pasta possível, o documento SHALL ir para "A REVISAR". A pasta achada ou
criada fica guardada no cadastro do cliente, e os próximos documentos vão para ela. O arquivo SHALL se chamar
"Tipo - Nome do Cliente - AAAA-MM-DD", com a data de Brasília, e MUST NOT sobrescrever outro: com o nome repetido,
entra " (2)", " (3)".

#### Scenario: CA1 · Primeiro documento do cliente
- **Dado** um cliente
- **Quando** o primeiro documento é arquivado
- **Então** ele ganha uma pasta única no Drive, e cada documento entra nela com nome padronizado (tipo, data e cliente)

### Requirement: CA2 · O caso guarda o identificador do arquivo
O documento arquivado SHALL guardar no portal o identificador do arquivo no Drive, ao lado dos campos que já tem (tipo,
dado de saúde, hash, origem e a classificação médica). O vínculo é pelo identificador, que o Drive não muda quando o
arquivo é movido.

#### Scenario: CA2 · Mover o arquivo no Drive
- **Dado** um documento arquivado
- **Quando** o caso o registra
- **Então** guarda o identificador do arquivo e os campos extraídos; mover o arquivo no Drive não quebra o vínculo

### Requirement: CA3 · Falha vira tarefa e é reprocessada sem duplicar
O envio ao Drive SHALL rodar sozinho a cada minuto e pegar o que ainda não foi. A falha SHALL abrir uma tarefa da
Documentação no caso, "Arquivo não foi para o Drive (o portal tenta de novo sozinho)", uma só por caso, que fecha
sozinha quando tudo do caso vai. Cada item leva a marca do portal no Drive. Antes de enviar de novo, o portal procura a
marca, então o reprocessamento MUST NOT duplicar o arquivo.

#### Scenario: CA3 · O Drive falha
- **Dado** uma falha ao gravar no Drive
- **Quando** acontece
- **Então** aparece na tarefa e é reprocessada sem duplicar o arquivo

### Requirement: CA4 · Nenhuma pasta pública
O portal MUST NOT compartilhar nem mudar permissão no Drive. As pastas e os arquivos que ele cria SHALL herdar só os
membros do Drive compartilhado do escritório. O portal também MUST NOT mudar, mover nem apagar o que já existe lá: só
lê, cria pasta e envia arquivo novo. Dentro do portal, o arquivo continua saindo só pela rota com perfil, e o dado de
saúde só para os perfis que podem ver (GGVP-96).

#### Scenario: CA4 · Criar a pasta do cliente
- **Dado** as pastas dos clientes
- **Quando** são criadas ou compartilhadas
- **Então** nenhuma fica pública, e o acesso segue os perfis do portal (dado de saúde só por perfil)

### Requirement: CA5 · Motivo de indeferimento no banco de motivos do portal
O motivo de indeferimento registrado (D3.01) SHALL ficar no banco do portal, no resultado do INSS do caso: o motivo do
INSS e o motivo com as palavras de quem viu, com quem e quando (GGVP-52). A busca do acervo lê dali, ligado ao caso
(GGVP-45). O motivo MUST NOT ir para o Drive, que só guarda arquivo. O cartão dizia "banco de motivos no Drive"; a
mudança é decisão do Mateus em 08/10, e o Lucas confirma na review.

#### Scenario: CA5 · Salvar o motivo
- **Dado** um motivo de indeferimento registrado (`D3.01`)
- **Quando** é salvo
- **Então** vai para o banco de motivos, no banco do portal, e também para o acervo (RAG), ligado ao caso

### Requirement: CA6 · Pacote do protocolo salvo no Drive (G7)
O pacote gerado da versão aprovada SHALL ser salvo numa pasta "Pacote de protocolo - AAAA-MM-DD" dentro da pasta do
cliente, com a petição, a carta e os documentos citados. Gerar o pacote de novo salva outra pasta. Com o Drive ligado,
a trava "pacote completo" (G7) MUST acusar o pacote que ainda não está no Drive.

#### Scenario: CA6 · Gerar o pacote
- **Dado** a petição pronta para protocolo (`D3.07`)
- **Quando** o sistema gera o pacote
- **Então** salva no Drive o pacote com os documentos citados, que a trava "pacote completo" (G7) confere

### Requirement: CA7 · O acervo se alimenta sem tarefa manual
O arquivamento SHALL ser automático, sem tarefa manual. O documento arquivado fica no caso com o identificador do Drive,
disponível para o acervo. A leitura do conteúdo pela IA é a GGVP-95 e a GGVP-81, fora desta história.

#### Scenario: CA7 · Documento entra na pasta
- **Dado** um documento que entra na pasta do cliente
- **Quando** é arquivado
- **Então** fica disponível para o acervo se alimentar sozinho, sem tarefa manual

### Requirement: CA8 · Arquivo do chat vai para a pasta do cliente
O arquivo confirmado no chat vira documento do caso, como qualquer outro. Por isso SHALL ir para a pasta do cliente com
o mesmo padrão de nome. A tela do chat ligar no servidor é do épico Experiência por perfil e chat (GGVP-5).

#### Scenario: CA8 · Arquivo pelo chat
- **Dado** um arquivo subido pelo chat (laudo novo, comprovante do INSS, comprovante de RPV)
- **Quando** a pessoa confirma o card
- **Então** o arquivo vai para a pasta do cliente com o mesmo padrão de nome
