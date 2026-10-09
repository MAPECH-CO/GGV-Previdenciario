# Spec Delta · ggvp-67

## Purpose

Conferir a petição: a advogada lê a versão inteira, vê o que mudou desde a anterior, edita ela mesma ou aprova com as marcações (G6, G18); aprovada, nasce o pacote do protocolo (GGVP-71). Ninguém assina: a petição sai com a assinatura padrão do Glauco. Revisor, 06/10: sem IA até o épico IA jurídica, a nova versão vem de "Editar eu mesma"; o botão é "Aprovar e enviar ao protocolo".

## ADDED Requirements

### Requirement: CA1 · "Não está boa" gera nova versão, a anterior fica
Com "Não está boa" e o porquê, SHALL sair uma nova versão, e a anterior MUST ficar guardada. Sem IA, a nova versão vem de "Editar eu mesma"; a nova versão pela IA entra com o épico IA jurídica.

#### Scenario: CA1 · Não está boa
- **Dado** a minuta
- **Quando** clico "Não está boa" e escrevo o porquê
- **Então** sai nova versão e a anterior fica guardada

### Requirement: CA2 · Aprovação registrada (G6)
A aprovação SHALL registrar quem aprovou e qual versão (G6).

#### Scenario: CA2 · Aprovar
- **Dado** a minuta aprovada
- **Quando** confirmo
- **Então** fica registrado quem aprovou e qual versão (G6)

### Requirement: CA3 · Diferenças destacadas
Comparando uma versão com a anterior, a tela SHALL destacar as diferenças.

#### Scenario: CA3 · Comparar
- **Dado** qualquer versão
- **Quando** comparo com a anterior
- **Então** vejo as diferenças destacadas

### Requirement: CA4 · Versão completa e o que mudou
A conferência SHALL mostrar a versão completa e o que mudou em relação à anterior. Os pontos de atenção da IA entram com o épico IA jurídica.

#### Scenario: CA4 · Conferir
- **Dado** a minuta
- **Quando** confiro
- **Então** vejo a versão completa e o que mudou em relação à anterior; os pontos de atenção entram com o épico IA

### Requirement: CA5 · "Aprovar" só com as marcações; versões numeradas
"Aprovar" MUST habilitar só com "Li a petição na íntegra" e "Fundamentos, pedidos e valores conferem com o caso" marcados. A nova versão SHALL sair numerada, com as anteriores preservadas; o pedido à IA, com "O que mudar" obrigatório, entra com o épico IA jurídica.

#### Scenario: CA5 · Habilitar a aprovação
- **Dado** a conferência
- **Quando** vou aprovar
- **Então** "Aprovar" só habilita com "Li a petição na íntegra" e "Fundamentos, pedidos e valores conferem com o caso" marcados; a nova versão sai numerada, com as anteriores preservadas

### Requirement: CA6 · Aprovada, o identificador e o pacote
A versão aprovada SHALL guardar o identificador do conteúdo, quem aprovou e o horário, e o sistema SHALL gerar o pacote do protocolo, já com a assinatura padrão do Glauco (GGVP-71).

#### Scenario: CA6 · Versão aprovada
- **Dado** a versão aprovada
- **Quando** confirmo
- **Então** ficam o identificador do conteúdo, quem aprovou e o horário, e o sistema gera o pacote do protocolo com a assinatura padrão

### Requirement: CA7 · A aprovada não muda
Uma versão aprovada MUST NOT ser alterada: mexer nela SHALL criar nova versão, exigir nova conferência e registrar a tentativa.

#### Scenario: CA7 · Alterar a aprovada
- **Dado** uma versão já aprovada
- **Quando** alguém tenta alterá-la
- **Então** o sistema não altera: cria nova versão, exige nova conferência e registra a tentativa

### Requirement: CA8 · Só a advogada aprova; ninguém assina
A conclusão da conferência por quem não pode aprovar MUST ser recusada no servidor, e a recusa SHALL ficar registrada; só a advogada aprova, e a petição sai sempre com a assinatura padrão do Glauco.

#### Scenario: CA8 · Sem permissão
- **Dado** alguém sem permissão para aprovar
- **Quando** tenta concluir a conferência
- **Então** a ação é recusada no servidor e registrada

### Requirement: CA9 · Nada contradiz o requisito do benefício (G18)
Ao aprovar, a advogada MUST marcar também "Nada contradiz o requisito do benefício" (G18). As travas antes de protocolar (G7) são conferidas com o pacote pronto (GGVP-71).

#### Scenario: CA9 · Aprovar na tela do processo
- **Dado** a conferência
- **Quando** aprovo
- **Então** marco também "Nada contradiz o requisito do benefício" (G18)

### Requirement: CA10 · "Editar eu mesma" gera versão nova
Cada edição da advogada em "Editar eu mesma" SHALL gerar uma versão nova, e as anteriores MUST ficar guardadas.

#### Scenario: CA10 · Editar eu mesma
- **Dado** "Editar eu mesma"
- **Quando** a advogada edita o texto
- **Então** cada edição gera uma versão nova, e as anteriores ficam guardadas

### Requirement: CA11 · Título "Conferir petição"
A tarefa SHALL aparecer na Central com o nome do cliente e "Conferir petição".

#### Scenario: CA11 · Na Central
- **Dado** a tarefa
- **Quando** aparece na Central
- **Então** o título é o nome do cliente + "Conferir petição"

### Requirement: CA12 · Petição com "[completar]" não se aprova
Enquanto o texto da versão tiver um marcador "[completar...]", aprovar MUST ser recusado com "O texto ainda tem [completar]: preencha antes de aprovar." (revisão de 08/10): a versão aprovada vira o PDF que vai ao juiz. A regra é a mesma na tela e no servidor.

#### Scenario: CA12 · Minuta com lacuna
- **Dado** a última versão com "valor da causa [completar]"
- **Quando** a advogada aprova com as três marcações
- **Então** o portal recusa, diz que falta completar, e o pacote não é gerado
