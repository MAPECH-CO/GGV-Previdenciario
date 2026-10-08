# Spec Delta · ggvp-55

## Purpose

Subir lote avulso de processos no acervo pelo chat e ver a base em uso na Gestão. Esta entrega cobre só a parte que anda sem o chat com ação e sem a IA (decisão do Mateus, 07/10):
- **Base do acervo:** a Gestão mostra os processos do acervo, os conferidos, os que aguardam conferência e a data da base em uso (CA3).
- **Conferência:** a Sênior confere ou corrige o desfecho lido de cada processo; só o conferido entra nas contas da jurimetria (CA7).

Ficam para depois de 09/10, com o chat com ação e a IA (`kit/entrega-09-10.md`):
- a importação do estudo pela MAPECH (CA1);
- a unificação de grafias (CA2, como na GGVP-59 CA6);
- o pedido pelo chat, com o card de confirmação (CA4);
- o aviso do fim, com os ilegíveis (CA5);
- o acervo que se alimenta sozinho (CA6).

Quem confere: a Sênior. Quem vê a linha da base: a Gestão.

## ADDED Requirements

### Requirement: CA3 · Base do acervo na Gestão
A Gestão SHALL mostrar, na linha "Base do acervo", os totais do acervo e a data da base em uso. Os totais são os processos, os conferidos e os que aguardam conferência, que ficam fora das contas. Uma entrada nova MUST NOT apagar o que o acervo já tem: a anterior fica guardada.

#### Scenario: CA3 · Nova importação
- **Dado** uma nova importação
- **Quando** conclui
- **Então** a anterior fica guardada e a Gestão mostra, na linha "Base do acervo", os totais e a data da base em uso

### Requirement: CA7 · Conferir desfechos do lote
A Sênior SHALL receber, na Central, a tarefa "Conferir desfechos do lote" enquanto houver processo do acervo com desfecho lido e sem conferência, com o desfecho lido em cada processo. Ela confere ou corrige cada um. Só o desfecho conferido MUST entrar nas contas da jurimetria; os outros ficam no acervo para consulta, fora das contas, e nada trava (GGVP-41 CA5).

#### Scenario: CA7 · Fim da leitura do lote
- **Dado** o lote lido
- **Quando** o chat avisa o fim
- **Então** a sênior recebe a tarefa "Conferir desfechos do lote", com o desfecho que a IA leu em cada processo; só os conferidos entram nas contas da jurimetria; os outros ficam no acervo para consulta, fora das contas, e nada trava (GGVP-41 CA5)
