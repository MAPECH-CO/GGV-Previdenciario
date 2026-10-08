# Spec Delta · ggvp-18 · Liberar o caso ao Jurídico

## Purpose

A Documentação · ADM confere a documentação e aperta OK para liberar ao Jurídico o caso com o checklist completo. O caso entra na fila de conferência da sênior (D2). Ela trabalha na Central do Atendimento, onde aparece a tarefa "Liberar ao Jurídico". Telas do Figma: step_D1.24 `10:264` (com as dicas `2306:184` e `2306:716`), Central de trabalho · Sênior `59:609`, Overlay · Histórico do processo `59:11`, página do processo `72:2`, Overlay · Parecer médico `1654:2` e Central de trabalho · Atendimento `11:2`. Passo D1.24 do Miro. CA3 é \[v2\] (dispensa do parecer por duas sêniores, GGVP-33) e fica fora. O parecer médico é registro da GGVP-20: até ela existir, vem do servidor de exemplo. A página e o histórico do processo são da GGVP-86: até lá, o registro fica no histórico da ficha. Benefícios que pedem parecer: a matriz de `docs/requisitos/roteiro-laudos.md`.

Contrato: tipos em `apps/web/src/regras/liberacao.ts` (`Perfil`, `Parecer`) e `apps/web/src/dados/liberacao.ts` (`CasoParaLiberar`, `PedidoDeLiberacao`, `Liberacao`). Endpoints de quando ligar no servidor:

| Endpoint | Função de exemplo |
|---|---|
| `GET /api/processos/:id/liberacao` | `obterLiberacao` |
| `POST /api/processos/:id/liberacao` | `liberarAoJuridico` |

## ADDED Requirements

### Requirement: CA1 · O OK leva o caso à fila da sênior
Com o checklist completo, quando a Documentação aperta OK, o caso SHALL ir para a fila da sênior em D2: a Central da Advogada mostra "Conferir antes do INSS", liberado pela Documentação.

#### Scenario: CA1 · Liberar
- **Dado** o checklist completo
- **Quando** a Documentação aperta OK
- **Então** o caso vai para a fila do sênior em D2

### Requirement: CA2 · Incompleto não libera e mostra o que falta (G1)
Com o checklist incompleto, a liberação MUST ser recusada, e a tela SHALL mostrar o que falta.

#### Scenario: CA2 · Tentar liberar incompleto
- **Dado** o checklist incompleto
- **Quando** tento liberar
- **Então** não consigo e vejo o que falta (G1)

### Requirement: CA4 · Só a Documentação · ADM aperta OK
Para outro perfil, a ação MUST NOT aparecer: ele vê só a situação do caso. A tentativa por outro caminho MUST ser recusada no servidor e registrada no histórico.

#### Scenario: CA4 · Outro perfil
- **Dado** um caso pronto para liberar
- **Quando** alguém de outro perfil tenta apertar OK
- **Então** a ação não aparece para ele, que vê só o status, e a tentativa por outro caminho é recusada no servidor e registrada

### Requirement: CA5 · Sem OK, o caso fica na fila com a idade em dias
O caso que a Documentação ainda não liberou, cliente novo ou antigo, SHALL continuar na fila dela, com a idade em dias à vista.

#### Scenario: CA5 · Ainda não liberado
- **Dado** um caso que a Documentação ainda não liberou, cliente novo ou antigo
- **Quando** ela não aperta OK
- **Então** o caso continua na fila da Documentação, com a idade em dias à vista

### Requirement: CA6 · Quem liberou e quando, no histórico
Liberado o caso, SHALL ficar registrado quem liberou e quando, e o histórico SHALL mostrar "Caso liberado ao Jurídico pela Documentação".

#### Scenario: CA6 · Depois do OK
- **Dado** o OK apertado
- **Quando** o caso entra na fila do Jurídico
- **Então** ficam registrados quem liberou e quando, e o histórico mostra "Caso liberado ao Jurídico pela Documentação"

### Requirement: CA7 · Os três itens de conferência
"Liberar ao Jurídico" MUST ficar desabilitado até os três itens de conferência estarem marcados: o checklist do benefício completo (G1), o parecer médico "Suficiente" (G17) e as assinaturas e datas preenchidas. O parecer é registro, e a pessoa não marca. No benefício fora da matriz de laudos, o parecer não se aplica. O servidor confere de novo.

#### Scenario: CA7 · Conferir antes do OK
- **Dado** a tela de liberação
- **Quando** a Documentação vai apertar OK
- **Então** "Liberar ao Jurídico" só habilita com os três itens de conferência marcados
