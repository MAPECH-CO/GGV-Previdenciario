# ADR-019 · A mensagem do WhatsApp entra no portal pelo webhook do Chatwoot, com um segredo no endereço

**Data:** 2026-10-13 · **Estado:** aceita · **Decidiu:** Mateus (MAPECH), na GGVP-158 (parte 6)

## Contexto
O portal já manda mensagem pelo Chatwoot (ADR-015), mas não sabia o que chegava.
- A mensagem do cliente pelo WhatsApp não entrava na conversa nem na ficha.
- A entrega e a leitura das mensagens do portal ficavam no status da hora do envio.
- O cartão da parte 6 pede que toda conversa vire texto na ficha de conversa, com a IA só apontando a mudança de dado e uma pessoa conferindo.

O Chatwoot avisa por webhook da conta: um POST com o JSON da mensagem a cada `message_created` e `message_updated`. Ele não assina o aviso nem deixa pôr cabeçalho próprio.

## Opções consideradas
1. **Perguntar ao Chatwoot de tempos em tempos.**
   - Nada público.
   - Atrasa, gasta a API à toa e perde a ordem das mensagens.
2. **O webhook numa rota pública com um segredo no endereço.**
   - O aviso chega na hora.
   - A trava é o segredo, já que o Chatwoot não assina.
3. **O webhook pelo n8n, que repassa ao portal.**
   - Mais uma peça para cair.
   - O segredo continua necessário entre o n8n e o portal.

## Decisão
A rota pública com o segredo no endereço (opção 2): `POST /api/chatwoot/entrada/<segredo>`.

**A trava:**
- O segredo vem de `CHATWOOT_WEBHOOK_SEGREDO` e é conferido em tempo constante. Sem a variável, ou com outro segredo, a rota responde 404.
- A rota não escreve no log (`logLevel: 'silent'`), nem a chegada do pedido: o endereço leva o segredo.
- É a única rota `/api`, além de entrar, sem sessão (`LIVRES`, em `sessao/rotas.ts`), e declara por quê (`config.semTrava`).
- Só valem a conta e a caixa do escritório (`CHATWOOT_CONTA`, `CHATWOOT_CAIXA`). Fora da produção, só os telefones de teste (`CHATWOOT_PERMITIDOS`), a mesma trava do envio.
- O corpo passa por um esquema que lê só o que o portal usa. O que não serve responde 200, para o Chatwoot não repetir.

**O que entra:**
- A mensagem do cliente e a resposta do escritório entram na conversa do WhatsApp da pessoa do telefone. O telefone vem da conversa (`meta.sender`); o celular sem o nono dígito volta com ele.
- Sem pessoa com o telefone, o lead nasce com o nome do contato. A resposta do escritório a um número sem ficha não cria lead.
- A conversa junta as mensagens até 30 minutos sem mensagem nova. Depois, ela fecha, a IA lê o texto (como a transcrição; sem a IA, com o motivo) e nasce a conferência do Atendimento.
- O que a IA apontou só muda a ficha depois da conferência da Sênior (P6.6). A senha mandada por mensagem sai do texto (G9).
- O anexo sem texto entra como "[anexo: veja no Chatwoot]".

**A entrega e a leitura:** o aviso de mudança traz a mensagem sem o status. O portal pergunta o status ao Chatwoot, só das mensagens que ele mandou (pelo id guardado no envio), e o status só anda para a frente.

## Consequências
- **Ligar é tarefa do Coolify e do Chatwoot:** a variável no app e o webhook da conta no Chatwoot, com o endereço `https://<portal>/api/chatwoot/entrada/<segredo>` e os eventos de mensagem criada e atualizada.
- **O segredo é segredo:** fica só no Coolify e no webhook do Chatwoot, nunca em arquivo do repositório. O portal não o registra, mas o proxy da hospedagem pode registrar o endereço. Se vazar, troca-se a variável e o webhook.
- **Áudio:** a mensagem de voz entra como anexo, sem o texto. A transcrição dela, pelo mesmo motor da conversa, fica para depois.
- **Volume:** uma mensagem por vez no servidor inteiro, para duas que chegam juntas não abrirem duas conversas. Por pessoa, se o volume pedir.
- **Formato do Chatwoot:** conferido no código do Chatwoot em 13/10. Se uma versão nova mudar o aviso, o esquema ignora o que não reconhece, e a mensagem não entra; o teste da rota mostra o formato esperado.
- Reversível por outro ADR: sem a variável, a rota some (404), e o portal volta a só enviar.
