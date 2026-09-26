# GGVP-103 · Cofre de senhas do gov.br

> Candidata a história, diagrama **Histórias transversais**. Cartão no Jira: [GGVP-103](https://mapech.atlassian.net/browse/GGVP-103), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-103. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento ou Jurídico\
**quero** que a senha do gov.br do cliente vá para um cofre, venha ela da ficha, da entrevista ou de uma conversa\
**para** usar o acesso sem expor a senha.

**Passo BPMN:** D1.05, D1.08, D1.09, D5.02 · **Referência:** EXEMPLO-01 do repositório do Trabalhista, que nasceu das lacunas do Prev.\
**Perfil:** Atendimento ou Jurídico

## Critérios de aceite
1. **Dado** uma senha dita na entrevista ou na conversa gravada, **quando** a transcrição é gerada, **então** a senha não aparece no texto e vai para o cofre do cliente.
2. **Dado** uma senha no cofre, **quando** alguém com permissão clica em Revelar, **então** confirma a identidade, a senha fica visível por tempo limitado e a revelação fica no histórico.
3. **Dado** a IA ou o chat, **quando** pedem a senha, **então** o acesso é negado e fica registrado.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento ou Jurídico. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento ou Jurídico".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
