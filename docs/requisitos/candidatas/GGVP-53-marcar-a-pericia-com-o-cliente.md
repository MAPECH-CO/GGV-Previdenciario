# GGVP-53 · Marcar a perícia com o cliente

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-53](https://mapech.atlassian.net/browse/GGVP-53), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-53. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Jurídico administrativo (estagiário ou assistente jurídico)\
**quero** marcar a perícia no portal do INSS, tentando de novo se não der, e subir o comprovante em PDF no card do cliente\
**para** o cliente ir à perícia.

**Passo BPMN:** `DP.02`, `DP.04` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Jurídico administrativo (estagiário ou assistente jurídico)

## Critérios de aceite
1. **Dado** a tarefa de perícia, **quando** não consigo marcar, **então** registro a tentativa e a tarefa continua comigo (GGVP-94).
2. **Dado** a perícia marcada, **quando** subo o comprovante do INSS (PDF) no card do cliente, **então** o sistema lê data, hora, local e tipo da perícia (o perito não vem no PDF) e agenda o lembrete da véspera para o cliente.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Jurídico administrativo. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Jurídico administrativo".

## Dúvidas abertas (bloqueiam a DoR)
- Q1: Limites e intervalos de cobrança, contato e remarcação ("a definir")

## Dúvidas respondidas pelo PO
- Ajuste de 29/09/2026 (Lucas): o executor passa do Atendimento para o Jurídico administrativo (estagiário ou assistente jurídico), que marca no portal do INSS e sobe o comprovante em PDF no card do cliente. O sistema lê data, hora, local e tipo (o PDF não traz o perito) e agenda o lembrete; ninguém mais coloca a data na ficha à mão.
