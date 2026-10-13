# Dados de teste na homologação (GGVP-126)

O comando prepara a homologação para o teste do Lucas. Ele cria:
- os usuários de exemplo, com senha provisória;
- os casos de exemplo de cada épico que já está na `main`;
- os limites de cobrança do escritório.

Só entra dado inventado.

## Quando rodar

Depois de a fila de PRs entrar na `main` e do deploy.
- Os usuários e os casos entram uma vez só: rodar de novo não os grava de novo e não troca senha.
- Rodar de novo acrescenta só os exemplos dos recursos novos que faltarem (GGVP-158, abaixo). Rode depois de cada deploy que trouxer recurso novo.
- Se rodar antes da fila, os casos dos épicos que entrarem depois ficam de fora. Aí só recriando o banco da homologação.

## Como rodar

1. No Coolify, no app "ggv-prev-homologacao", crie a variável `AMBIENTE` com o valor `homologacao`. Esse valor existe só nesse app: o app de produção nunca o tem (lá é `producao`, que libera o Chatwoot para os clientes; ver `homologacao.md`), e sem ele o comando recusa sem gravar nada.
2. Faça o redeploy, para a variável valer.
3. No terminal do app (Coolify › app › Terminal), rode:

   ```
   pnpm --filter @ggv/api homologacao:preparar
   ```

4. A saída lista cada usuário, com o perfil e a senha provisória.
   - Ela aparece uma vez só.
   - Entregue as senhas ao Lucas por um canal fora do repositório, do Jira e do chat.
   - Cada pessoa troca a senha no primeiro acesso.
   - Se o comando terminar com erro depois da lista, nada foi gravado e essas senhas não valem. Rode de novo.
   - Se a lista se perder depois de um fim sem erro (terminal fechado, por exemplo), as senhas dos usuários de exemplo não têm como ser vistas de novo. Crie logins novos para o teste com o `usuario:criar` (abaixo), que mostra uma senha provisória nova.

## O que entra

- **Usuários:** os 12 usuários de exemplo, que cobrem os 8 perfis. A senha pública dos exemplos não vale na homologação.
- **Casos:** os de cada épico que já está na `main`. As telas que ainda gravam no navegador (Recepção, Abertura, documentação médica, Perícia e Relacionamento) ganham caso no banco quando forem ligadas ao servidor.
- **Configuração:** os limites de cobrança do Lucas, 2 tentativas com 3 dias entre elas. O que o escritório já tinha configurado fica como está.
- **Recursos novos (GGVP-158):** o que só o servidor cria e o roteiro do teste abre. Entram também numa homologação já preparada.
  - Os peritos "Dr. A. Prado (exemplo)", "Dr. R. Menezes (exemplo)" e "Sra. L. Assis (exemplo)", com o perfil formado dos laudos. São os mesmos da tela. Onde abrir: na perícia do servidor, ao registrar o perito (a orientação sai pelo perfil dele).
  - Os entendimentos do JEF de São Paulo ("TRF3 · 6301"), o juízo dos processos judiciais de exemplo. Onde abrir: no "Juízo identificado" do processo, como Jurídico.
  - A "Reunião da equipe: os casos da semana (exemplo)" na agenda, no dia seguinte ao preparo, às 9h.
- **Não entram como exemplo:** o contrato da Recepção, a leitura do documento, o checklist, as boas-vindas, a cobrança e a perícia do servidor.
  - Nascem no próprio roteiro, no lead novo do balcão (do cadastro à cópia do contrato) e na perícia que a advogada decide.
  - O kit do contrato só sai depois que os modelos do Word sobem na homologação (`modelos:subir`).

## Login de cada pessoa do escritório (CA6)

Quando o Lucas mandar a lista com nome, e-mail e perfis, crie o login de cada pessoa com o `usuario:criar`:

```
pnpm --filter @ggv/api usuario:criar <email> "<nome>" <perfil,perfil>
```
