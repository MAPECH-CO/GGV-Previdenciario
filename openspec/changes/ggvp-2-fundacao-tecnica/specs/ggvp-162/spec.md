# Spec Delta · ggvp-162

## Purpose

Quem abre o processo (decisão do Mateus em 14/10; o Lucas confirma na review): o Jurídico, isto é, a advogada, a Sênior e o
Jurídico administrativo, e o Sócio, que lê tudo. O Atendimento, a líder do Atendimento e a Documentação trabalham pela ficha
do cliente e pelas tarefas: a ficha mostra, de cada processo, a etapa, o que fazer agora, os documentos que faltam e o
prazo, e cada tarefa abre a tela do passo. É a resposta do Lucas na GGVP-96 (02/10): o Atendimento confere no card do
cliente se documentos, laudos e perícias estão ok; o Jurídico vê os detalhes e os porquês no card do processo. Continua a
GGVP-96 (CA8, CA9, CA11 e CA12).

"Abrir o processo" é a página do processo, a lista de processos, a busca de processos e o histórico do processo. A página
da perícia continua de todos que veem o caso (saúde simples, GGVP-156), e as telas dos passos seguem com a permissão de
cada passo. O Financeiro já não abria o caso. Matriz versão 32.

## ADDED Requirements

### Requirement: CA1 · Página, lista e histórico do processo só para o Jurídico e o Sócio
O servidor MUST recusar (403, com a tentativa registrada) a página do processo, a lista de processos e o histórico do
processo para o Atendimento, a líder do Atendimento e a Documentação, sem mandar dado do processo. A tela SHALL mostrar
"Sem permissão" nesses endereços.

#### Scenario: CA1 · Pelo endereço
- **Dado** o Atendimento, a líder do Atendimento ou a Documentação
- **Quando** abrem a página de um processo, a lista de processos ou o histórico do processo, inclusive pelo endereço
- **Então** veem "Sem permissão" e o servidor recusa (403, com a tentativa registrada), sem mandar dado do processo

### Requirement: CA2 · A busca desses perfis traz só clientes
Para o Atendimento, a líder do Atendimento e a Documentação, a busca do topo e da Central SHALL trazer só clientes, e o
servidor MUST recusar a busca de processos.

#### Scenario: CA2 · Buscar
- **Dado** o Atendimento, a líder do Atendimento ou a Documentação
- **Quando** buscam no topo ou na Central
- **Então** a busca traz só clientes; o servidor recusa a busca de processos

### Requirement: CA3 · A ficha mostra o processo sem abrir a página dele
Na ficha do cliente, para quem não abre o processo, cada processo SHALL mostrar número, benefício, etapa, o que fazer
agora, documentos pendentes e prazo, e MUST NOT ser link para a página do processo nem oferecer o atalho "Histórico do
processo". O caso em perícia continua abrindo a página da perícia.

#### Scenario: CA3 · A ficha do cliente
- **Dado** o Atendimento, a líder do Atendimento ou a Documentação
- **Quando** abrem a ficha do cliente
- **Então** cada processo mostra número, benefício, etapa, o que fazer agora, documentos pendentes e prazo, sem link para a
  página do processo; o caso em perícia continua abrindo a página da perícia, e o atalho "Histórico do processo" não aparece

### Requirement: CA4 · A líder do Atendimento sem Processos no topo
O topo da líder do Atendimento SHALL ter Clientes e a Gestão, sem Processos. Na lista de clientes, a contagem de processos
MUST NOT ser link para quem não abre o processo.

#### Scenario: CA4 · O topo da líder
- **Dado** a líder do Atendimento
- **Quando** abre o topo
- **Então** tem Clientes e a Gestão, sem Processos; na lista de clientes, a contagem de processos não é link

### Requirement: CA5 · Nenhuma tela leva esses perfis à página do processo
"Ajustar o caso" SHALL levar quem não abre o processo à ficha do cliente para corrigir, e a página da perícia MUST NOT
oferecer "Abrir o processo" a quem não o abre.

#### Scenario: CA5 · Ajustar o caso e a perícia
- **Dado** "Ajustar o caso" (devolvido pela Sênior) ou a página da perícia
- **Quando** o Atendimento, a líder ou a Documentação querem corrigir ou ver mais
- **Então** a tela leva à ficha do cliente, e "Abrir o processo" não aparece

### Requirement: CA6 · O chat desses perfis lê o caso pela ficha
Para quem não abre o processo, a leitura do caso pelo chat SHALL trazer só o que a ficha mostra do processo (número,
benefício, etapa, o que fazer agora e prazo), nunca a página do processo, e o link do caso SHALL levar à ficha do cliente.

#### Scenario: CA6 · Perguntar sobre um caso
- **Dado** o chat do Atendimento, da líder ou da Documentação
- **Quando** perguntam sobre um caso
- **Então** a IA lê o caso como a ficha mostra (benefício, etapa, o que fazer agora e prazo), e o link leva à ficha do
  cliente, não à página do processo

### Requirement: CA7 · O Jurídico e o Sócio sem mudança; matriz versão 32
A advogada, a Sênior, o Jurídico administrativo e o Sócio SHALL continuar abrindo a página, a lista, a busca e o histórico
do processo. A matriz de permissões SHALL ganhar `processo.abrir` e subir para a versão 32, com a impressão digital nova e o
teste por perfil.

#### Scenario: CA7 · Quem abre
- **Dado** o Jurídico (advogada, Sênior, Jurídico administrativo) e o Sócio
- **Quando** abrem processos
- **Então** nada muda; a matriz de permissões ganha `processo.abrir` e sobe para a versão 32, com o teste por perfil

### Requirement: CA8 · O Sócio tem Clientes e Processos no topo
O topo do Sócio SHALL ter Clientes e Processos, como o Jurídico, porque o Sócio lê tudo (decisão do Lucas, 07/10) e a matriz
já lhe dá `caso.ver` e `processo.abrir` (o Lucas, como Sócio, não achava as listas na homologação, 14/10).

#### Scenario: CA8 · O topo do Sócio
- **Dado** o Sócio
- **Quando** abre o topo
- **Então** tem Clientes e Processos depois do Início, além da Gestão e do Financeiro

### Requirement: CA9 · O Sócio chega pelo topo a todas as telas de consulta, sem ação nova
Em toda tela, o topo do Sócio SHALL levar a todas as telas de consulta do escritório que a matriz já lhe deixa ver: além
das do CA8, Estudos de caso, Roteiros de laudos (só leitura) e o painel da Vigília, que hoje só se abre pelos alarmes da
fila da Sênior. O Sócio MUST NOT ganhar ação nova: ele só vê; quem faz cada passo continua sendo cada setor, e os botões de
ação dessas telas seguem escondidos para ele (Mateus, 14/10: "o sócio não faz nada, ele só tem acesso a todas as
visualizações").

#### Scenario: CA9 · As telas de consulta pelo topo
- **Dado** o Sócio em qualquer tela
- **Quando** abre o topo
- **Então** tem Estudos de caso, Roteiros de laudos e Vigília, além do que o CA8 já dá, e cada um abre só para leitura

#### Scenario: CA9 · Nenhuma ação nova
- **Dado** o Sócio no painel da Vigília, nos Estudos de caso ou nos Roteiros de laudos
- **Quando** a tela abre
- **Então** não aparecem "Reprocessar", a revisão do estudo nem a edição do roteiro, e a matriz de permissões não muda
