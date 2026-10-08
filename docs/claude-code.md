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
- Acesso de escrita ao repositório `MAPECH-CO/GGV-Previdenciario`.
- Conta própria do Claude com acesso ao Claude Code.
- `git`, Node 22 ou mais novo, e o `gh`, que o `/epico` usa para abrir o pull request.

## Passo a passo
Já tem o clone: `git switch main && git pull`. Não tem:
```
git clone https://github.com/MAPECH-CO/GGV-Previdenciario.git
cd GGV-Previdenciario
```
Depois, uma vez por máquina, o kit (`kit/LEIA-ME.md`):
```
kit\instalar.ps1        (Windows)
kit/instalar.sh         (Mac ou Linux)
```
Ele instala o OpenSpec, registra os plugins do projeto e confere as ferramentas. Se `.claude/settings.json`
não existir, copie `kit/modelos/settings.json` para lá e commite por PR.

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

## Um épico, do início ao fim
1. Na raiz do clone: `claude`.
2. `/epico <nome do épico>`. O Claude cria ou retoma a branch `feat/GGVP-6-...` e a change do épico em `openspec/changes/`.
3. Ele pega a primeira história do épico em "Refinada", põe seu nome no cartão, move para Em andamento e explica em 5 linhas o que vai fazer.
4. Faz, uma tarefa por vez, com teste. Ao terminar, roda as verificações e pergunta "Agora ok?". Peça ajustes até estar ok.
5. Escreva "ok": ele commita com a chave da história, sobe, abre (ou atualiza) o pull request do épico e move o cartão para Em análise. Já começa a próxima história.
6. Acabou o épico: ele marca o PR como pronto. O outro dev revisa. Ninguém mescla o próprio PR. O merge move as histórias para Em homologação; o Lucas testa e marca Aceita.

Sem história em "Refinada" o Claude não escreve código: diz quem revisa. Ele descontrolou: `kit/quando-descontrola.md`.

## Dois épicos ao mesmo tempo
Não. Um épico por pessoa por vez, e nunca dois agentes na mesma pasta: um sobrescreve o trabalho do outro e o
pull request fica impossível de revisar. Segunda sessão só para revisar o PR do outro dev, em outra árvore:

```
git worktree add ../prev-revisao feat/GGVP-8-via-administrativa
cd ../prev-revisao
claude
```

## O que não fazer
- **Criar uma pasta só com o `CLAUDE.md`.** O agente fica com as regras e sem o material: não vê BPMN,
  ADR, requisito nem código.
- **Editar o `CLAUDE.md` fora de um pull request.** A regra passa a valer só numa máquina.
- **Rodar o Claude Code fora da raiz do repositório.** O contexto que ele carrega é o do diretório atual.
- **Usar o espelho do Drive como pasta de trabalho.** Ele é cópia de leitura e o histórico do git fica fora dele.
