# GGVP-69 · Preencher o contrato pelo modelo e conferir

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Cartão no Jira: [GGVP-69](https://mapech.atlassian.net/browse/GGVP-69), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-69. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** que a IA preencha o modelo com os dados do cliente e do processo e eu confira antes de mandar assinar\
**para** não haver campo errado no documento que o cliente assina.

**Passo BPMN:** `D1.16` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** o kit escolhido, **quando** peço o preenchimento, **então** o modelo vem com nome, estado civil, profissão, CPF, RG, endereço, telefone, benefício e parte contrária, e os dados do representante quando houver.
2. **Dado** o documento preenchido, **quando** confiro, **então** vejo a lista "O que conferir": datas feitas à mão, na ficha LOAS se é cliente ou representante legal, página do Código Penal sem assinatura.
3. **Dado** um campo errado, **quando** corrijo, **então** o documento é regerado antes de seguir.
4. **Dado** as datas que o BPMN manda deixar em branco, **quando** o documento é gerado, **então** elas saem em branco para preencher à mão na assinatura.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Dependências e referências
- Os Contratos Completos do INSS virarem modelo com campos `{{...}}` (`docs/requisitos/duvidas-abertas.md`).

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Q2: Os Contratos Completos do INSS ainda trazem dados de um cliente de exemplo. Quem converte cada um em modelo com campos `{{...}}`?

## Dúvidas respondidas pelo PO
- (vazio)
