# Spec Delta · ggvp-24 · Preencher a ficha de atendimento

## Purpose

O cliente ou lead preenche uma ficha simples com os dados, o benefício que procura e a senha do gov.br, para chegar à entrevista sem repetir tudo. Hoje a ficha é em papel (GGV ou APA), escaneada no balcão: a IA lê e o Atendimento confere e salva. A ficha digital, uma pergunta por vez, é a do tablet, quando ele chegar. Tela do Figma: step_D1.05 `10:54`, com Novo cliente `73:371`, a página do processo `1581:2` e step_D1.06 `14:2`. Passo D1.05 do Miro, na raia do cliente.

## ADDED Requirements

### Requirement: CA1 · No tablet, uma pergunta por vez
A ficha digital aberta pelo cliente no tablet SHALL mostrar uma pergunta por vez, com linguagem simples e letra grande.

#### Scenario: CA1 · Ficha no tablet
- **Dado** a ficha digital aberta pelo cliente no tablet do balcão
- **Então** vejo uma pergunta por vez, com linguagem simples e letra grande

### Requirement: CA2 · A senha digitada vai para o cofre
A senha do gov.br digitada SHALL ir para o cofre e MUST NOT aparecer na ficha.

#### Scenario: CA2 · Guardar a senha
- **Dado** que digito a senha do gov.br
- **Quando** guardo
- **Então** a senha vai para o cofre e a ficha mostra só que ela está no cofre

### Requirement: CA3 · "Não sei a senha" não trava
Com "não sei" marcado, a ficha SHALL ser aceita e o caso MUST seguir com o alerta de senha (GGVP-36).

#### Scenario: CA3 · Não sei a senha
- **Dado** que não sei a senha
- **Quando** marco "não sei"
- **Então** a ficha é aceita e o caso segue com o alerta de senha

### Requirement: CA4 · O Jurídico vê a ficha antes
Com a ficha enviada, o Jurídico SHALL ver a ficha antes de o cliente entrar na sala.

#### Scenario: CA4 · Ver a ficha antes
- **Dado** uma ficha enviada
- **Quando** o Jurídico abre o caso
- **Então** vê a ficha antes de o cliente entrar na sala

### Requirement: CA5 · Quatro campos obrigatórios
"Salvar ficha" SHALL habilitar só com nome completo, CPF, data de nascimento e telefone/WhatsApp; endereço e quantas pessoas moram na casa MAY ficar em branco.

#### Scenario: CA5 · Salvar sem CPF
- **Dado** a ficha sem o CPF
- **Quando** o cliente vai salvar
- **Então** "Salvar ficha" não habilita e a tela diz o que falta

### Requirement: CA6 · O que ficou em branco aparece para o Jurídico
A ficha com os obrigatórios preenchidos e outros em branco SHALL ser aceita, e a análise do Jurídico MUST mostrar o que ficou em branco.

#### Scenario: CA6 · Campos em branco
- **Dado** a ficha com os obrigatórios e outros em branco
- **Quando** o cliente salva
- **Então** a ficha é aceita e a análise do Jurídico mostra o que ficou em branco

### Requirement: CA7 · Benefício do catálogo, com "Não sei ainda"
O benefício procurado SHALL vir do catálogo de benefícios do escritório e MUST ter a opção "Não sei ainda".

#### Scenario: CA7 · Escolher o benefício
- **Dado** o campo do benefício procurado
- **Quando** o cliente escolhe
- **Então** a lista vem do catálogo do escritório, com "Não sei ainda"

### Requirement: CA8 · Senha só pelo componente do cofre
A senha do gov.br SHALL entrar só pelo componente do cofre: a ficha MUST NOT ter campo de texto para senha e mostra só que a senha está no cofre (G9).

#### Scenario: CA8 · Sem campo de senha na ficha
- **Dado** a ficha digital
- **Quando** o cliente informa a senha
- **Então** ela entra pelo componente do cofre, fora do formulário da ficha, e a ficha mostra só "senha no cofre"

### Requirement: CA9 · A senha não aparece em lugar nenhum
Uma senha guardada a partir da ficha MUST NOT aparecer em nenhuma tela, PDF, log, exportação ou transcrição do portal (teste automático com senha de teste). A única exceção é a imagem da ficha em papel escaneada, na pasta do cliente.

#### Scenario: CA9 · Procurar a senha de teste
- **Dado** uma senha de teste guardada a partir da ficha
- **Quando** se busca o valor na tela, no armazenamento e no histórico
- **Então** ela não aparece

### Requirement: CA10 · Histórico das alterações
Toda alteração da ficha salva SHALL guardar quem mudou, quando e o que mudou.

#### Scenario: CA10 · Alterar um campo
- **Dado** uma ficha salva
- **Quando** alguém altera um campo
- **Então** o histórico guarda quem mudou, quando e o que mudou

### Requirement: CA11 · Os três campos da situação de trabalho
A ficha SHALL ter "Última atividade", "Desde quando está sem trabalhar" e "O que já pediu ao INSS", que MAY ficar em branco.

#### Scenario: CA11 · Situação de trabalho
- **Dado** a ficha
- **Quando** o cliente preenche
- **Então** ela tem os três campos, que podem ficar em branco

### Requirement: CA12 · Campos conferidos
O CPF SHALL passar só com o dígito verificador certo; o telefone com DDD MUST ser conferido por uma ferramenta gratuita de validação (simulada); a data de nascimento MUST NOT aceitar letra nem data futura e mostra a idade; a data da ficha é o dia de hoje, sem edição.

#### Scenario: CA12 · Conferir os campos
- **Dado** os campos da ficha
- **Quando** são preenchidos
- **Então** CPF errado, letra ou data futura não passam, a idade aparece, o telefone mostra "conferido" e a data da ficha é a de hoje, sem edição

### Requirement: CA13 · A IA completa depois da entrevista
Com a transcrição da entrevista, a IA SHALL poder preencher o que faltou na ficha e montar o resumo; quem atende confere e salva, ou corrige. Entra com a transcrição (GGVP-46).

#### Scenario: CA13 · Completar pela transcrição
- **Dado** a entrevista encerrada
- **Quando** a IA tem a transcrição
- **Então** ela preenche o que faltou na ficha, marcado para conferir, e quem atende confere e salva

### Requirement: CA14 · Ficha em papel lida pela IA
A ficha em papel (GGV ou APA) passada no scanner SHALL ter a imagem guardada na pasta do cliente, e a IA MUST preencher os campos no portal para o Atendimento conferir e salvar.

#### Scenario: CA14 · Digitalizar a ficha em papel
- **Dado** a ficha de atendimento em papel
- **Quando** ela passa no scanner
- **Então** a imagem vai para a pasta do cliente e os campos lidos chegam marcados para o Atendimento conferir e salvar

### Requirement: CA15 · Senha escrita no papel vai para o cofre
A senha do gov.br escrita na ficha de papel, quando lida, SHALL ir para o cofre, para o Atendimento conferir, e MUST NOT ir para um campo de texto da ficha (G9). A imagem escaneada continua na pasta do cliente com a senha escrita.

#### Scenario: CA15 · Senha lida do papel
- **Dado** a senha escrita na ficha de papel
- **Quando** a ficha é lida
- **Então** a senha vai para o cofre marcada para conferir, e o Atendimento confirma "Conferi a senha do cofre com o papel"
