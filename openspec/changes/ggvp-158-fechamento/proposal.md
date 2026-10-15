GGVP-158 · Fechamento do desenvolvimento: servidor, infra e integrações (Mateus) · história transversal, sem épico próprio. Atravessa a base, a Recepção, o INSS, a Justiça, o Desfecho e a IA, e tem change própria (decisão do Mateus, 11/10).

## Por quê

A auditoria de 11/10 (main `5a89f2f`, homologação, Jira e GitHub) listou o que falta no servidor, na infra e nas integrações para o portal ficar pronto pela definição de pronto: a Dona Maria do balcão ao dinheiro, com o login de cada perfil. Só entra o que não depende do Lucas. São cerca de 232 horas, em 9 partes.

## Histórias na ordem

Uma parte por vez, na ordem. Cada parte ganha spec e tarefas quando chegar a vez (`/opsx:update`), e cada pedido cita GGVP-158.

1. **Ligar o que está desligado na homologação:**
   - no código: o "simulado, não saiu" sem Chatwoot, o commit no /saude, os cabeçalhos de segurança, a produção que não sobe sem banco, as variáveis documentadas, os dados de teste dos recursos novos e os nomes de variável do ZapSign no kit;
   - fora do código, com o Mateus: o Chatwoot, o Gotenberg e o Drive no Coolify, os modelos do Word no portal e o preparo da homologação depois do merge.
2. **Segurança e processo do repositório:**
   - no código: o drizzle-orm atualizado, a regex lenta, `@ggv/campos` no CI, o erro sem SQL no log, a trava nas rotas sem trava, o `chamadaIaId` conferido contra o caso e o registro do que segue desligado;
   - fora do código, com o Mateus: o banco da homologação conferido, a main protegida (com o Pedro) e os falsos positivos do CodeQL.
3. Caminho da Maria no servidor real.
4. Recepção sem simulação.
5. Perícia, INSS e Justiça.
6. Desfecho, dinheiro e conversa.
7. Telas lidas do banco, acervo e importação. Ajuste do teste do Pedro (14/10): a confirmação da entrevista também vira linha da tabela de tarefas (P7.2).
8. Auditoria.
9. Produção, a parte que não depende do Lucas.
10. A história do sistema: a definição de pronto do portal escrita no repositório, passo a passo por perfil (pedido do Mateus, 15/10).

## Fora do escopo

- **Esperando o Lucas:** o "Fica de fora" do cartão.
- **Com o Pedro:** as telas (aqui, só o servidor) e a conversão dos modelos que vieram preenchidos (GGVP-159).
- **Apagar dado no banco da homologação:** a proposta sai daqui, e quem roda é o Mateus.

## Portões envolvidos

Nenhum novo. A trava de permissão em toda rota `/api` reforça que a interface não contorna portão (GGVP-109). Dado de saúde só para o Jurídico e o Sócio, e nenhum dado de cliente no log.
