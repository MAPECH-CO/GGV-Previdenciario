# Spec Delta · ggvp-61 · Orientação da perícia, padrão ou pelo perfil do perito

## Purpose

O Jurídico administrativo recebe um documento de orientação para o cliente, montado pela IA, para preparar o cliente sobre o que o perito costuma observar, perguntar e pedir. Respostas do Lucas de 02/10: regra unificada (perito conhecido e com perfil → pelo perfil, na médica ou na social, no INSS ou no juízo; senão, a padrão, com o motivo); o perito vem depois, nas informações do processo, e a equipe informa; a padrão também consulta o acervo; a jurimetria começa com 5 perícias, mas o mínimo é 10; o perito desconhecido não trava. A orientação nunca manda esconder ou mudar a situação real (G11) nem sugere diagnóstico ou frase pronta (G20). Passo DP.05 do Miro (sem tela própria). Figma: perícia judicial marcada `2179:664`, chat "dica para a perícia" `2186:857`, Overlays · Jurimetria · Perito `2184:2` e `2184:53`. Contrato na `design.md`, seção GGVP-61.

## ADDED Requirements

### Requirement: CA1 · Perícia médica: a IA monta a orientação padrão
Registrada a data de uma perícia médica sem perito conhecido com perfil, a IA SHALL montar a orientação padrão.

#### Scenario: CA1 · Data registrada na perícia médica
- **Dado** perícia médica
- **Quando** a data é registrada (no INSS, o sistema a lê do comprovante, DP.04)
- **Então** a IA monta a orientação padrão

### Requirement: CA2 · Avaliação social: pelo perfil do perito, se ele tem perfil
Registrada a data de uma avaliação social, o sistema SHALL identificar o perito nomeado no processo e, se ele tem perfil no acervo, a IA SHALL montar a orientação pelo perfil; se não tem, a padrão.

#### Scenario: CA2 · Data registrada na avaliação social
- **Dado** avaliação social
- **Quando** a data é registrada
- **Então** o sistema identifica o perito nomeado no processo e, se ele tem perfil no acervo, a IA monta a orientação pelo perfil; se não tem, monta a padrão

### Requirement: CA3 · [v2] A jurimetria do perito entra na orientação
Com o perito identificado, médico ou social, a orientação SHALL usar também a jurimetria do perito (GGVP-59, dados de exemplo até ela existir). A recomendação da GGVP-38 entra quando ela existir.

#### Scenario: CA3 · Perito identificado
- **Dado** um perito identificado, médico ou social
- **Quando** a orientação é montada
- **Então** usa também a jurimetria do perito (GGVP-59) e a recomendação do GGVP-38

### Requirement: CA4 · Nunca instrução para esconder ou mudar a situação (G11)
A orientação MUST NOT conter instrução para esconder ou mudar a situação real da casa, e uma revisão automática SHALL bloquear texto assim (G11).

#### Scenario: CA4 · Orientação gerada
- **Dado** qualquer orientação
- **Quando** é gerada
- **Então** não contém instrução para esconder ou mudar a situação real da casa, e uma revisão automática bloqueia texto assim (G11)

### Requirement: CA5 · Avaliação social sem perito: a padrão, com o motivo
Sem perito identificado na avaliação social, a orientação SHALL ser a padrão e o motivo SHALL ser registrado.

#### Scenario: CA5 · Sem perito
- **Dado** avaliação social sem perito identificado
- **Quando** a orientação é montada
- **Então** usa a padrão e registra o motivo

### Requirement: CA6 · Perito não reconhecido: nada trava e a pergunta é de um clique
Com um perito que o sistema não reconhece, nada SHALL travar: a página do processo SHALL mostrar uma pergunta de um clique para ligar o perito certo, e enquanto isso SHALL valer a orientação padrão, com o aviso de que a jurimetria não foi feita.

#### Scenario: CA6 · Perito desconhecido
- **Dado** um perito que o sistema não reconhece
- **Quando** tenta identificar
- **Então** nada trava: surge uma pergunta de um clique na página do processo para ligar o perito certo, e enquanto isso vale a orientação padrão

### Requirement: CA7 · A orientação traz data, local, o que levar e, na social, a visita
A orientação pronta SHALL trazer data, local, o que levar e, na social, como é a visita em casa.

#### Scenario: CA7 · Orientação pronta
- **Dado** a orientação gerada
- **Quando** fica pronta
- **Então** traz data, local, o que levar e, na social, como é a visita em casa

### Requirement: CA8 · O conteúdo passa pela verificação antes de chegar ao Jurídico
O conteúdo gerado pela IA SHALL passar pela verificação de instruções proibidas (esconder, mudar ou simular a situação; diagnóstico, CID ou frase pronta, G20) antes de chegar ao Jurídico administrativo; se encontrar, SHALL bloquear e pedir revisão.

#### Scenario: CA8 · Conteúdo da IA
- **Dado** o conteúdo gerado pela IA
- **Quando** vai para o Jurídico administrativo
- **Então** passa antes pela verificação de instruções proibidas; se encontrar, bloqueia e pede revisão

### Requirement: CA9 · A versão do perfil usada fica registrada
A orientação pelo perfil do perito SHALL registrar a versão do perfil usada.

#### Scenario: CA9 · Orientação pelo perfil
- **Dado** a orientação pelo perfil do perito
- **Quando** é gerada
- **Então** registra a versão do perfil usada

### Requirement: CA10 · Pedido malicioso é bloqueado, com teste automatizado
Um pedido malicioso à IA (esconder, mudar ou simular a situação, ou levar ao médico um diagnóstico pronto) SHALL ter a saída bloqueada pela verificação, com teste automatizado desses pedidos.

#### Scenario: CA10 · Pedido malicioso
- **Dado** um pedido malicioso à IA
- **Quando** a orientação é gerada
- **Então** a verificação bloqueia a saída; há teste automatizado com esses pedidos

### Requirement: CA11 · O chat recusa e registra o pedido (G11)
O pedido no chat de uma orientação para esconder ou mudar a situação real SHALL ser recusado, e o pedido SHALL ficar registrado (G11).

#### Scenario: CA11 · Pedido no chat
- **Dado** alguém que pede no chat uma orientação para esconder ou mudar a situação real
- **Quando** envia
- **Então** o chat recusa e o pedido fica registrado (G11)

### Requirement: CA12 · Jurimetria por código; amostra pequena não chega ao cliente (G22)
Os números da jurimetria do perito SHALL vir do sistema, e a IA só explica e cita as fontes; com amostra abaixo do mínimo (10 laudos, Lucas 02/10), a jurimetria SHALL aparecer como "amostra insuficiente" e MUST NOT chegar ao cliente (G22).

#### Scenario: CA12 · Jurimetria na orientação
- **Dado** a jurimetria do perito usada na orientação
- **Quando** a orientação é montada
- **Então** os números vêm do sistema e a IA só explica e cita as fontes; com amostra abaixo do mínimo, a jurimetria aparece como "amostra insuficiente" e nunca chega ao cliente (G22)
