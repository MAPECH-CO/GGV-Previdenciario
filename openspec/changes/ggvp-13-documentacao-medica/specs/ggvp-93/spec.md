# Spec Delta · ggvp-93 · Roteiro de conteúdo mínimo por benefício, configurável e versionado

## Purpose

A sênior mantém no portal, por benefício, o que precisa ser demonstrado: os itens obrigatórios, as contradições que bloqueiam e os documentos complementares. A análise da IA e a conferência humana seguem essa régua, e não a memória de cada um. Editar: sênior. Ver: Jurídico. Atendimento e Documentação veem só a lista do que falta pedir, no parecer (GGVP-20). Passo D1.21M do Miro. Figma: não há quadro de configuração; o roteiro aparece aplicado no Overlay · Parecer médico `1654:2` e no step_D1.21M `14:195`. Semente: a matriz de `docs/requisitos/roteiro-laudos.md` e a resposta do Lucas de 01/10 (Q18).

Contrato e endpoints na `design.md`, seção GGVP-93.

## ADDED Requirements

### Requirement: CA1 · Cada item com o tipo e o texto do escritório
Para um benefício da matriz, o roteiro SHALL mostrar cada item com o tipo (obrigatório, contradição que bloqueia, complementar) e o texto do escritório.

#### Scenario: CA1 · Abrir o roteiro
- **Dado** um benefício da matriz de `docs/requisitos/roteiro-laudos.md`
- **Quando** abro o roteiro
- **Então** vejo cada item com o tipo (obrigatório, contradição que bloqueia, complementar) e o texto do escritório

### Requirement: CA2 · Editar cria nova versão; o caso analisado guarda a sua
Salvar a edição SHALL criar uma nova versão com autor e data, sem apagar a anterior. Os casos já analisados MUST continuar mostrando a versão usada na análise deles. Só a sênior edita.

#### Scenario: CA2 · Salvar a edição
- **Dado** que edito um item
- **Quando** salvo
- **Então** nasce uma nova versão com autor e data, e os casos já analisados continuam mostrando a versão usada na análise deles

### Requirement: CA3 · Benefício sem roteiro pede conferência manual
Para um benefício sem roteiro cadastrado, quando o caso chega à análise, o portal SHALL avisar "benefício sem roteiro" e MUST exigir a conferência manual da advogada.

#### Scenario: CA3 · Caso de benefício sem roteiro
- **Dado** um benefício sem roteiro cadastrado
- **Quando** um caso desse benefício chega à análise
- **Então** o portal avisa "benefício sem roteiro" e exige a conferência manual da advogada

### Requirement: CA4 · A comparação do laudo novo usa o roteiro em vigor
Quando a IA compara um laudo novo com o que já está no processo, ela SHALL usar o roteiro em vigor do benefício, e o parecer refeito SHALL registrar a versão usada.

#### Scenario: CA4 · Laudo novo
- **Dado** um laudo novo
- **Quando** a IA o compara com o que já está no processo (`D1.21M`)
- **Então** usa o roteiro em vigor do benefício, e o parecer refeito registra a versão usada
