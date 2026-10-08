# GGVP-13 · Garantia e governança · parte do Pedro: documentação médica · passos BPMN: D1.18, D1.21, D1.21M, D1.23, D1.24 · perfis: Documentação, Atendimento, advogada responsável e sênior

## Por quê

O caso de benefício por incapacidade ou deficiência só anda quando a prova médica cobre o que o benefício exige. Hoje isso fica na memória de cada advogada. O épico leva ao portal a régua do escritório (o roteiro de laudos), a leitura de cada documento médico, o parecer de suficiência que a IA sugere e uma pessoa confirma, o pedido de complemento ao médico e o portão que segura o caso sem parecer. Tudo fiel ao Figma (`nHOPzl005CpWDXUWyVZIo6`) e ao subfluxo D1.21M do Miro, e ligado às telas que a Recepção e a Abertura já fizeram.

## Histórias na ordem

Uma sessão, na pasta principal, na branch `feat/GGVP-13-documentacao-medica` (base: a Abertura, porque o parecer e o portão aparecem nas telas dela). Dois grupos, na ordem do fluxo D1.21M.

**Grupo 1**

1. GGVP-93 · Roteiro de conteúdo mínimo por benefício, configurável e versionado · sênior (edita), Jurídico (vê)
2. GGVP-95 · Classificar cada documento médico que entra · Documentação
3. GGVP-20 · Parecer de suficiência da documentação médica · advogada responsável
4. GGVP-29 · Pedir o complemento ao médico do cliente · Atendimento
5. GGVP-33 · Portão: sem parecer, o caso não anda · sênior

**Grupo 2**

6. GGVP-42 · Aposentadoria PCD: linha do tempo da deficiência · advogada responsável
7. GGVP-47 · Auxílio-Acidente: prova do acidente · Documentação
8. GGVP-50 · BPC/LOAS de menor de 16 anos · advogada responsável

Cada história ganha uma spec em `specs/ggvp-n/spec.md` e uma seção no `tasks.md`, no bloco do seu grupo.

## Fora do escopo

- Servidor, banco e implantação (Mateus). Aqui só tela, sobre o servidor de exemplo em `apps/web/src/dados/`. Cada história deixa aberta a tarefa "ligar no servidor".
- IA de verdade, Chatwoot, Drive e scanner: simulados na tela.
- A validação de todos os portões no servidor contra chamada direta (GGVP-109), o painel de indicadores (GGVP-75), a régua geral de cobrança (GGVP-94), o chat ligado ao servidor (GGVP-82) e as telas da sênior antes do INSS (D2.01) e do pedido de petição (D3.05), que são de outros épicos: aqui fica a regra do portão, com teste, pronta para elas.
- As regras numéricas da incapacidade temporária (15 dias, janela de 60 dias): GGVP-25.

## Portões envolvidos

- G1 (checklist completo), G15 (limite da cobrança), G17 (parecer "Suficiente" confirmado por pessoa; dispensa por duas sêniores, com justificativa), G18 (contradição bloqueia), G19 (número é código com teste) e G20 (orientação ao médico sem diagnóstico, CID, grau, conclusão nem frase pronta).

## Dúvida que segue aberta e não trava a tela

- Q17 (base legal e tempo de guarda do dado de saúde): o acesso por perfil já está nas telas; a regra de guarda é do servidor. Quem responde: Lucas.
