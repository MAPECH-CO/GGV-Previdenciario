GGVP-158 · Fechamento do desenvolvimento: servidor, infra e integrações (Mateus) · história transversal, sem épico próprio. Atravessa a base, a Recepção, o INSS, a Justiça, o Desfecho e a IA, por isso tem uma change só dela (decisão do Mateus, 11/10).

## Por quê

A auditoria de 11/10 (main `5a89f2f`, homologação, Jira e GitHub) listou o que falta no servidor, na infra e nas integrações para o portal ficar pronto pela definição de pronto: a Dona Maria do balcão ao dinheiro, com o login de cada perfil. Só entra o que não depende do Lucas. São cerca de 232 horas, em 9 partes.

## Histórias na ordem

Uma parte por vez, na ordem. Cada parte ganha spec e tarefas quando chegar a vez (`/opsx:update`), e cada pedido cita GGVP-158.

1. **Ligar o que está desligado na homologação**, agora só o código:
   - o "simulado, não saiu" sem Chatwoot;
   - o commit no /saude;
   - os cabeçalhos de segurança;
   - a produção que não sobe sem banco;
   - as variáveis documentadas;
   - os dados de teste dos recursos novos.
2. **Segurança e processo do repositório**, agora só o código:
   - o drizzle-orm atualizado e a regex lenta;
   - `@ggv/campos` no CI;
   - o erro sem SQL no log;
   - a trava nas rotas sem trava;
   - o `chamadaIaId` conferido contra o caso;
   - o registro do que segue desligado.
3. Caminho da Maria no servidor real.
4. Recepção sem simulação.
5. Perícia, INSS e Justiça.
6. Desfecho, dinheiro e conversa.
7. Telas lidas do banco, acervo e importação.
8. Auditoria.
9. Produção, a parte que não depende do Lucas.

## Fora do escopo

- **Com o Mateus, depois:**
  - no Coolify: o Chatwoot, o Gotenberg e o Drive só leitura;
  - o `modelos:subir`;
  - a conferência do banco da homologação;
  - a proteção da main, com o Pedro;
  - os falsos positivos do CodeQL.
- **Esperando o Lucas:** o "Fica de fora" do cartão.
- **Telas do Pedro:** aqui, só o servidor.

## Portões envolvidos

Nenhum novo. A trava de permissão em toda rota `/api` reforça que a interface não contorna portão (GGVP-109). Dado de saúde só para o Jurídico e o Sócio, e nenhum dado de cliente no log.
