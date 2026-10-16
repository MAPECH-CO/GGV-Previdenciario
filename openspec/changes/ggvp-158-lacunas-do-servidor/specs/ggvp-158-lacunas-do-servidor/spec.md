# Spec Delta · ggvp-158-lacunas-do-servidor

## Purpose

Fechamento do desenvolvimento (GGVP-158), frente de 16/10: as lacunas graves do servidor que a conferência dos critérios de 15/10 deixou sem PR. Um requisito por lacuna corrigida; o que espera decisão fica na proposta.

## ADDED Requirements

### Requirement: L1 · O acervo no chat é de quem vê as peças
A ferramenta `buscar_no_acervo` do chat SHALL ser oferecida ao modelo só para quem tem `peticao.ver` (Jurídico e Sócio). Nenhum trecho do acervo (transcrição, conversa, modelo de petição) SHALL chegar ao modelo pela pergunta do Financeiro, da Documentação ou do Atendimento.

#### Scenario: L1 · O Financeiro pede caso parecido
- **Dado** no acervo uma transcrição conferida de entrevista que não é só do Jurídico e um modelo de petição ativo
- **Quando** o Financeiro, a Documentação ou o Atendimento pergunta ao chat por caso parecido
- **Então** o modelo não recebe a ferramenta do acervo, e nem a transcrição nem o modelo de petição chegam a ele

#### Scenario: L1 · A advogada segue com o acervo
- **Dado** uma petição aprovada de outro caso
- **Quando** a advogada pergunta por caso parecido
- **Então** a ferramenta devolve o trecho com a fonte, como antes

### Requirement: L2 · O OK da prestação pede as quatro conferências
Concluir ou alterar a prestação de contas SHALL exigir as quatro conferências do GGVP-92 CA5, cada uma recusada com a sua mensagem:
- os valores com a carta de concessão;
- os honorários com o contrato;
- os dados bancários do cliente confirmados pelo Atendimento;
- o texto do aviso ao cliente revisado.

A leitura da prestação SHALL trazer o texto do modelo do aviso, para a Sênior revisar. Na tela, o OK só habilita com as quatro marcadas.

#### Scenario: L2 · Falta uma conferência
- **Dado** o caso deferido, com a carta
- **Quando** a Sênior conclui sem uma das quatro conferências
- **Então** a API responde 400 com a mensagem daquela conferência, e nada é gravado

#### Scenario: L2 · As quatro marcadas
- **Dado** o mesmo caso
- **Quando** a Sênior marca as quatro e conclui
- **Então** a versão 1 é gravada e o Financeiro recebe a tarefa

#### Scenario: L2 · A Sênior revisa o aviso
- **Dado** o modelo "Confirmação da ida ao banco" ativo
- **Quando** a Sênior abre a prestação
- **Então** vê o texto do aviso antes da caixa "Revisei o texto do aviso ao cliente"

### Requirement: L3 · Dado bancário esperando a segunda confirmação trava o OK
Com um pedido de mudança de dados bancários do cliente ainda sem a segunda confirmação, o OK da prestação SHALL ser recusado com 409, sem gravar versão nem abrir tarefa, até a confirmação. O prazo de "alterados há pouco" depois da confirmação espera o Lucas (GGVP-92 CA10).

#### Scenario: L3 · Mudança sem segunda confirmação
- **Dado** o caso deferido e um pedido de mudança dos dados bancários do cliente sem confirmação
- **Quando** a Sênior dá o OK com as quatro conferências
- **Então** a API responde 409 dizendo que os dados esperam a segunda confirmação, na ficha do cliente

#### Scenario: L3 · Confirmada a mudança
- **Dado** o mesmo pedido, confirmado por outra pessoa
- **Quando** a Sênior dá o OK
- **Então** a versão é gravada
