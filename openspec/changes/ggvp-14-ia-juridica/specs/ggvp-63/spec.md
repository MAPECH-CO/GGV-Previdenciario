# Spec Delta · ggvp-63

## Purpose

A parte de IA que a GGVP-63 deixou para este épico: ao pedir a petição inicial, a IA escreve a versão 1 com o que o caso já tem (benefício, motivo do indeferimento, despacho da Sênior, parecer médico, documentos citados, instruções e opções da advogada) e mostra as fontes que usou. A advogada revisa e pede a petição pelo caminho de sempre; a conferência e a assinatura continuam dela (G6). O escritório autorizou dado de saúde na IA (07/10).

## ADDED Requirements

### Requirement: IA · A IA escreve a versão 1, com as fontes
Com os setores fechados, a minuta da IA SHALL chegar pronta na caixa da versão 1 quando a advogada abre "Pedir a petição", escrita com o padrão do pedido (todos os documentos do caso marcados, "usar precedentes do acervo" marcado, sem instruções), como sugestão e com as fontes usadas (documentos citados, indeferimento, parecer, acervo). Se ela muda as instruções, as opções ou os documentos, "Escrever de novo com a IA" SHALL fazer outra minuta. A minuta MUST NOT criar o pedido nem a versão: só o "Pedir a petição" da advogada grava.

#### Scenario: IA · Pedir a minuta
- **Dado** um caso com os setores fechados, o indeferimento e o parecer registrados
- **Quando** a advogada abre "Pedir a petição"
- **Então** o texto aparece na caixa da versão 1, marcado como sugestão, com as fontes; nenhuma petição é criada até ela pedir

### Requirement: IA · A versão 1 da IA fica marcada
A versão 1 pedida a partir da minuta SHALL ficar com a marca "minuta da IA" em quem gerou e com a chamada da IA no histórico.

#### Scenario: IA · Pedir com o texto da IA
- **Dado** a minuta da IA, revisada pela advogada
- **Quando** ela pede a petição
- **Então** a versão 1 mostra que veio da minuta da IA, e o histórico guarda a chamada

### Requirement: IA · O que a minuta não faz
A minuta MUST NOT inventar jurisprudência, número de processo nem dado médico que não esteja no caso, MUST NOT trazer número de jurimetria (G22), e SHALL marcar com "[completar: …]" o que faltar. Com "usar precedentes do acervo" marcado e o acervo vazio, a tela SHALL avisar "sem referência na casa" (GGVP-45 CA2).

#### Scenario: IA · Acervo vazio
- **Dado** "usar precedentes do acervo" marcado e o acervo sem casos
- **Quando** a minuta é pedida
- **Então** a tela avisa "sem referência na casa"
