# Spec Delta · ggvp-126

## Purpose

Homologação com usuários e dados de teste. Um comando prepara a homologação com a mesma semente dos testes: usuários de teste com senha provisória, os casos de exemplo e os limites de cobrança do Lucas. Só dado inventado, e nunca em produção.
- **Quem roda:** quem cuida da homologação, no terminal do app no Coolify.
- **O que entra:**
  - os usuários de exemplo, um ou mais por perfil;
  - os casos de exemplo de cada épico que já está na `main`;
  - a configuração do escritório.
- **Fica para quando o Lucas mandar a lista:** o login de cada pessoa do escritório (CA6), com o `usuario:criar` da GGVP-117.

## ADDED Requirements

### Requirement: CA1 · Um usuário de teste por perfil, com senha provisória
O comando SHALL deixar ao menos um usuário de teste por perfil: Atendimento, líder, Documentação, Advogada, Sênior, Jurídico administrativo, Financeiro e Sócio.
- Cada um MUST ter a sua senha provisória, com troca no primeiro acesso. Ela aparece uma vez para quem rodou o comando e é entregue fora do repositório.
- A senha pública dos exemplos MUST NOT valer na homologação.

#### Scenario: CA1 · Homologação nova
- **Dado** a homologação nova
- **Quando** o comando de preparação roda
- **Então** existe um usuário de teste por perfil (Atendimento, líder, Documentação, Advogada, Sênior, Jurídico administrativo, Financeiro, Sócio), com senha provisória entregue fora do repositório

### Requirement: CA2 · Limites de cobrança do Lucas
O comando SHALL gravar os limites de cobrança que o Lucas definiu em 05/10 e 07/10: 2 tentativas, com 3 dias entre elas.
- O que já estiver configurado fica como está.
- Sem configuração, o servidor MUST usar os mesmos limites, e o portão G15 nunca fica desligado.

#### Scenario: CA2 · Configuração do escritório
- **Dado** a configuração do escritório
- **Quando** o comando roda
- **Então** os limites de cobrança são os que o Lucas definiu (2 tentativas, 3 dias entre elas, em 05/10 e 07/10), e o servidor nunca deixa o portão G15 desligado por falta de configuração

### Requirement: CA3 · Um caso inventado em cada passo pronto
O comando SHALL rodar a mesma semente dos testes, que cada épico estende com os seus casos de exemplo. Cada passo pronto no servidor quando o comando roda MUST ter ao menos um caso inventado parado nele.

#### Scenario: CA3 · Passos prontos
- **Dado** cada passo pronto (Recepção, Abertura, documentação médica, Perícia, Relacionamento, INSS e Justiça)
- **Quando** o comando roda
- **Então** há ao menos um caso inventado parado nele

### Requirement: CA4 · Rodar de novo não duplica
Rodar o comando de novo MUST NOT duplicar usuário, caso ou configuração, nem trocar a senha já entregue.

#### Scenario: CA4 · Duas vezes
- **Dado** o comando
- **Quando** roda duas vezes
- **Então** não duplica nada

### Requirement: CA5 · Nunca em produção
Fora da homologação, o comando MUST recusar sem gravar nada. Ele só roda com `AMBIENTE=homologacao`, variável que existe só no app de homologação do Coolify.

#### Scenario: CA5 · Produção
- **Dado** o ambiente de produção
- **Quando** alguém tenta rodar o comando de dados de teste
- **Então** ele recusa
