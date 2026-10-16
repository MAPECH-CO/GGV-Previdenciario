# O portal antigo no portal novo: o importador do legado

Pedido do Mateus em 16/10/2026: tirar os dados de exemplo da homologação e pôr os clientes e processos de verdade do
portal antigo, mantendo os logins de exemplo, para a equipe ver a lógica do portal novo com dados reais.

## De onde vem

O projeto "Portal Operacional" do Supabase guarda o portal antigo em dois schemas:

- `zz_backup_operational`: a exportação do Airtable de 20/08/2025. Clientes, processos, benefícios de cada processo,
  requerimentos ao INSS, agenda (perícias, visitas, CadÚnico, audiências), movimentações e captações.
- `juridico`: a versão limpa de 22/08/2025, só clientes, com o status mais novo e o código `CLI-nnnn`. Não tem processo.

O importador liga os dois: cada linha do `juridico` acha as do backup pelo CPF; sem CPF que bata, pelo nome.

## Quem entra

Só o cliente aceito (decisão do Mateus, 16/10: "pega somente os aceitos"). Quem está no `juridico` entra pelo status de lá
(`ACEITO`); quem só está no backup, pelo status do Airtable (`Aceito`). Quando os dois discordam, o `juridico` manda, por
ser o mais novo. Os processos, benefícios, decisões do INSS, perícias e movimentações de quem entra vão junto. Quem não
entra não deixa rastro: nem nome, nem contagem com nome. O relatório conta quantos ficaram fora, por status.

## O que vira o quê

| Portal antigo | Portal novo |
| --- | --- |
| cliente (juridico + backup) | `pessoa`, situação `cliente`, origem = fonte da captação |
| processo | `caso`: benefício pelo catálogo, fase e desfecho pelo status geral |
| número CNJ válido | `identificador_caso` tipo `cnj` (só dígitos) |
| protocolo do requerimento | `identificador_caso` tipo `protocolo_inss` |
| requerimento concedido ou indeferido | `resultado_inss`, com a data da decisão |
| perícia médica, avaliação social | `pericia`, já marcada, com o comparecimento e o resultado que havia |
| movimentação, visita, CadÚnico, audiência | `evento_auditoria`, ação `legado_...`, assinada pelo sistema |

Cada campo passa pela biblioteca `campos` (CPF, telefone, CEP, e-mail, data, CNJ): o que não vale fica nulo e é contado
no relatório, nunca gravado torto. Sem status geral, a fase vem do resultado do benefício, da última movimentação, da
etapa, e por fim do CNJ; o relatório conta quantas foram deduzidas. O benefício que o catálogo não tem entra como
"outro", e o nome antigo aparece no relatório para o Lucas decidir se vira benefício do catálogo.

Os ids são derivados da chave antiga: rodar de novo gera os mesmos ids. A carga grava com `on conflict do nothing`, e os
eventos do histórico, que o banco não deixa apagar, não duplicam.

## O que fica de fora, e por quê

- As senhas do gov.br do portal antigo (`acessos_gov.senha`): senha só entra pelo cofre, com a chave que só o Coolify
  tem. Nunca por SQL. Fica para um comando à parte, rodado no app, se o escritório quiser.
- Os leads e os não aceitos, por decisão do Mateus.
- O número de benefício (NB) e a vara do juízo como entidade: o portal antigo não os guardava de forma confiável.
- O acervo do Raio-X: entra pela tela do Raio-X, pela Sênior, com a conferência dela (G22). Depois, `ligar-acervo` liga
  cada processo do acervo ao caso importado pelo CNJ.

## Como rodar

Tudo no terminal do app de homologação (Coolify), nunca na máquina de ninguém com dado real, e nunca em produção.

```
pnpm --filter @ggv/api legado:importar extrair /tmp/legado.json
pnpm --filter @ggv/api legado:importar transformar /tmp/legado.json /tmp/carga.json
CONFIRMO_ZERAR_O_PORTAL=sim pnpm --filter @ggv/api legado:importar carregar /tmp/carga.json
pnpm --filter @ggv/api legado:importar ligar-acervo
```

- `extrair` lê o banco antigo pela `LEGADO_DATABASE_URL` (só leitura; nada é escrito lá).
- `transformar` aplica as regras e imprime o relatório, só com números.
- `carregar` zera as tabelas de dados do `public` e grava a carga, numa transação. Ficam os usuários (os logins de
  exemplo e os de verdade), as sessões, a configuração, os feriados, o glossário, os modelos, os kits, os roteiros e os
  registros que só crescem. Sem `CONFIRMO_ZERAR_O_PORTAL=sim`, recusa antes de tocar no banco.
- `sql /tmp/carga.json /tmp/carga.sql` gera o mesmo que o `carregar` faria, para aplicar no terminal do banco.

Os arquivos `.json` e `.sql` têm dado pessoal: ficam fora do repositório e somem depois da carga.

## A carga de 16/10/2026 na homologação

Feita pelo Claude Code, a pedido do Mateus, com o importador deste documento. O relatório com os números está no PR da
GGVP-163. Cuidado com o `homologacao:preparar`: rodado de novo, ele põe de volta os peritos de exemplo
(`semearRecursosNovos`); os clientes e casos de exemplo não voltam, porque os usuários de exemplo já existem.
