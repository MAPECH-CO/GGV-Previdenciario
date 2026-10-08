# Spec Delta · ggvp-138

## Purpose

Ligar no servidor as telas do Relacionamento com o cliente (GGVP-76, 80, 84, 88, 102 e 111), no padrão da Recepção
(GGVP-125): o contrato em Zod, a rota com o perfil da sessão, as regras puras das telas importadas pelo servidor, os
portões no servidor e o histórico. A conversa usa a ficha e a gravação da Recepção no banco: o que muda na conversa
conferida atualiza a ficha do cliente. Ao fim, o servidor de exemplo do Relacionamento sai do código das telas; a semente
fica só para os testes, num servidor falso que responde às mesmas rotas. A IA, a gravação e o Chatwoot seguem simulados no
servidor, atrás de `RELACIONAMENTO_SIMULADO`.

Dado de saúde (Pedro, 08/10): é o conteúdo médico (laudo, CID, diagnóstico, parecer, o texto dos documentos médicos). O que
a conversa registrou não é: quem vê o caso vê a conversa inteira. Quem confirma o fato novo continua sendo o Jurídico.

## ADDED Requirements

### Requirement: A conversa fica no banco do portal (CA1, CA5)
Abrir, gravar (depois do aviso), pausar, finalizar, anexar a ligação, transcrever, conferir, a pendência e as versões
SHALL ir ao servidor pela API, com o perfil da sessão, e nunca ficar só no navegador. A conversa SHALL abrir em
`POST /api/conversas`, com a ficha no corpo (`POST /api/fichas/:id/conversas` é a conversa sem áudio da Recepção). A
conferida SHALL atualizar a ficha da Recepção e a pessoa, com o valor de antes nas versões.

#### Scenario: Conversa registrada até a ficha atualizada
- **Dado** a Ana, do Atendimento, com a ligação de um lead anexada e transcrita
- **Quando** ela confere o endereço e o telefone, com o cliente verificado por chamada de vídeo
- **Então** a advogada, no computador dela, abre a ficha e vê o endereço e o telefone novos e o histórico da mudança

### Requirement: O perfil da sessão nas rotas (CA3)
As rotas SHALL usar o perfil da sessão (`conversa.registrar`, `ficha.voltar_versao`, `conversa.prazo_da_pendencia`,
`mensagem.enviar`, `dados_bancarios.pedir`, `dados_bancarios.confirmar`, `caso.ver`), nunca um perfil vindo do pedido.

#### Scenario: Financeiro tenta abrir uma conversa
- **Dado** o perfil Financeiro
- **Quando** chama a abertura da conversa
- **Então** é recusado, e a tentativa fica registrada

### Requirement: Os portões no servidor (CA4)
O servidor SHALL recusar: gravar sem o aviso (G10); a conferência de quem não fez a conversa; o fato novo confirmado por
quem não é do Jurídico; telefone, e-mail e dados bancários sem o cliente verificado e o contrato novo, também na edição
da ficha; a mensagem que pede a senha (G9), esconde a situação real (G11) ou sugere diagnóstico ou CID (G20); a segunda
confirmação bancária de quem pediu. A recusa de portão SHALL ficar no histórico, sem o texto.

#### Scenario: Mensagem que pede a senha
- **Dado** a Ana enviando ao cliente um texto que pede a senha do gov.br
- **Quando** o pedido chega ao servidor, com ou sem a tela
- **Então** a mensagem não sai, e a recusa (G9) fica no histórico sem o texto

### Requirement: O servidor de exemplo sai das telas (CA8)
As funções de `apps/web/src/dados/conversa.ts`, `mensagens.ts` e `seguranca.ts` SHALL chamar só a API. A semente e o
antigo servidor de exemplo SHALL ficar só nos testes (`apps/web/src/test/relacionamento/`), respondendo às mesmas rotas.

#### Scenario: Cliente de exemplo no portal
- **Dado** o portal ligado no servidor
- **Quando** alguém abre a conversa ou a mensagem de um cliente que só existe na semente
- **Então** o servidor responde que não o encontra; nos testes, o servidor falso responde com a semente
