# Dados de teste na homologação (GGVP-126)

O comando prepara a homologação para o teste do Lucas. Ele cria:
- os usuários de exemplo, com senha provisória;
- os casos de exemplo de cada épico que já está na `main`;
- os limites de cobrança do escritório.

Só entra dado inventado.

## Quando rodar

Depois de a fila de PRs entrar na `main` e do deploy.
- O comando roda uma vez só: rodar de novo não grava nada e não troca senha.
- Se rodar antes da fila, os casos dos épicos que entrarem depois ficam de fora. Aí só recriando o banco da homologação.

## Como rodar

1. No Coolify, no app "ggv-prev-homologacao", crie a variável `AMBIENTE` com o valor `homologacao`. Ela existe só nesse app: o app de produção nunca a tem, e sem ela o comando recusa sem gravar nada.
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

## Login de cada pessoa do escritório (CA6)

Quando o Lucas mandar a lista com nome, e-mail e perfis, crie o login de cada pessoa com o `usuario:criar`:

```
pnpm --filter @ggv/api usuario:criar <email> "<nome>" <perfil,perfil>
```
