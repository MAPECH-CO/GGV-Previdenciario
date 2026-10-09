# Spec Delta · ggvp-90

## Purpose

Confirmar o desfecho de mérito (a porta de entrada do D3b): a decisão de mérito que a vigília encaminha abre "Confirmar desfecho" para a advogada; ela lê o trecho da decisão e a leitura da IA e confirma procedente total, procedente em parte, improcedente ou extinto sem mérito. Sem essa confirmação o caso para na decisão de mérito (orquestrador, 09/10). Esta parte cobre só o CA3 e o CA4 do cartão; o acompanhamento do pagamento (CA1, CA2, CA5 a CA8) espera as dúvidas abertas do cartão (de onde vem o pagamento, Q24, Q33).

## ADDED Requirements

### Requirement: CA3 · Confirmar o desfecho lendo a decisão e a leitura da IA
A tarefa "Confirmar desfecho" SHALL abrir uma tela com o trecho da decisão de mérito, a leitura da IA com o grau de confiança (quando houver) e o prazo do recurso; a advogada (ou a Sênior) MUST escolher procedente total, procedente em parte, improcedente ou extinto sem mérito, e extinto sem mérito MUST trazer a causa. Sem a confirmação, o caso não avança no D3b.

#### Scenario: CA3 · Abrir a tarefa
- **Dado** uma decisão de mérito encaminhada pela vigília
- **Quando** a advogada abre "Confirmar desfecho"
- **Então** vê o trecho da decisão, a leitura da IA com a confiança e o prazo do recurso, e as quatro opções

#### Scenario: CA3 · Sem a causa da extinção
- **Dado** a advogada na tela
- **Quando** escolhe extinto sem mérito sem escrever a causa
- **Então** a confirmação é recusada com o motivo

#### Scenario: CA3 · Outro perfil
- **Dado** um perfil sem a permissão de classificar a publicação (o Atendimento, por exemplo)
- **Quando** tenta confirmar
- **Então** é recusado e vê só a situação

### Requirement: CA4 · A confirmação fica registrada e abre o passo seguinte
A confirmação SHALL gravar o desfecho no caso, com quem confirmou e quando, e fechar "Confirmar desfecho"; procedente (total ou em parte) MUST abrir "Acompanhar pagamento" (D3b.01) para a advogada responsável, com a forma (RPV ou precatório) quando conhecida; improcedente ou extinto sem mérito MUST abrir "Vale recorrer?" para a advogada responsável, com o prazo do recurso. Duas confirmações ao mesmo tempo: só a primeira vale.

#### Scenario: CA4 · Procedente
- **Dado** "Confirmar desfecho" aberta
- **Quando** a advogada confirma procedente em parte, por RPV
- **Então** o caso guarda o desfecho, a decisão guarda quem e quando, e nasce "Acompanhar pagamento" para a advogada responsável

#### Scenario: CA4 · Improcedente
- **Dado** "Confirmar desfecho" aberta, com o prazo do recurso
- **Quando** a advogada confirma improcedente
- **Então** nasce "Vale recorrer?" com o mesmo prazo, e o estudo de caso do perdido (GGVP-19) passa a valer para o caso

#### Scenario: CA4 · Já confirmado
- **Dado** o desfecho já confirmado
- **Quando** alguém tenta confirmar de novo
- **Então** é recusado, e a tela mostra o desfecho, quem confirmou e quando
