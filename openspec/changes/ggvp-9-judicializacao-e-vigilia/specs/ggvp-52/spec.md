# Spec Delta · ggvp-52

## Purpose

Registrar o motivo do indeferimento: quem viu o indeferido escreve, com as suas palavras, por que o INSS negou, ao lado da carta e do motivo do INSS; o motivo vai para o banco de motivos e a Sênior recebe o caso para despachar. Respostas do revisor de 06/10: qualquer advogada da fila trata (a equipe do Jurídico também pode); sem IA até o épico IA jurídica, o despacho nasce direto; os arquivos ficam no armazenamento privado do portal até a integração com o Drive (GGVP-107).

## ADDED Requirements

### Requirement: CA1 · "Motivo com suas palavras" é obrigatório
No caso indeferido, o campo "Motivo com suas palavras" MUST ser obrigatório para seguir.

#### Scenario: CA1 · Abrir o caso indeferido
- **Dado** um caso indeferido
- **Quando** abro
- **Então** o campo "Motivo com suas palavras" é obrigatório para seguir

### Requirement: CA2 · O motivo vai para o banco de motivos
O motivo confirmado SHALL ir para o banco de motivos, no banco de dados do portal. O acervo da IA (D4) SHALL ler os motivos dali quando o épico IA jurídica entrar.

#### Scenario: CA2 · Confirmar o motivo
- **Dado** o motivo salvo
- **Quando** confirmo
- **Então** ele vai para o banco de motivos; o acervo (D4) lê dali com o épico IA

### Requirement: CA3 · A carta e o motivo do INSS ao lado do campo
A tarefa SHALL mostrar a carta de indeferimento anexada, para abrir, e o motivo como está no sistema do INSS, ao lado do campo "Motivo com as suas palavras".

#### Scenario: CA3 · Abrir a tarefa
- **Dado** um caso indeferido
- **Quando** abro a tarefa
- **Então** vejo a carta de indeferimento anexada e o motivo como está no sistema do INSS, ao lado do campo "Motivo com as suas palavras"

### Requirement: CA4 · Motivo e carta obrigatórios
Salvar MUST exigir o texto do motivo e a carta de indeferimento anexada; a carta anexada no registro do indeferido (GGVP-48) já vale.

#### Scenario: CA4 · Salvar
- **Dado** o registro
- **Quando** tento salvar
- **Então** o texto do motivo e o anexo da carta de indeferimento são obrigatórios

### Requirement: CA5 · A gravação guarda o caso, sem duplicar
A gravação no banco de motivos MUST guardar a referência ao caso; gravar de novo MUST atualizar o mesmo registro, sem duplicar, e a falha SHALL aparecer na tela para refazer. A gravação no acervo (RAG) entra com o épico IA jurídica.

#### Scenario: CA5 · Gravar
- **Dado** o motivo salvo
- **Quando** o sistema grava no banco de motivos (banco de dados do portal)
- **Então** a gravação guarda a referência ao caso; a falha fica visível e é refeita sem duplicar

### Requirement: CA6 · Nasce o despacho da Sênior
Com o motivo gravado, SHALL nascer a tarefa "Despachar caso" para a Sênior (GGVP-54). Até o épico IA jurídica não há análise: a tarefa nasce direto, com o motivo.

#### Scenario: CA6 · Motivo gravado
- **Dado** o motivo gravado
- **Quando** confirmo
- **Então** nasce a tarefa de despacho da Sênior (GGVP-54); a análise e os critérios da IA entram com o épico IA

### Requirement: CA7 · Na linha do processo, com autor e data
O motivo registrado SHALL entrar na linha do processo (histórico) com autor e data, e a tela do despacho SHALL mostrar quem escreveu e quando.

#### Scenario: CA7 · Linha do processo
- **Dado** o motivo registrado
- **Quando** abro a linha do processo
- **Então** ele aparece com autor e data
