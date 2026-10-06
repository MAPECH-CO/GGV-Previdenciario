# Spec Delta · ggvp-27

## Purpose

Protocolar no Meu INSS: o Jurídico administrativo recebe os casos aprovados pela Sênior com tudo o que precisa, protocola e registra o número do requerimento, a DER e o comprovante.

## ADDED Requirements

### Requirement: CA1 · Fila com documentos na ordem e acesso ao cofre
A fila do Jurídico administrativo SHALL trazer os casos aprovados pela Sênior; ao abrir, os documentos na ordem e o acesso à senha do gov.br no cofre.

#### Scenario: CA1 · Abrir a fila
- **Dado** um caso aprovado pelo sênior
- **Quando** abro minha fila
- **Então** vejo o caso com os documentos na ordem e o acesso ao cofre

### Requirement: CA2 · Protocolo registrado espera a junção
Registrar o número do requerimento e a DER SHALL registrar o protocolo, e o caso MUST esperar a junção "protocolo feito e perícia resolvida (ou sem perícia)" para entrar na vigília.

#### Scenario: CA2 · Registrar o protocolo
- **Dado** o protocolo feito
- **Quando** registro o número do requerimento e a DER
- **Então** o protocolo fica registrado e o caso espera a junção para entrar na vigília

### Requirement: CA3 · Sem o OK da Sênior, o portal recusa
Registrar protocolo de caso sem o OK da Sênior MUST ser recusado pelo servidor (G2).

#### Scenario: CA3 · Protocolo sem OK
- **Dado** que tento registrar protocolo de caso sem o OK do sênior
- **Quando** salvo
- **Então** o portal recusa

### Requirement: CA4 · Número, data, comprovante e conferência obrigatórios
Concluir o protocolo MUST exigir número do requerimento, DER, comprovante anexado e "Revisei o requerimento antes de enviar" marcado; faltando algo, o portal recusa com mensagem clara.

#### Scenario: CA4 · Concluir sem os obrigatórios
- **Dado** o protocolo feito
- **Quando** concluo
- **Então** número, data, comprovante e a conferência são obrigatórios; sem isso, o portal recusa com mensagem clara

### Requirement: CA5 · Caso sem o OK da Sênior não aparece
A fila MUST NOT trazer caso sem o OK da Sênior registrado na conferência; o OK vem do registro da Sênior, nunca de uma marcação do Jurídico administrativo.

#### Scenario: CA5 · Caso sem OK
- **Dado** um caso ainda sem o OK do sênior registrado
- **Quando** abro minha fila
- **Então** ele não aparece

### Requirement: CA6 · Senha do cofre por tempo limitado, com histórico
A senha do gov.br SHALL aparecer só por tempo limitado (60 segundos), depois de a pessoa confirmar que vai usá-la, e o uso MUST ficar no histórico (quem, quando, caso) (G9).

#### Scenario: CA6 · Pedir a senha ao cofre
- **Dado** que preciso da senha do gov.br
- **Quando** peço ao cofre
- **Então** ela aparece por tempo limitado, depois de eu confirmar, e o uso fica no histórico

### Requirement: CA7 · Depois do protocolo, o caso espera o INSS
Com o protocolo registrado, o caso SHALL mostrar que espera o INSS; se a advogada decidiu que há perícia, essa espera é a que libera o agendamento da perícia.

#### Scenario: CA7 · Protocolo registrado
- **Dado** o protocolo registrado
- **Quando** o requerimento chega ao INSS
- **Então** o caso mostra que espera o INSS
