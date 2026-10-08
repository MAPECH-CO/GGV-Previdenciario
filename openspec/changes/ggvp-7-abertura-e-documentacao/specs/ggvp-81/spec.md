# Spec Delta · ggvp-81 · Ler e arquivar os documentos

## Purpose

Todo documento que entra (scanner ou digital) é lido pela IA. A Documentação confere a leitura e arquiva na pasta do cliente, sem digitar. A tela é "Conferir documento", aberta pela Central do Atendimento, porque a Documentação não tem Central própria. Ali a pessoa vê o tipo, a data e a confiança que a IA sugeriu para cada documento. Confirma ou reclassifica, decide o que fazer com os duplicados e confere CPF, RG e endereço contra o cadastro. O documento de outra pessoa fica em quarentena. Telas do Figma: step_D1.18 `10:466`, step_D1.02 `10:440`, Cliente · dados (Atendimento) `73:199` e Central de trabalho · Atendimento `11:2`. Passo D1.18 do Miro. Scanner, Drive e IA são simulados. CA5 é \[v2\] e fica para a GGVP-95.

Contrato: tipos em `apps/web/src/dados/leitura.ts` (`DocumentoLido`, `DadosLidos`, `Arquivamento`, `Mudanca`). Endpoints de quando ligar no servidor:

| Endpoint | Função de exemplo |
|---|---|
| `GET /api/fichas/:id/documentos-lidos` | `documentosLidos` |
| `POST /api/fichas/:id/documentos-lidos/arquivar` | `arquivarDocumentos` |
| `POST /api/documentos-lidos/:id/cadastro` | `usarNoCadastro` |
| `POST /api/documentos-lidos/:id/liberar` | `liberarDaQuarentena` |
| `POST /api/documentos-lidos/:id/mover` | `moverDocumento` |
| `GET /api/relatorios/quarentena` | `relatorioDeQuarentena` |

## ADDED Requirements

### Requirement: CA1 · O portal lê o que a automação do scanner gravou
O documento em papel passa pela automação do balcão que já existe (scanner → servidor → n8n, em produção desde 14/09). Ela deixa o PDF pesquisável, separa os documentos e guarda na pasta do cliente no Drive. O portal SHALL ler o que ela gravou e MUST NOT refazer esse trabalho.

#### Scenario: CA1 · Documento em papel no scanner
- **Dado** um documento em papel
- **Quando** passa no scanner
- **Então** a automação do balcão que já existe deixa o PDF pesquisável, separa os documentos e guarda na pasta do cliente no Drive
- **E** o portal lê o que ela gravou e não refaz esse trabalho

### Requirement: CA2 · O digital vai direto para a pasta
O documento digital que a Documentação sobe no card SHALL ir direto para a pasta do cliente, sem scanner, e seguir para a mesma leitura.

#### Scenario: CA2 · Documento digital enviado pelo cliente
- **Dado** um documento digital enviado pelo cliente
- **Quando** a Documentação sobe no card
- **Então** ele vai direto para a pasta, sem scanner

### Requirement: CA3 · CPF, RG e endereço lidos aparecem para conferência
Os dados que a IA extrai (nome, CPF, RG e endereço) SHALL aparecer ao lado do que está no cadastro, para a Documentação conferir.

#### Scenario: CA3 · Documento lido
- **Dado** um documento lido
- **Quando** a IA extrai CPF, RG e endereço
- **Então** os campos aparecem no cadastro para conferência

### Requirement: CA4 · Contrato assinado segue para a verificação; o resto, para o checklist
Ao arquivar, o contrato assinado SHALL seguir para a verificação do contrato (GGVP-85), e os outros documentos para o checklist (GGVP-91).

#### Scenario: CA4 · Fim da leitura
- **Dado** um documento que é o contrato assinado
- **Quando** a leitura termina
- **Então** o caso segue para a verificação do contrato (GGVP-85)
- **E** se é outro documento, segue para o checklist (GGVP-91)

### Requirement: CA6 · Só arquiva com o dono certo
A automação SHALL arquivar o lote só com o dono certo: CPF escrito no papel ou nome igual ao da pasta. Na dúvida, o lote vai para "A REVISAR", com o motivo na planilha "Painel da digitalização", e a Documentação arrasta para a pasta certa. Documento MUST NOT ir para a pasta de outro cliente. O lote da GGVP-17 já faz isso; aqui, lote em revisão não gera conferência.

#### Scenario: CA6 · Lote sem dono certo
- **Dado** um lote do scanner (uma pilha por cliente)
- **Quando** a automação lê o papel e não tem certeza do dono
- **Então** o lote vai para "A REVISAR", com o motivo na planilha
- **E** nenhum documento dele aparece na conferência de cliente nenhum

### Requirement: CA7 · Tipo, data e confiança sugeridos, e "Arquivar" com a conferência
A tela SHALL mostrar o tipo e a data que a IA sugeriu para cada documento e o grau de confiança. Leitura com confiança abaixo de 80% MUST aparecer marcada para a pessoa conferir com atenção. A Documentação confirma ou reclassifica o tipo e a data. "Arquivar" MUST ficar desabilitado até ela marcar "Conferi os documentos lidos pela IA".

#### Scenario: CA7 · Leitura de baixa confiança
- **Dado** a leitura da IA, com um documento de confiança 62%
- **Quando** a Documentação abre a conferência
- **Então** vê o tipo, a data e a confiança de cada documento, e o de 62% marcado "baixa confiança: confira com atenção"

#### Scenario: CA7 · Reclassificar e arquivar
- **Dado** a leitura conferida
- **Quando** a Documentação troca o tipo de um documento em "Reclassificar" e marca "Conferi os documentos lidos pela IA"
- **Então** "Arquivar" habilita e o documento é arquivado com o tipo que ela escolheu

### Requirement: CA8 · Divergência destacada, cadastro só muda com confirmação
Dado lido que difere do cadastro SHALL aparecer destacado. O cadastro MUST NOT mudar sem a pessoa apertar "Usar no cadastro" naquele campo, e a mudança fica no histórico.

#### Scenario: CA8 · Nome lido diferente do cadastro
- **Dado** o RG lido com o nome "Rita de Cássia Exemplo" e o cadastro com "Rita Exemplo"
- **Quando** aparece para conferência
- **Então** a divergência fica destacada e o cadastro continua "Rita Exemplo"
- **E** só muda quando a Documentação aperta "Usar no cadastro", com o registro no histórico

### Requirement: CA9 · Duplicado: a pessoa decide
Quando a IA aponta um possível duplicado, a Documentação SHALL decidir entre "Manter os dois" e "Descartar a cópia menos legível". O sistema MUST NOT descartar sozinho, e "Arquivar" só habilita com a decisão. A cópia descartada sai da conferência, mas o arquivo original fica guardado.

#### Scenario: CA9 · Comprovante escaneado duas vezes
- **Dado** um possível documento duplicado
- **Quando** a IA o aponta
- **Então** a Documentação decide entre "Manter os dois" e "Descartar a cópia menos legível"
- **E** nada é descartado antes da decisão

### Requirement: CA10 · Documento de outra pessoa fica em quarentena
Documento cujo CPF ou nome lido não é o do cliente do caso SHALL ficar em quarentena até uma pessoa conferir. Em quarentena, MUST NOT contar no checklist nem entrar no pacote de protocolo. Nome com mais palavras, que contém o do cadastro, é a mesma pessoa: vira divergência (CA8), não quarentena.

#### Scenario: CA10 · CNIS de outro cliente na pilha
- **Dado** o CNIS lido com o nome e o CPF de Antônio Exemplo na pilha de Rita Exemplo
- **Quando** a leitura termina
- **Então** ele fica em quarentena, com o motivo, e não é arquivado como de Rita
- **E** sai da quarentena só com "É deste cliente: liberar" ou movido para o caso certo

### Requirement: CA11 · Mover para outro caso exige motivo
Mover um documento para outro caso sem informar o motivo MUST ser recusado no servidor. Com motivo, a mudança SHALL ser feita e ficar no histórico das duas fichas.

#### Scenario: CA11 · Mover sem motivo
- **Dado** alguém que tenta mover um documento para outro caso sem informar o motivo
- **Quando** confirma
- **Então** a ação é recusada no servidor

#### Scenario: CA11 · Mover com motivo
- **Dado** o motivo informado
- **Quando** confirma
- **Então** o documento vai para a pasta do outro caso e a mudança fica registrada

### Requirement: CA12 · (proposta) Relatório da quarentena
Documentos em quarentena há mais de um dia SHALL aparecer no relatório da quarentena. Proposta do cartão: fica só no servidor de exemplo, sem tela, até o relatório ter lugar no Figma.

#### Scenario: CA12 · Quarentena antiga
- **Dado** documentos em quarentena há mais de um dia
- **Quando** o relatório é gerado
- **Então** eles aparecem nele, e os de hoje não

### Requirement: CA13 · Processar de novo não duplica
O mesmo arquivo processado de novo MUST NOT gerar documento duplicado, e o arquivo original SHALL continuar guardado: o OCR não o substitui.

#### Scenario: CA13 · Leitura repetida
- **Dado** o mesmo arquivo processado de novo
- **Quando** a leitura roda
- **Então** nenhum documento é duplicado e o arquivo original continua guardado

### Requirement: CA14 · Arquivou, o checklist é recalculado
Arquivado o documento, o checklist do benefício SHALL ser recalculado e a tela MUST mostrar o que ainda falta. A lista vem do checklist da GGVP-91; até ela entrar, a tela leva ao checklist.

#### Scenario: CA14 · Fim do arquivo
- **Dado** um documento arquivado
- **Quando** o arquivo termina
- **Então** o checklist do benefício é recalculado e mostra o que ainda falta

### Requirement: CA15 · Ficha do scanner sem telefone
Ficha criada pela automação do scanner, que não lê telefone, SHALL entrar no portal sem telefone e mostrar "completar telefone" para o Atendimento. Já existe desde a GGVP-17 (CA15 dela): esta história mantém.

#### Scenario: CA15 · Ficha criada pelo scanner
- **Dado** uma ficha criada pela automação do scanner
- **Quando** chega ao portal sem telefone
- **Então** o portal aceita e mostra "completar telefone" para o Atendimento

### Requirement: CA16 · Documento médico nunca é apagado
Documento médico arquivado MUST NOT ser apagado nem descartado: fica guardado para sempre, como o áudio da entrevista. A Documentação confirma que ele está ok, sem ver o conteúdo, que fica com o Jurídico.

#### Scenario: CA16 · Descartar laudo
- **Dado** um documento médico
- **Quando** alguém tenta descartá-lo
- **Então** o servidor recusa e ele continua guardado
