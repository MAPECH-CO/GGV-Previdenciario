# Spec Delta · ggvp-117

## Purpose

Entrar no portal com e-mail e senha e ver só o que o perfil permite, para que ninguém veja dado de cliente sem estar identificado. Versão mínima para 09/10: 2FA, "esqueci a senha" e convite ficam para depois.

## ADDED Requirements

### Requirement: CA1 · Entrar leva à Central do perfil, sessão de 8 horas
Com e-mail e senha corretos, o portal SHALL abrir a Central do perfil da pessoa, e a sessão MUST durar 8 horas ou até a pessoa sair. Senha provisória, cadastrada pela gestão, MUST obrigar a troca no primeiro acesso, antes de qualquer tela (resposta do PO, Q1, 01/10).

#### Scenario: CA1 · Entrar com e-mail e senha corretos
- **Dado** e-mail e senha corretos
- **Quando** entro
- **Então** vejo a Central do meu perfil e a sessão dura 8 horas ou até sair

### Requirement: CA2 · Erro sem dizer qual campo, trava na 5ª tentativa
Com senha errada, o portal SHALL mostrar a mensagem única "E-mail ou senha inválidos.", sem dizer qual dos dois; na 5ª tentativa errada seguida a conta MUST travar por 15 minutos. A gestão SHALL poder destravar na hora, e o destravamento MUST ficar no histórico (resposta do PO, Q2, 01/10).

#### Scenario: CA2 · Senha errada
- **Dado** senha errada
- **Quando** tento entrar
- **Então** vejo uma mensagem única ("e-mail ou senha inválidos"), sem dizer qual dos dois; na quinta tentativa errada seguida a conta trava por 15 minutos

### Requirement: CA3 · Sessão expirada volta ao login e depois à mesma tela
Com a sessão expirada, qualquer ação SHALL levar ao login, e depois de entrar o portal MUST voltar para a mesma tela.

#### Scenario: CA3 · Sessão expirada
- **Dado** a sessão expirada
- **Quando** faço qualquer ação
- **Então** volto ao login e, depois de entrar, volto para a mesma tela

### Requirement: CA4 · Sem perfil, nenhuma tela de caso
Pessoa sem perfil atribuído SHALL ver "Sem perfil, fale com a gestão." e MUST NOT ver nenhuma tela de caso.

#### Scenario: CA4 · Entrar sem perfil
- **Dado** uma pessoa sem perfil atribuído
- **Quando** entra
- **Então** vê "sem perfil, fale com a gestão" e nenhuma tela de caso

### Requirement: CA5 · API sem sessão responde 401
Toda chamada à API sem sessão válida MUST receber 401 sem carregar dado; a proteção é do servidor, não da tela.

#### Scenario: CA5 · Chamada sem sessão
- **Dado** qualquer chamada à API sem sessão válida
- **Quando** chega ao servidor
- **Então** recebe 401 e nenhum dado é carregado; a proteção não depende da tela

### Requirement: CA6 · Só o hash da senha
A senha MUST ser guardada só como hash (bcrypt) e MUST NOT aparecer em log, e-mail ou resposta da API.

#### Scenario: CA6 · Guardar a senha
- **Dado** a senha cadastrada
- **Quando** é guardada
- **Então** fica só o hash (argon2 ou bcrypt); a senha nunca aparece em log, e-mail ou resposta da API

### Requirement: CA7 · Login e logout no histórico
Login e logout SHALL ficar no histórico com quem, quando e de onde (IP).

#### Scenario: CA7 · Entrar e sair
- **Dado** login e logout
- **Quando** acontecem
- **Então** ficam no histórico (quem, quando, de onde)
