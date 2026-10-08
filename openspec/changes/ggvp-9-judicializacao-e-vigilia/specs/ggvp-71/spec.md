# Spec Delta · ggvp-71

## Purpose

Pacote, travas e protocolo no tribunal: aprovada a petição, o sistema monta o pacote (a petição em PDF com a assinatura padrão, a carta de indeferimento e os documentos citados, na ordem), mostra as três travas com a evidência (G7) e só libera o protocolo com elas e com o número do processo, a data e o comprovante; o processo entra na vigília. Respostas do revisor de 06/10: os tribunais vêm da configuração do escritório (começa com a Justiça Federal); o pacote fica no armazenamento privado do portal até a integração com o Drive (GGVP-107); sem IA, as travas são conferidas por código e a advogada confirma pela evidência.

## ADDED Requirements

### Requirement: CA1 · O pacote é salvo e o protocolo, preparado
Aprovada a petição, o sistema SHALL montar o pacote, salvá-lo (no armazenamento privado do portal até a integração com o Drive) e preparar o protocolo.

#### Scenario: CA1 · Montar o pacote
- **Dado** a petição aprovada
- **Quando** o sistema monta o pacote
- **Então** salva o pacote e prepara o protocolo

### Requirement: CA2 · As três travas com status (G7)
O pacote SHALL mostrar as três travas, Tema 350, pacote completo e CPF conferido, cada uma com o seu status (G7).

#### Scenario: CA2 · Abrir o pacote
- **Dado** o pacote
- **Quando** abro
- **Então** vejo as três travas: Tema 350, pacote completo e CPF conferido, cada uma com status (G7)

### Requirement: CA3 · Trava falhando bloqueia o protocolo
Com uma trava falhando, o protocolo MUST ficar bloqueado, e a tela SHALL dizer qual trava falta.

#### Scenario: CA3 · Trava falhando
- **Dado** uma trava falhando
- **Quando** tento protocolar
- **Então** o botão fica bloqueado e diz qual trava falta

### Requirement: CA4 · Protocolado, o caso passa para o D3a
Registrado o protocolo, o caso SHALL passar para o D3a com o número do processo e a data.

#### Scenario: CA4 · Registrar o protocolo
- **Dado** o protocolo feito
- **Quando** registro
- **Então** o caso passa para D3a com número do processo e data

### Requirement: CA5 · Número, data e comprovante obrigatórios
O registro do protocolo MUST exigir o número do processo (CNJ válido), a data do protocolo e o comprovante anexado; "Protocolar no tribunal" SHALL habilitar só com os três, e só então o caso entra na vigília.

#### Scenario: CA5 · Concluir o registro
- **Dado** o registro do protocolo
- **Quando** concluo
- **Então** número do processo (CNJ válido), data do protocolo e comprovante anexado são obrigatórios; só então o caso entra na vigília

### Requirement: CA6 · Cada trava com critério e evidência
Cada trava SHALL ter o critério definido e guardar a evidência (o CPF da petição igual ao CPF do cadastro; a carta de indeferimento no pacote; os documentos citados anexados), e a advogada MUST confirmar pela evidência, não só marcar. Até o épico IA jurídica, a verificação é feita por código.

#### Scenario: CA6 · Verificar uma trava
- **Dado** cada trava
- **Quando** é verificada
- **Então** tem um critério definido e guarda a evidência; a pessoa confirma pela evidência, não só marca

### Requirement: CA7 · Pacote completo lista o que falta
A trava "pacote completo" SHALL comparar os documentos citados na petição com os anexados e listar os que faltam.

#### Scenario: CA7 · Verificar o pacote
- **Dado** a trava "pacote completo"
- **Quando** o sistema verifica
- **Então** compara os documentos citados na petição com os anexados e lista os que faltam

### Requirement: CA8 · O pacote tem a versão aprovada e os citados, na ordem
O pacote SHALL conter a versão aprovada da petição (o mesmo identificador da conferência) e todos os documentos citados, na ordem definida; o identificador MUST aparecer no pacote e no registro do protocolo.

#### Scenario: CA8 · Gerar o pacote
- **Dado** o pacote
- **Quando** é gerado
- **Então** contém a versão aprovada da petição e todos os documentos citados, na ordem; o identificador aparece no pacote e no registro do protocolo

### Requirement: CA9 · Arquivo trocado bloqueia o protocolo
Se um arquivo do pacote for trocado ou editado depois da aprovação, o protocolo MUST ser bloqueado pela conferência dos identificadores, e a divergência SHALL ficar registrada.

#### Scenario: CA9 · Arquivo trocado
- **Dado** alguém que troca ou edita um arquivo do pacote depois da aprovação
- **Quando** tenta protocolar
- **Então** o sistema confere os identificadores, bloqueia o protocolo e registra a divergência

### Requirement: CA10 · Quem protocolou e quando
O protocolo registrado SHALL ficar no histórico com quem protocolou e quando.

#### Scenario: CA10 · Histórico do protocolo
- **Dado** o protocolo
- **Quando** registro
- **Então** ficam no histórico quem protocolou e quando

### Requirement: CA11 · O botão abre o site do tribunal; o portal não envia
O botão do tribunal SHALL abrir o site de peticionamento do tribunal (da configuração do escritório) numa página nova, com o pacote pronto no portal para baixar; o portal MUST NOT enviar o pacote sozinho, e os arquivos MUST respeitar o formato e o tamanho aceitos pelo tribunal (parâmetros da configuração, Q8).

#### Scenario: CA11 · Abrir o tribunal
- **Dado** o pacote pronto
- **Quando** clico no botão do tribunal
- **Então** o site de peticionamento do tribunal abre numa página nova, e o pacote fica pronto no portal para eu baixar e anexar lá

### Requirement: CA12 · Título "Protocolar na Justiça"
A tarefa SHALL aparecer na Central com o nome do cliente e "Protocolar na Justiça".

#### Scenario: CA12 · Na Central
- **Dado** a tarefa
- **Quando** aparece na Central
- **Então** o título é o nome do cliente + "Protocolar na Justiça"

### Requirement: CA13 · Documento que falta: subir ou pedir à Documentação
Com a trava "pacote completo" acusando um documento faltando, a advogada SHALL poder subir o documento ou pedir à Documentação (tarefa no setor), e o pacote MUST ser gerado de novo.

#### Scenario: CA13 · Documento faltando
- **Dado** a trava "pacote completo" com documento faltando
- **Quando** abro
- **Então** posso subir o documento ou pedir à Documentação, e o pacote é gerado de novo
