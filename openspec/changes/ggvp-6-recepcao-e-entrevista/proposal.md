# GGVP-6 · Recepção e entrevista · passos BPMN: D1.01 a D1.13 · perfis: Atendimento e advogada responsável

## Por quê

A pessoa chega ao escritório, é reconhecida no balcão, marca e faz a entrevista, e sai com o benefício definido. Hoje isso vive no papel e no Airtable. O épico leva esse caminho para o portal, tela por tela, fiel ao Figma (`nHOPzl005CpWDXUWyVZIo6`, página "Desktop · Central de trabalho (simulação)") e ao frame D1 do Miro.

## O que muda

Uma história por vez, nesta ordem (fluxo D1 do Miro, decisão do Pedro em 05/10, no lugar da lista de `kit/entrega-09-10.md`). Só entram as que estão em "Refinada"; a que for refinada depois entra no lugar dela.

1. GGVP-16 · Reconhecer quem chegou e para quê
2. GGVP-17 · Receber documento entregue no balcão
3. GGVP-123 · Marcar a entrevista e a agenda
4. GGVP-21 · Confirmar o agendamento do lead
5. GGVP-24 · Preencher a ficha de atendimento
6. GGVP-32 · Preparar a conversa lendo a ficha
7. GGVP-28 · Segunda ficha para auxílio acidentário
8. GGVP-36 · Renovar a senha do gov.br antes da entrevista
9. GGVP-40 · Entrevistar com gravação
10. GGVP-46 · Transcrever a entrevista
11. GGVP-43 · Cadastrar o lead depois da entrevista
12. GGVP-51 · Definir o benefício com apoio do acervo
13. GGVP-57 · Calcular tempo e pontos sobre o CNIS
14. GGVP-60 · Registrar por que não virou cliente e recontatar
15. GGVP-124 · Nova demanda de quem já é cliente

Cada história ganha uma spec em `specs/ggvp-n/spec.md` e uma seção no `tasks.md`.

## Fora do escopo

- Servidor, banco e implantação: Supabase e Coolify são do Mateus (GGVP-2, GGVP-118). Aqui só tela, sobre dados de exemplo em `apps/web/src/dados/`. Cada história deixa aberta a tarefa "ligar no servidor".
- Serviço de fora (Google Drive, Chatwoot, OpenAI, n8n, scanner, ViaCEP): simulado na tela, sem chamada de verdade.
- A base das telas (GGVP-120), já em "Em análise": esta change usa, não refaz.

## Portões envolvidos

- G3 (benefício citado pela advogada vale mais que a sugestão), G9 (senha do gov.br só no cofre), G10 (aviso de gravação), G16 (motivo de não virar cliente), G19 (número por código com teste). Cada spec diz o seu.

## Travas

- Histórias em "Tarefas pendentes" esperam o Lucas: 21, 24, 28, 32, 36, 40, 46, 57, 60.
