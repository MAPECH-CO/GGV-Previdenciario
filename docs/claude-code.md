# Claude Code no terminal

Como cada dev roda o Claude Code na própria máquina, por que ele funciona assim, e o que ligar além do
repositório. Este arquivo é normativo: a wiki resume, aqui manda.

## Por que o clone é o contexto
O Claude Code roda dentro de um diretório e lê os arquivos do disco direto. Não existe conector para o
git, e não faz falta: o repositório já está na máquina. Ao iniciar, ele lê o `CLAUDE.md` da raiz sozinho,
e com ele vêm as regras do time, os ADRs, o BPMN e os requisitos.

A consequência prática é a que interessa: **o `CLAUDE.md` está versionado, então o `git pull` é a
sincronização**. Os quatro trabalham com a mesma regra sem ninguém copiar nada, e uma mudança de regra
entra por pull request como qualquer outra alteração.

## Pré-requisitos
- Acesso de escrita ao repositório `femezher/GGV-Prev-`.
- Conta própria do Claude com acesso ao Claude Code.
- `git` e, de preferência, o `gh` instalado, que facilita abrir o pull request pelo terminal.

## Passo a passo
```
git clone https://github.com/femezher/GGV-Prev-.git
cd GGV-Prev-
claude
```

A partir daqui o Claude Code enxerga todo o repositório e já está sob as regras do `CLAUDE.md`.

Para confirmar que funcionou, vale pedir dentro da sessão algo cuja resposta só existe no repositório,
como o que a Definition of Done exige antes de uma história contar na sprint. Se vierem os itens de
`docs/scrum/definition-of-done.md`, o contexto carregou. Se a resposta for genérica, o diretório está errado.

## Os dois níveis de CLAUDE.md
| Onde | O que é | Quem vê |
|---|---|---|
| `CLAUDE.md` na raiz do repositório | regra do time, versionada, muda por pull request | os quatro |
| `~/.claude/CLAUDE.md` | preferência pessoal, como idioma de resposta ou atalho | só quem configurou |

Regra de projeto nunca vai no arquivo pessoal. Se for, volta a existir uma regra que só uma pessoa tem, e
o combinado deixa de valer para o time.

## O conector do Jira
O repositório está no disco, o cartão do Jira não. É por isso que **o Jira é o único que merece conector**
no Claude Code. Com ele, dá para ler a história, os critérios de aceite e os comentários sem sair do
terminal, e é o que faz valer a regra de que a história é o prompt.

Ligar o conector do Atlassian apontando para `mapech.atlassian.net`, autenticando com a conta própria.
A autenticação é individual: cada pessoa vê apenas o que a própria conta do Jira já podia ver.

GitHub não precisa de conector enquanto existir o clone. O `gh` cobre o que falta na hora do pull request.

## Uma história, do início ao fim
1. Ler a história no Jira, pelo conector ou pelo navegador.
2. `git checkout main && git pull`.
3. Criar a branch com a chave: `git checkout -b feat/GGVP-27-protocolar-no-meu-inss`. O item vai sozinho para Em desenvolvimento.
4. Rodar `claude` na raiz do repositório e trabalhar dentro do escopo da história.
5. Rodar typecheck, lint e testes antes de pedir revisão.
6. Abrir o pull request com a chave no título. O item vai para Em revisão.
7. Pedir revisão ao outro dev. Ninguém mescla o próprio PR.

## Duas histórias ao mesmo tempo
Nunca dois agentes na mesma pasta. Um sobrescreve o trabalho do outro, a branch mistura duas histórias e
o pull request fica impossível de revisar. Para trabalhar em paralelo, criar uma árvore separada:

```
git worktree add ../prev-GGVP-99 feat/GGVP-99-descricao
cd ../prev-GGVP-99
claude
```

Uma árvore por história, com um pull request cada.

## O que não fazer
- **Criar uma pasta só com o `CLAUDE.md`.** O agente fica com as regras e sem o material: não vê BPMN,
  ADR, requisito nem código.
- **Editar o `CLAUDE.md` fora de um pull request.** A regra passa a valer só numa máquina.
- **Rodar o Claude Code fora da raiz do repositório.** O contexto que ele carrega é o do diretório atual.
- **Usar o espelho do Drive como pasta de trabalho.** Ele é cópia de leitura e o histórico do git fica fora dele.
