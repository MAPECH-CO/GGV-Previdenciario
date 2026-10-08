# Spec Delta · ggvp-91 · Checklist de documentos obrigatórios do benefício

## Purpose

A Documentação vê o checklist do benefício do caso: o que chegou, o que falta e o que tem problema, além das assinaturas e das datas (G1). O sistema calcula "completo" ou "incompleto" a partir dos documentos classificados e arquivados na leitura (GGVP-81). A tela é "Conferir checklist", aberta pela Central do Atendimento depois que a leitura termina, ou pelo "Abrir o checklist" da conferência. Telas do Figma: step_D1.21 · Checklist do benefício e boas-vindas `1818:2`, step_D1.18 `10:466` e step_D1.24 `10:264`. Passo D1.21 do Miro. CA4 é \[v2\] e fica para a GGVP-20.

A lista de cada benefício é configuração do escritório (GGVP-104), com nomes da lista única de documentos (`TIPOS_DE_DOCUMENTO`). O portal nasce só com a do LOAS. Ela junta três fontes: o critério 7 deste cartão (ficha de grupo familiar e as três declarações condicionais), o que levar do LOAS do cartão GGVP-21 (RG e CPF de todos da casa, comprovante de renda e CadÚnico) e o comprovante de residência do Figma `10:466`. Os outros benefícios ficam sem lista até o escritório montar.

Contrato: tipos em `apps/web/src/regras/checklist.ts` (`ItemDoChecklist`, `Checklist`, `ListaDoBeneficio`) e `apps/web/src/dados/checklist.ts` (`ConferenciaDoChecklist`). Endpoints de quando ligar no servidor:

| Endpoint | Função de exemplo |
|---|---|
| `GET /api/processos/:id/checklist` | `obterChecklist` |
| `POST /api/processos/:id/checklist/conferencia` | `conferirChecklist` |
| `GET /api/configuracao/listas-de-documentos` | `LISTAS_DE_DOCUMENTOS` (exemplo) |

## ADDED Requirements

### Requirement: CA1 · Cada documento obrigatório com o status
Para um caso com benefício definido, o checklist SHALL mostrar cada documento obrigatório com o status recebido, pendente ou com problema.

#### Scenario: CA1 · Abrir o checklist
- **Dado** um caso com benefício definido
- **Quando** abro o checklist
- **Então** vejo cada documento obrigatório com o status recebido, pendente ou com problema

### Requirement: CA2 · Sem assinatura ou com data em branco fica pendente (G1)
Documento que a leitura apontou sem assinatura ou com data em branco MUST deixar o item pendente, com o motivo à vista. O contrato assinado também entra como item.

#### Scenario: CA2 · Declaração sem assinatura
- **Dado** um documento sem assinatura ou com data em branco
- **Quando** o checklist é conferido
- **Então** o item fica pendente (G1)

### Requirement: CA3 · Incompleto bloqueia a liberação, com a lista do que falta
Com o checklist incompleto, a liberação ao Jurídico MUST ficar bloqueada, mostrando a lista do que falta. Quem aperta o OK é a Documentação · ADM, no D1.24 (GGVP-18). Aqui fica a regra, com teste.

#### Scenario: CA3 · Tentar liberar incompleto
- **Dado** o checklist incompleto
- **Quando** alguém tenta liberar ao Jurídico
- **Então** a ação fica bloqueada com a lista do que falta

### Requirement: CA5 · "Completo" ou "incompleto" calculado dos documentos
A situação "completo" ou "incompleto" SHALL ser calculada pelo sistema a partir dos documentos classificados no caso e mostrada à Documentação. Documento em quarentena MUST NOT contar (GGVP-81, CA10).

#### Scenario: CA5 · Conferir o checklist
- **Dado** os documentos classificados no caso
- **Quando** o checklist é conferido
- **Então** a situação "completo" ou "incompleto" é calculada a partir deles e mostrada para a Documentação

### Requirement: CA6 · Benefício sem lista aprovada não libera
Benefício sem lista de documentos obrigatórios aprovada MUST NOT ser liberado, e a tela SHALL explicar o bloqueio.

#### Scenario: CA6 · Auxílio Acidentário sem lista
- **Dado** um benefício sem lista de documentos obrigatórios aprovada
- **Quando** alguém tenta liberar o caso
- **Então** não consegue, e a tela explica o bloqueio

### Requirement: CA7 · LOAS: ficha de grupo familiar e declarações condicionais
Em todo caso de LOAS, inclusive o mandado de segurança de LOAS, a ficha de grupo familiar SHALL entrar como obrigatória. As declarações de moradia, união estável e separação de fato SHALL entrar só quando a condição do caso pede.

#### Scenario: CA7 · LOAS com moradia em casa de outra pessoa
- **Dado** um caso de LOAS cuja condição pede a declaração de moradia
- **Quando** o checklist é montado
- **Então** a ficha de grupo familiar entra como obrigatória, a declaração de moradia entra, e as de união estável e separação de fato não

### Requirement: CA8 · Os documentos da entrevista entram junto
Os documentos que a IA listou a partir da entrevista e a advogada conferiu (GGVP-46) SHALL entrar no checklist, junto com os do benefício. Até a GGVP-46 existir, a lista conferida vem do servidor de exemplo.

#### Scenario: CA8 · Lista da entrevista
- **Dado** a lista de documentos que a IA montou a partir da entrevista e a advogada conferiu
- **Quando** o checklist é montado
- **Então** esses documentos entram nele, junto com os do benefício

### Requirement: CA9 · Documento pessoal que já está na pasta conta
Em processo novo de quem já é cliente (GGVP-124), os documentos pessoais que já estão na pasta do cliente SHALL contar como recebidos e MUST NOT ser pedidos de novo.

#### Scenario: CA9 · Segundo processo da mesma pessoa
- **Dado** um processo novo de quem já é cliente
- **Quando** o checklist é montado
- **Então** os documentos pessoais que já estão na pasta do cliente contam como recebidos e não são pedidos de novo

### Requirement: CA10 · A lista vem da configuração do escritório
A lista de documentos obrigatórios de cada benefício SHALL vir da configuração do escritório (GGVP-104), com nomes escolhidos da lista única de documentos, e MUST NOT estar presa no código da regra. O portal nasce com a lista do LOAS (CA7).

#### Scenario: CA10 · O escritório muda a lista
- **Dado** a lista de documentos obrigatórios de um benefício
- **Quando** o escritório a monta ou muda
- **Então** a regra do checklist usa a lista nova, sem mudar código
