# PREV-18 · Ler e arquivar os documentos

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Documentação\
**quero** que todo documento que entra (scanner ou digital) seja lido pela IA, arquivado na pasta do cliente e tenha os dados extraídos (CPF, RG, endereço)\
**para** o caso ficar completo sem digitação.

**Passo BPMN:** `D1.18` · **Épico:** Documentos · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Documentação

## Critérios de aceite
1. **Dado** um documento em papel, **quando** passa no scanner, **então** sai com OCR (texto pesquisável) e vai para a pasta do cliente.
2. **Dado** um documento digital enviado pelo cliente, **quando** a Documentação sobe no card, **então** ele vai direto para a pasta, sem scanner.
3. **Dado** um documento lido, **quando** a IA extrai CPF, RG e endereço, **então** os campos aparecem no cadastro para conferência.
4. **Dado** um documento que é o contrato assinado, **quando** a leitura termina, **então** o caso segue para a verificação do contrato (PREV-19); se é outro documento, segue para o checklist (PREV-21).
5. **[v2]** **Dado** um documento médico, **quando** a leitura termina, **então** ele é classificado por tipo, data e emitente (PREV-67).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Documentação. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Documentação".

## Dúvidas abertas (bloqueiam a DoR)
- Q10: Onde ficam os arquivos: Drive (como no board) ou armazenamento do próprio portal?

## Dúvidas respondidas pelo PO
- (vazio)
