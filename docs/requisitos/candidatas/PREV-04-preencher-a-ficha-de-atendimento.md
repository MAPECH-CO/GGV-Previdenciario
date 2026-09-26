# PREV-04 · Preencher a ficha de atendimento

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** cliente ou lead\
**quero** preencher uma ficha simples com meus dados, o benefício que procuro e a senha do gov.br\
**para** chegar à entrevista sem precisar repetir tudo.

**Passo BPMN:** `D1.05` · **Épico:** Recepção · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** cliente ou lead

## Critérios de aceite
1. **Dado** o link da ficha, **quando** abro no celular, **então** vejo uma pergunta por vez, com linguagem simples e letra grande.
2. **Dado** que digito a senha do gov.br, **quando** envio a ficha, **então** a senha vai para o cofre (T-08) e não aparece na ficha.
3. **Dado** que não sei a senha, **quando** marco "não sei", **então** a ficha é aceita e o caso segue com o alerta de senha (PREV-07).
4. **Dado** uma ficha enviada, **quando** o Jurídico abre o caso, **então** vê a ficha antes de o cliente entrar na sala.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: cliente ou lead. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "cliente ou lead".

## Dúvidas abertas (bloqueiam a DoR)
- A ficha é preenchida pelo cliente no celular dele, num tablet no balcão ou pelo Atendimento?
- Q4: A ficha de atendimento é preenchida pelo cliente (celular), no balcão (tablet) ou pelo Atendimento? O cliente terá algum acesso ao portal?

## Dúvidas respondidas pelo PO
- (vazio)
