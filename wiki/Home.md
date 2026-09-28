# GGV Previdenciário — wiki

Portal operacional do escritório previdenciário da GGV, cliente da MAPECH. Esta wiki explica **como a equipe trabalha**, **o que vai ser construído** e traz o **BPMN** do escritório. O código e a documentação versionada ficam no [repositório](https://github.com/femezher/GGV-Prev-); o Jira `GGVP` é a fonte da verdade do que fazer; o [Miro](https://miro.com/app/board/uXjVHjbveV4=/) é a fonte do BPMN; o [Figma](https://www.figma.com/design/nHOPzl005CpWDXUWyVZIo6) é a fonte das telas.

> A wiki resume e dá o mapa. Onde houver conflito, mandam o repositório (regras e docs) e o Jira (backlog).

## Comece por aqui
- [[Como-trabalhar]] — papéis, eventos, Definition of Ready e Done, fluxo de uma história.
- [[Planejamento]] — onde estamos, Sprint 0, capacidade e plano de releases.
- [[Ferramentas]] — Jira, GitHub, Miro, Drive, Figma, Claude Teams e como se ligam.
- [[Claude-Code]] — como cada dev roda o Claude Code no clone.

## O produto
- [[Perfis-e-telas]] — o que cada função faz (extraído do BPMN) e o que a home dela mostra.
- [[Portoes-de-governanca]] — as 22 travas que nenhuma tela nem o chat contornam.
- [[Prototipo-Figma]] — o protótipo navegável e as decisões de interface.
- [[Backlog-Jira]] — épicos e histórias, por diagrama do BPMN.

## O processo do escritório (BPMN)
Vale sempre o frame "revisão BPMN" (o da direita) no [Miro](https://miro.com/app/board/uXjVHjbveV4=/). Transcrição:
- [[BPMN]] — visão geral e códigos dos passos.
- [[BPMN-D1]] Entrevista, benefício e documentos · [[BPMN-D2]] Via administrativa no INSS · [[BPMN-D3]] Judicialização
- [[BPMN-D3a]] Vigília e exigências do juiz · [[BPMN-D3b]] Desfecho do mérito
- [[BPMN-D4]] Diário e acervo (RAG) · [[BPMN-D5]] Conversa com lead ou cliente · [[BPMN-DP]] Perícia padrão

## Estudos
- [[Chatwoot-no-portal]] — como incorporar o Chatwoot ao portal (proposta ADR-015).

## Estado em 28/09/2026
BPMN revisado e transcrito; 15 épicos e 89 histórias no Jira `GGVP` (rótulo `a-validar-bpmn`); protótipo desktop no Figma revisado com o PO (Central por função, página completa do processo com barra de ações e popups por tarefa, cliente, novo cliente → reunião com transcrição, suporte, tema escuro e fonte maior, glossário dos códigos com fluxos numerados). BPMN numerado nos cartões do Miro em 28/09 (D5 a conferir). Sprint 0 de 28/09 a 02/10: refinar as candidatas, review do Figma com o escritório. Detalhe em [[Planejamento]].
