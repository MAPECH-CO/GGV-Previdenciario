# Spec Delta · ggvp-30

## Purpose

Vigiar 3 vezes por dia com alarme de falha (G13): cada rodada da vigília registra início, fim, fonte, quantidade e status; rodada que falhou, ou que não rodou, dispara alarme para a Sênior e nunca parece um dia sem publicação.

## ADDED Requirements

### Requirement: CA1 · Rodada com falha alarma a Sênior
Uma rodada que falhou SHALL disparar o alarme para a Sênior, e o painel SHALL mostrar "Vigília falhou às HH:MM".

#### Scenario: CA1 · Rodada falhou
- **Dado** uma rodada que falhou
- **Quando** termina
- **Então** a Sênior recebe o alarme e o painel mostra "Vigília falhou às HH:MM"

### Requirement: CA2 · Rodada sem publicação diz que está OK
Uma rodada sem publicações SHALL aparecer no painel como "Rodada OK, nenhuma publicação".

#### Scenario: CA2 · Nada capturado
- **Dado** uma rodada sem publicações
- **Quando** termina
- **Então** o painel mostra "Rodada OK, nenhuma publicação"

### Requirement: CA3 · Alarme com horário, fonte e erro
O alarme SHALL trazer o horário, a fonte e o erro.

#### Scenario: CA3 · Alarme sai
- **Dado** uma rodada com falha
- **Quando** o alarme sai
- **Então** ele traz o horário, a fonte e o erro

### Requirement: CA4 · Painel com as rodadas do dia e reprocessamento
O painel da vigília SHALL mostrar as rodadas do dia (previstas, concluídas e com falha) e SHALL permitir reprocessar a rodada que falhou.

#### Scenario: CA4 · Abrir o painel
- **Dado** o painel da vigília
- **Quando** abro
- **Então** vejo as rodadas do dia, previstas, concluídas e com falha, e posso reprocessar a rodada que falhou

### Requirement: CA5 · Dia com falha é "vigília incompleta"
Um dia com rodada falha não reprocessada MUST aparecer como "vigília incompleta", nunca "sem publicações", e o "OK" da tarefa de reprocessar MUST habilitar só com o pendente resolvido.

#### Scenario: CA5 · Falha pendente
- **Dado** uma rodada com falha ainda não reprocessada
- **Quando** o dia é exibido
- **Então** aparece "vigília incompleta", nunca "sem publicações", e o "OK" da tarefa só habilita com o pendente resolvido

### Requirement: CA6 · Reprocessar sem duplicar
Reprocessar SHALL capturar o período perdido sem duplicar publicações e SHALL registrar quem reprocessou e quando.

#### Scenario: CA6 · Reprocessamento
- **Dado** o reprocessamento
- **Quando** roda
- **Então** captura o período perdido sem duplicar publicações e registra quem reprocessou e quando

### Requirement: CA7 · Cada rodada registrada
Cada uma das três rodadas diárias SHALL registrar início, fim, fonte, quantidade capturada e status.

#### Scenario: CA7 · Rodada termina
- **Dado** as três rodadas diárias agendadas
- **Quando** cada uma termina
- **Então** registra início, fim, fonte, quantidade capturada e status

### Requirement: CA8 · Erro, tempo esgotado ou credencial inválida é falha
Erro, tempo esgotado ou credencial inválida MUST marcar a rodada como falha e disparar o alarme para a Sênior; falha de credencial ou da API SHALL ser registrada também para o suporte técnico (o canal está a definir).

#### Scenario: CA8 · Tipos de falha
- **Dado** erro, tempo esgotado ou credencial inválida
- **Quando** a rodada termina
- **Então** ela é marcada como falha e dispara o alarme para a Sênior; com falha de credencial ou da API, o alarme vai também para o suporte técnico

### Requirement: CA9 · Rodada que não rodou também alarma
Uma rodada que não foi executada até 30 minutos depois do horário previsto MUST ser marcada como "não rodou" e disparar o alarme.

#### Scenario: CA9 · Agendador não rodou
- **Dado** uma rodada que não foi executada
- **Quando** passa o horário previsto
- **Então** também dispara o alarme

### Requirement: CA10 · Credenciais fora do código
As credenciais das fontes MUST ficar no cofre de segredos do ambiente (variáveis do `.env` local e do Coolify), nunca no código nem no banco.

#### Scenario: CA10 · Uso das credenciais
- **Dado** as credenciais das APIs AASP e DJEN
- **Quando** o sistema as usa
- **Então** elas ficam num cofre de segredos, fora do código

### Requirement: CA11 · Tarefa "Reprocessar vigília" na Central da Sênior
O alarme SHALL aparecer na Central da Sênior como "Reprocessar vigília", com o contexto "Vigília das publicações" no lugar do nome do cliente.

#### Scenario: CA11 · Central da Sênior
- **Dado** o alarme
- **Quando** a tarefa aparece na Central da Sênior
- **Então** o título usa a ação "Reprocessar vigília", com um contexto no lugar do nome do cliente

### Requirement: CA12 · Dia útil sem nenhuma publicação avisa
Um dia útil sem nenhuma publicação nas três rodadas, todas OK, SHALL mostrar no painel "dia sem publicação: conferir na fonte".

#### Scenario: CA12 · Dia vazio
- **Dado** um dia útil sem nenhuma publicação para o escritório nas três rodadas
- **Quando** o dia fecha
- **Então** o painel avisa "dia sem publicação: conferir na fonte"
