# Spec Delta · ggvp-158-fluxo-e-permissoes

## Purpose

Fechamento do desenvolvimento (GGVP-158), frente de 15/10: o que a varredura do caminho da Maria e das permissões por perfil achou de errado no fluxo (tarefa na fila errada, passo que outro perfil faz) e no acesso (dado que vaza, tela sem trava). Um requisito por erro corrigido; o que espera decisão fica na proposta.

## ADDED Requirements

### Requirement: E1 · As publicações do processo são de quem abre o processo
A leitura de uma publicação (o texto inteiro) e a lista de publicações de um caso (o trecho) SHALL ser servidas só a quem abre o processo (`processo.abrir`: Jurídico e Sócio), na API e na tela. A leitura de uma publicação de mérito SHALL ficar registrada como acesso a dado de saúde.

#### Scenario: E1 · O Atendimento pede a publicação
- **Dado** uma publicação de mérito casada a um caso
- **Quando** o Atendimento, a líder ou a Documentação pede a publicação ou a lista do caso, pela API ou pelo endereço da tela
- **Então** a API responde 403 e a tela mostra "Sem permissão"

#### Scenario: E1 · A advogada lê a sentença
- **Dado** a mesma publicação
- **Quando** a advogada a pede
- **Então** recebe o texto, e a leitura fica no registro de acesso a dado de saúde

### Requirement: E2 · A cópia da Recepção não leva valores a quem não os vê
No `/api/recepcao`, o percentual de honorários e o acordo (entrada e parcelas) de cada contrato SHALL ir só a quem conduz o contrato (`contrato.conduzir`) ou vê valores (`valores.ver`). Os outros campos do contrato seguem para quem vê o caso.

#### Scenario: E2 · A Documentação abre a cópia
- **Dado** um contrato da Recepção com percentual e acordo
- **Quando** a Documentação, o Jurídico administrativo, a advogada ou a Sênior sincroniza a cópia
- **Então** o contrato vem sem o percentual e sem o acordo; para o Atendimento, a líder, o Financeiro e o Sócio, vem com eles

### Requirement: E3 · A escalada da confirmação da entrevista é tarefa da Sênior
Quando a confirmação da entrevista passa do limite de tentativas (G15), o servidor SHALL abrir "Confirmar agendamento" (D1.04) na fila da Sênior (`/api/tarefas` do perfil `senior`), com a tela da agenda; confirmada a entrevista, a linha SHALL fechar.

#### Scenario: E3 · Sem resposta no limite
- **Dado** o limite de 2 tentativas (parâmetro da Configuração) e uma segunda tentativa sem resposta
- **Quando** a Sênior abre a fila dela
- **Então** vê "Confirmar agendamento" do lead, urgente; **quando** alguém registra "confirmou", **então** a linha some

### Requirement: E4 · Depois de subir à Sênior, a confirmação não aceita tentativas
Com a confirmação já na Sênior, o servidor MUST recusar nova tentativa "sem resposta" do Atendimento com 409, como na cobrança (G15).

#### Scenario: E4 · Tentativa depois da escalada
- **Dado** a confirmação de um lead que já subiu à Sênior
- **Quando** o Atendimento registra outra tentativa sem resposta
- **Então** a API responde 409 e nada é gravado

### Requirement: E5 · "Olhei, sem novidade" é do Jurídico
Marcar as esperas de fora de um caso como olhadas no dia SHALL exigir `inss.registrar_resposta` (advogada, Sênior e Jurídico administrativo).

#### Scenario: E5 · O Financeiro tenta marcar
- **Dado** um caso esperando o INSS
- **Quando** o Financeiro, o Atendimento ou a Documentação chama a rota
- **Então** a API responde 403, e a linha urgente da advogada continua

### Requirement: E6 · A senha do cofre pela exigência só com a exigência aberta
Quem revela a senha do gov.br sem poder protocolar (a advogada e a Sênior, pela exigência do INSS) SHALL fazê-lo só com a tarefa de responder a exigência (D2.05r) aberta no caso. O Jurídico administrativo segue com qualquer tarefa do gov.br aberta.

#### Scenario: E6 · Advogada com só o protocolo aberto
- **Dado** um caso com "Protocolar no Meu INSS" aberto e sem exigência
- **Quando** a advogada pede a senha do cofre
- **Então** a API responde 403 e registra a recusa; com a exigência aberta, responde a senha

### Requirement: E7 · Tela de passo não abre sem a permissão
As telas de passo que não tinham trava (parecer, laudo novo, complemento, deficiência, checklist, liberação, perícia do caso e roteiros) SHALL exigir `caso.ver`; a dispensa do parecer SHALL exigir `caso.aprovar_para_inss`.

#### Scenario: E7 · O Financeiro abre pelo endereço
- **Dado** o Financeiro logado
- **Quando** abre `/casos/:id/parecer/dispensa` ou `/casos/:id/checklist` pelo endereço
- **Então** vê "Sem permissão" e a tela não pede nada ao servidor

### Requirement: E8 · O número de jurimetria escrito "dos/das" é barrado na peça
A trava do G22 SHALL barrar também "71% dos 34 laudos" e "71% · 24 dos 34 processos"; "acréscimo de 25%" e "25% dos honorários" seguem passando.

#### Scenario: E8 · Aprovar a versão com o número
- **Dado** uma versão da peça com "em 71% dos 34 laudos"
- **Quando** a advogada aprova
- **Então** a aprovação é recusada com a mensagem do G22

### Requirement: E9 · O Sócio lê o conteúdo médico na página da perícia
A página da perícia SHALL mostrar o conteúdo médico (laudo, leitura) a quem tem `dado_saude.ver_detalhe`, o Sócio incluído, como o servidor já entrega.

#### Scenario: E9 · O Sócio abre a perícia
- **Dado** uma perícia com laudo
- **Quando** o Sócio abre a página da perícia
- **Então** vê o laudo e a leitura, como a advogada

### Requirement: E10 · Conferir o checklist e o documento é da Documentação
A conferência do checklist (D1.21) e as decisões da conferência da leitura (arquivar, liberar da quarentena, mover, usar no cadastro; D1.18) SHALL exigir as ações novas `checklist.conferir` e `documento.conferir`, só da Documentação (matriz v35). A tela do checklist SHALL mostrar "Concluir a conferência" só a quem pode; o Atendimento segue abrindo a tela para as boas-vindas.

#### Scenario: E10 · O Atendimento confere
- **Dado** o Atendimento no checklist de um caso
- **Quando** chama a rota da conferência ou abre a tela
- **Então** a API responde 403, e a tela não mostra o botão de concluir; a Documentação conclui e o histórico diz quem

### Requirement: E11 · O papel assinado do caso do servidor conclui a assinatura na tela
No contrato do caso do servidor, a tela de colher assinatura SHALL mandar o contrato assinado digitalizado pela rota do contrato (`POST /api/processos/:id/contrato/digitalizacao`), que guarda o arquivo como documento do caso e o liga à assinatura. Com o arquivo ligado, "Concluir a assinatura" SHALL habilitar e concluir pela rota da assinatura em papel; sem o arquivo, segue desligado (G1).

#### Scenario: E11 · O Atendimento guarda o papel assinado e conclui
- **Dado** o contrato de um caso do servidor com o kit impresso
- **Quando** o Atendimento guarda o PDF ou a foto do contrato assinado e clica "Concluir a assinatura"
- **Então** o arquivo fica na pasta do cliente, ligado à assinatura, e o contrato segue para a leitura
