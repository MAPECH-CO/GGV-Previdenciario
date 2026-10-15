GGVP-158 · Fechamento (Mateus) · integrações e IA: onde o portal diz que deu certo quando não deu, e onde a IA decide ou falha sem dizer. Change à parte da `ggvp-158-fechamento`, pedida pelo Mateus em 15/10, fora do `/epico`, com os subagentes da auditoria.

## Por quê

A auditoria de 15/10 (main `e49d510`, quatro subagentes e a conferência de cada achado no código) achou falso sucesso nas integrações e furos na regra "a IA sugere, a pessoa decide":

- a mensagem que não sai pelo Chatwoot e conta como enviada;
- a falha do Drive ou do armazenamento que vira "nada lá";
- a vigília que falha e parece um dia sem publicação (G13);
- a senha do gov.br que chega à IA (G9);
- o aviso de G22 que a tela descarta.

Cada erro corrigido é um requisito da spec, com teste.

## Histórias na ordem

Uma só, a GGVP-158, em seis grupos, um de cada vez:

1. **Chatwoot e mensagens** (I1 a I6) · Atendimento, Jurídico administrativo, Documentação.
2. **Drive, armazenamento e PDF** (I7 a I12) · Recepção, Documentação, Jurídico.
3. **Diário (DJEN e AASP)** (I13 a I19) · Sênior e suporte técnico.
4. **Tela sem resposta do servidor** (I20) · todos.
5. **IA** (A1 a A8) · Jurídico, Atendimento, Recepção.
6. **Eval da leitura** (A9) · Mateus.

## Travadas

Não viram código aqui: cada uma espera quem decide. A lista completa, com o porquê, está no design.

- **Lucas:**
  - o documento ou o áudio com dado de saúde que vai à IA porque o tipo anunciado não é médico;
  - as finalidades sem saúde que recebem texto de decisão;
  - o acervo marcado pela IA;
  - o contrato assinado que a IA dispensa da conferência (GGVP-85 CA1).
- **Pedro:**
  - o aviso da pendência do contrato pelo Chatwoot de verdade (modelo novo de mensagem);
  - o simulador do navegador que diz "entregue";
  - textos das telas na homologação.
- **Mateus:**
  - a fonte do diário desligada;
  - o tempo da rodada;
  - a concorrência no envio, que pede trava no banco;
  - o pacote com documento do scanner.

## Fora do escopo

- O fluxo de ponta a ponta e as permissões: outra sessão, na `fix/GGVP-158-fluxo-e-permissoes`. O que achamos de lá vai só no relatório.
- Chamada de verdade ao Chatwoot, ao Drive ou à IA: tudo com o fornecedor de mentira. A rodada do eval com a IA de verdade fica para o Mateus liberar.
- Variável nova, migração e dependência nova: nenhuma.

## Portões envolvidos

- **G9, G13, G14, G22:** reforçados no servidor e na tela.
- **G7:** a trava do protocolo deixa de bloquear por falha de leitura.
- **G3 a G6, G17 e G19:** conferidos sem achado novo; as rotas que decidem pedem a pessoa.
