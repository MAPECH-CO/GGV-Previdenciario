# Spec Delta · ggvp-135 · Toda tela alcançável por clique, por perfil

## Purpose

Cada pessoa do escritório, entrando com o próprio login, chega por clique a tudo o que o perfil pode fazer, a partir da tela inicial, sem digitar endereço, e não vê o que não é dela. Transversal. Figma `nHOPzl005CpWDXUWyVZIo6`, página 10:2: Centrais da Sênior `59:609`, do Financeiro `59:863` e do líder `1600:2`; ficha do Jurídico `73:2`. A auditoria, com o que espera decisão, fica em `docs/navegacao-por-perfil.md`.

## ADDED Requirements

### Requirement: CA1 · As telas que só abriam pelo endereço abrem por clique
A Sênior SHALL chegar à dispensa do parecer e ao histórico do processo do servidor pela ficha do cliente, e aos roteiros de laudos pelo topo; o Jurídico SHALL chegar à linha do tempo da deficiência pela ficha.

#### Scenario: CA1 · A dispensa do parecer da Rita
- **Dado** a Sênior entrou com o login dela
- **Quando** busca a Rita, abre a ficha e clica em "Dispensar o parecer"
- **Então** abre a dispensa do parecer da Rita, sem digitar o endereço

### Requirement: CA2 · O que o perfil não usa não aparece
O atalho do caso, o item do topo e o resultado da busca SHALL aparecer só para o perfil que pode usar a tela, pela matriz de permissões.

#### Scenario: CA2 · A busca do Financeiro
- **Dado** o Financeiro, que não tem `caso.ver`
- **Quando** busca um cliente na tela inicial
- **Então** não vê cliente nem processo, só as tarefas dele, e a tela diz por quê

### Requirement: CA5 · A Gestão no topo do líder e a busca e o chat em toda Central
A Central do Atendimento SHALL mostrar a Gestão no topo para quem tem `gestao.ver`; a Central da Sênior, do Financeiro e do Sócio SHALL ter a busca e o chat, como as outras.

#### Scenario: CA5 · O líder do Atendimento
- **Dado** o líder do Atendimento entrou com o login dele
- **Quando** clica em "Prazos" no topo
- **Então** abre o relatório de prazos cumpridos e perdidos

### Requirement: CA7 · O relatório da auditoria
`docs/navegacao-por-perfil.md` SHALL trazer, por perfil, a tela inicial, o topo, a busca e o chat, as telas que ganharam caminho e o que espera decisão ou outro dono.

#### Scenario: CA7 · Ler o relatório
- **Dado** a auditoria terminou
- **Quando** abro `docs/navegacao-por-perfil.md`
- **Então** vejo o que foi corrigido e o que espera decisão, com quem
