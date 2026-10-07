# Spec Delta · ggvp-96

## Purpose

Perfis e permissões: cada pessoa tem um ou mais perfis e vê e faz só o que o BPMN prevê para a raia dela. Uma matriz de permissões versionada, em `packages/contratos`, vale para a tela e para o servidor. Respostas do PO de 02/10: Sênior e advogada responsável são pessoas diferentes; Sócio é perfil (Lucas e Glauco) e vê a Gestão com valores; os líderes do Atendimento e a Sênior atribuem tarefas; dado de saúde em detalhe só para o Jurídico, e o Atendimento só confere se os documentos estão ok.

## ADDED Requirements

### Requirement: CA1 · Financeiro vê a prestação e não vê entrevista, laudos nem petição
A matriz SHALL dar ao Financeiro a prestação de contas e MUST NOT dar entrevista, laudos nem petição. A tela do caso aplica isto quando existir; a regra já fica na matriz.

#### Scenario: CA1 · Financeiro abre um caso
- **Dado** uma pessoa só com o perfil Financeiro
- **Quando** abre um caso
- **Então** vê a prestação de contas e não vê entrevista, laudos nem petição

### Requirement: CA2 · Aprovar para o INSS só para a Sênior
A ação "aprovar o caso para o INSS" MUST aparecer só para o perfil Sênior.

#### Scenario: CA2 · Sem o perfil Sênior
- **Dado** uma pessoa sem o perfil Sênior
- **Quando** tenta aprovar um caso para o INSS
- **Então** a ação não aparece

### Requirement: CA3 · Mudança de perfil no histórico
Toda mudança dos perfis de uma pessoa SHALL ficar no histórico com quem mudou e quando.

#### Scenario: CA3 · Salvar uma mudança de perfil
- **Dado** uma mudança de perfil
- **Quando** ela é salva
- **Então** fica no histórico com quem mudou e quando

### Requirement: CA4 · Liberar ao Jurídico só a Documentação
A ação "liberar o caso ao Jurídico" MUST aparecer só para a Documentação, e o servidor MUST recusar para os demais.

#### Scenario: CA4 · Sem o perfil Documentação
- **Dado** uma pessoa sem o perfil Documentação
- **Quando** tenta liberar o caso ao Jurídico
- **Então** a ação não aparece e o servidor recusa

### Requirement: CA5 · Perícia com o Jurídico administrativo
A matriz SHALL dar ao Jurídico administrativo marcar a perícia e subir o comprovante, decidir se ela pede documento novo, orientar o cliente, registrar o comparecimento e remarcar; o Atendimento MUST NOT ter essas ações.

#### Scenario: CA5 · Jurídico administrativo abre a tarefa de perícia
- **Dado** o perfil Jurídico administrativo
- **Quando** abre uma tarefa de perícia
- **Então** pode marcar, subir o comprovante, decidir documento novo, orientar, registrar o comparecimento e remarcar; o Atendimento não tem essas ações

### Requirement: CA6 · A tarefa de perícia é aberta pelo sistema
Abrir a tarefa de perícia MUST NOT ser ação de nenhum perfil: é o sistema, depois da decisão da advogada.

#### Scenario: CA6 · Advogada decide que precisa de perícia
- **Dado** que a advogada decide que o caso precisa de perícia
- **Quando** decide
- **Então** a tarefa de perícia é aberta pelo sistema, sem ação de outro perfil

### Requirement: CA7 · Laudo novo: o Atendimento sobe, a advogada confere
A matriz SHALL dar "subir laudo novo" ao Atendimento e "conferir laudo" à advogada responsável.

#### Scenario: CA7 · Chega um laudo novo
- **Dado** um laudo novo
- **Quando** chega
- **Então** quem sobe no card é o Atendimento e quem confere é a advogada

### Requirement: CA8 · O servidor confere o perfil e registra a recusa
Toda ação sensível MUST passar pela checagem do perfil ativo no servidor; chamada sem permissão MUST receber 403 e gerar evento de auditoria. O vínculo com o caso entra com as rotas de caso.

#### Scenario: CA8 · Ação sem permissão
- **Dado** qualquer ação sensível
- **Quando** é chamada
- **Então** o servidor confere o perfil; sem permissão, recebe erro de autorização e gera evento de auditoria

### Requirement: CA9 · A tela esconde, o servidor protege
A tela SHALL esconder a ação que o perfil não tem, com a mesma matriz do servidor; a proteção MUST NOT depender da tela.

#### Scenario: CA9 · Tela sem a permissão
- **Dado** uma tela
- **Quando** a pessoa não tem a permissão
- **Então** a ação não aparece, mas a proteção não depende disso

### Requirement: CA10 · "Entrar como…" só com os perfis da pessoa
"Entrar como…" SHALL listar só os perfis atribuídos à pessoa; a troca MUST ficar registrada; só o Sócio atribui perfis; o servidor MUST recusar troca para perfil não atribuído.

#### Scenario: CA10 · Abrir o "Entrar como…"
- **Dado** o "Entrar como…"
- **Quando** a pessoa abre
- **Então** só aparecem os perfis atribuídos a ela; a troca fica registrada; sem o perfil Sênior, "Sênior" não aparece e aprovar pela API é recusado

### Requirement: CA11 · Tela de outro perfil mostra "sem permissão"
Tela que o perfil ativo não pode abrir SHALL mostrar "Sem permissão" e MUST NOT carregar dado do caso.

#### Scenario: CA11 · Abrir tela de outro perfil
- **Dado** o endereço de uma tela de passo de outro perfil
- **Quando** alguém sem permissão o abre
- **Então** vê "sem permissão" e nenhum dado do caso é carregado

### Requirement: CA12 · Dado de saúde, petição e valores não saem para quem não pode
A matriz SHALL dizer quem vê dado de saúde em detalhe (advogada, Sênior, Jurídico administrativo), petição (Jurídico) e valores (só o Financeiro; a advogada vê os da prestação de contas que ela faz, e o Sócio só totais do escritório, na GGVP-75; Pedro, 06/10). As rotas de caso e de busca MUST filtrar por ela quando existirem.

#### Scenario: CA12 · Atendimento pede dado de saúde
- **Dado** um perfil sem acesso a dado de saúde, petição ou valores
- **Quando** pede esses dados à API (inclusive na busca)
- **Então** eles não vêm

### Requirement: CA13 · Acesso a dado de saúde registrado
Todo acesso a dado de saúde por perfil autorizado SHALL ficar registrado (quem, quando, caso), na tabela de acessos sensíveis. Aberto nesta change: aqui só nasce a tabela (`acesso_dado_sensivel`, que só cresce, GGVP-129 CA3). A gravação entra com as rotas que devolvem dado de saúde, cada uma com teste: a conferência da Sênior na Via administrativa (PR #14, parecer médico) e a de documentos na Judicialização (PR #16).

#### Scenario: CA13 · Perfil autorizado acessa dado de saúde
- **Dado** um perfil autorizado
- **Quando** acessa dado de saúde
- **Então** o acesso fica registrado (quem, quando, caso)

### Requirement: CA14 · Relatórios seguem o perfil
Relatórios e exportações MUST seguir as mesmas restrições da matriz, quando existirem. Aberto nesta change: os relatórios nascem na Garantia (PR #18: exportação do histórico e relatório de prazos), e o teste vai lá.

#### Scenario: CA14 · Gerar relatório
- **Dado** relatórios e exportações
- **Quando** alguém os gera
- **Então** seguem as mesmas restrições do perfil

### Requirement: CA15 · Matriz versionada com teste por perfil
A matriz SHALL ter número de versão e teste por perfil; mudar a matriz sem mudar a versão MUST quebrar o teste.

#### Scenario: CA15 · A matriz muda
- **Dado** a matriz de permissões
- **Quando** muda
- **Então** ganha nova versão e testes automatizados por perfil

### Requirement: CA16 · Quem dá o OK na prestação não registra o recebimento (proposta)
A mesma pessoa MUST NOT dar o OK na prestação de contas e registrar o recebimento dela; o banco já recusa.

#### Scenario: CA16 · Mesma pessoa nas duas pontas
- **Dado** um caso com prestação de contas
- **Quando** a mesma pessoa tenta dar o OK na prestação e registrar o recebimento
- **Então** o portal recusa a segunda ação
