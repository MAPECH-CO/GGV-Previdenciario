# Spec Delta · ggvp-80 · Transcrever e identificar o que mudou

## Purpose

A IA transcreve a conversa e compara com a ficha e o processo, para quem conversou saber o que mudou sem ouvir tudo.
Passo D5.02 do Miro (transcrever a conversa; identificar o que mudou), sem tela própria. Resposta do Lucas de 06/10
(Q11): manter todos os áudios. Figma: Overlay · Registrar conversa `2144:2`, Transcrições `1626:2`, step_D5.01 `2281:2`.
Contrato na `design.md`, seção GGVP-80.

## ADDED Requirements

### Requirement: CA1 · O texto vai para o card
Terminada a transcrição do áudio salvo, o texto SHALL ir para o histórico do card (nas Transcrições, com acesso por perfil; o histórico da ficha registra o fato sem o conteúdo de saúde).

#### Scenario: CA1 · A transcrição termina
- **Dado** o áudio salvo
- **Quando** a transcrição termina
- **Então** o texto vai para o histórico do card

### Requirement: CA2 · A lista do que mudou
Ao comparar a transcrição, a IA SHALL mostrar a lista do que mudou na ficha e no processo. A comparação é código: só entra o que é diferente do que está guardado.

#### Scenario: CA2 · A IA compara
- **Dado** a transcrição
- **Quando** a IA compara
- **Então** mostra a lista do que mudou (ficha e processo)

### Requirement: CA3 · A senha dita vai para o cofre
A senha dita na conversa SHALL ir para o cofre e MUST NOT ficar na transcrição (G9).

#### Scenario: CA3 · A transcrição sai
- **Dado** uma senha dita na conversa
- **Quando** a transcrição sai
- **Então** a senha vai para o cofre (G9)

### Requirement: CA4 · Vale para os dois canais
A transcrição SHALL valer para a ligação que o Atendimento subiu e para a conversa gravada no escritório, no card do lead ou do cliente, conforme quem procurou o escritório.

#### Scenario: CA4 · A transcrição começa
- **Dado** o áudio guardado no card, pela ligação que o Atendimento subiu ou pela conversa gravada no escritório
- **Quando** a transcrição começa
- **Então** ela vale para os dois canais e o card é o do lead ou do cliente

### Requirement: CA5 · Cada mudança marcada, com o trecho
Cada mudança SHALL vir marcada "ficha do cliente" (contato, endereço, grupo familiar) ou "campos do processo" (fatos novos, datas, documentos citados), com o trecho da conversa de onde saiu.

#### Scenario: CA5 · A IA termina
- **Dado** a lista do que mudou
- **Quando** a IA termina
- **Então** cada mudança vem marcada como "ficha do cliente" ou "campos do processo", com o trecho da conversa de onde saiu

### Requirement: CA6 · As três partes nas Transcrições
A conversa transcrita SHALL aparecer nas transcrições do processo com data, canal, quem conversou e duração, e com resumo, informações extraídas e transcrição; o que a IA extraiu MUST NOT ir para a ficha antes de conferido (G14).

#### Scenario: CA6 · Abrir as transcrições
- **Dado** uma conversa transcrita
- **Quando** abro as transcrições do processo
- **Então** vejo o registro com data, canal, quem conversou e duração, e as três partes; o que a IA extraiu só vai para a ficha depois de conferido (G14)

### Requirement: CA7 · O trecho do cofre fica fora
O trecho em que o cofre fica aberto durante a gravação MUST NOT entrar no áudio nem na transcrição.

#### Scenario: CA7 · A senha é salva no cofre
- **Dado** que o cofre é aberto durante a gravação para o cliente digitar a senha
- **Quando** a senha é salva
- **Então** esse trecho não entra no áudio nem na transcrição

### Requirement: CA8 · A senha de teste não fica no texto
A transcrição final MUST NOT conter a senha de teste falada numa conversa gravada.

#### Scenario: CA8 · Senha de teste falada
- **Dado** os testes da história
- **Quando** uma senha de teste é falada numa conversa gravada
- **Então** a transcrição final não a contém

### Requirement: CA9 · Sem áudio, só registro
A conversa só escrita SHALL ficar sem transcrição e aparecer como "só registro" nas transcrições do processo.

#### Scenario: CA9 · Registrar sem áudio
- **Dado** uma conversa só escrita (sem áudio)
- **Quando** é registrada
- **Então** não há transcrição, e o registro aparece como "só registro" nas transcrições do processo
