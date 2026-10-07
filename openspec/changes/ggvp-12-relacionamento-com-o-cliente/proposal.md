GGVP-12 · Relacionamento com o cliente: a conversa com o lead ou o cliente (fluxo D5) e as mensagens ao cliente com segurança do contato.

## Por quê

O lead ainda não aceito e o cliente com o caso em análise ligam ou vêm ao escritório com dúvida ou informação nova. Hoje
isso se perde: ninguém grava, a ficha não muda e o combinado fica na memória de quem atendeu. O D5 do Miro pede a
conversa gravada com o aviso (G10), a IA que transcreve e marca o que mudou, a conferência na hora por quem conversou
(G14) e a pendência que vira tarefa com responsável. As mensagens ao cliente saem pelo Chatwoot, com modelo e registro,
e ninguém muda dado do cliente se passando por ele.

## Histórias na ordem

Grupo 1 · a conversa com o cliente (fluxo D5)

1. GGVP-76 · Registrar a conversa por telefone ou presencial · Atendimento ou advogada
2. GGVP-80 · Transcrever e identificar o que mudou · advogada responsável (e quem conversou)
3. GGVP-84 · Atualizar ficha e processo com desfazer · quem fez a conversa; a Sênior no histórico
4. GGVP-88 · Pendência da conversa vira tarefa · advogada responsável (e quem conversou)

Grupo 2 · mensagens e segurança do contato

5. GGVP-102 · Mensagens ao cliente com modelo e registro · Atendimento; Jurídico administrativo na perícia
6. GGVP-111 · Terceiro não se passa pelo cliente · Atendimento; Jurídico administrativo; Documentação

## Fora do escopo

- A página do processo (GGVP-86): o "Registrar contato com o cliente" dela abre a mesma janela desta change; aqui a
  conversa começa pelo card do cliente e pelas transcrições.
- O histórico geral do processo com exportação (GGVP-99, PR #18): as mudanças da conversa usam o histórico de exemplo.
- A régua geral de lembrete e escalonamento (GGVP-94): a pendência segue o laço da cobrança até ela existir.
- O Chatwoot de verdade, a OpenAI e o microfone: simulados no servidor de exemplo, com a ponta anotada no design.
- O cofre de verdade (GGVP-103) e o chat que cria tarefa fora do D5 (GGVP-82).

## Travadas

- Nenhuma: as seis estão em "Refinada", sem dúvida aberta.

## Portões envolvidos

- G9: a senha do gov.br nunca entra na transcrição nem em campo de texto; vai ao cofre.
- G10: a conversa gravada começa com o aviso de gravação, com a hora guardada.
- G14: a IA só muda o que foi dito; o valor antigo fica no histórico e a Sênior volta a versão.
- G8: o aviso de resultado favorável só sai depois do OK da advogada (GGVP-102, GGVP-111).
- G11 e G20: as mensagens da perícia não orientam a esconder a situação nem sugerem diagnóstico ou CID.
