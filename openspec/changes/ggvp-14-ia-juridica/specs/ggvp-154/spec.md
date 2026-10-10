# Spec Delta · ggvp-154

## Purpose

O acervo aprende com toda publicação e com os documentos do Drive (continua a GGVP-141, nasceu da conferência da
jurimetria de 09/10). Toda publicação que uma pessoa classificou passa a ser fonte do acervo, não só a de mérito, com o
mesmo trecho anonimizado, a mesma marca de só do Jurídico e o mesmo hash que impede duplicar.

**Depende de outra história (CA2):** o portal ainda não guarda o texto lido de documento do caso; ler o conteúdo é a
GGVP-95 e a GGVP-81. O conteúdo médico conferido já entra pelo "Laudo conferido" (GGVP-141, parte 2). Registrado no
cartão em 09/10.

## ADDED Requirements

### Requirement: CA1 · Toda publicação classificada
A rodada do acervo SHALL transformar em trecho, com a fonte, toda publicação ligada a um caso e classificada por pessoa
(intimação ou exigência, nomeação de perito, só andamento), além da decisão de mérito, que já entrava. A publicação
repetida MUST NOT duplicar.

#### Scenario: CA1 · A rodada passa
- **Dado** uma publicação classificada por pessoa (exigência, despacho, nomeação)
- **Quando** a rodada do acervo passa
- **Então** ela vira trecho anonimizado com a fonte; repetida não duplica

### Requirement: CA2 · Documento do Drive com o conteúdo conferido
O documento do caso arquivado no Drive SHALL virar trecho com a fonte quando o conteúdo dele tiver sido lido e conferido
por pessoa (GGVP-95, GGVP-81); o documento médico fica marcado como só do Jurídico.

#### Scenario: CA2 · Documento no Drive
- **Dado** um documento do caso já arquivado no Drive e com o conteúdo lido e conferido
- **Quando** a rodada passa
- **Então** vira trecho com a fonte; o documento médico fica marcado como só do Jurídico

### Requirement: CA3 · Sem conferência, não entra
A publicação que só a IA classificou, sem a classificação de uma pessoa, MUST NOT entrar no acervo.

#### Scenario: CA3 · Texto sem conferência
- **Dado** um texto sem conferência de pessoa
- **Quando** a rodada passa
- **Então** não entra

### Requirement: CA4 · Sem dado pessoal e nada em log
Todo trecho SHALL sair sem o nome do cliente, CPF, endereço e telefone, pela mesma anonimização das outras fontes, e o
conteúdo MUST NOT ir para log.

#### Scenario: CA4 · Gravar o trecho
- **Dado** qualquer trecho
- **Quando** é gravado
- **Então** sai sem nome do cliente, CPF, endereço e telefone, e nada do conteúdo vai para log
