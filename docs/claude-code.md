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
- Acesso de escrita ao repositório `femezher/GGV-Previdenciario`.
- Conta própria do Claude com acesso ao Claude Code.
- `git`, Node 22 ou mais novo, e o `gh`, que o `/ok` usa para abrir o pull request.

## Passo a passo
Já tem o clone: `git switch main && git pull`. Não tem:
```
git clone https://github.com/femezher/GGV-Previdenciario.git
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

## Uma história, do início ao fim
1. `kit/verificar-historia GGVP-27`: diz se está livre ou quem está nela.
2. `kit/nova-historia GGVP-27`: puxa a `main`, cria `feat/GGVP-27-...` e abre o `claude`. O item vai sozinho para Em desenvolvimento.
3. No chat, `/historia GGVP-27`. O Claude lê a história e devolve `/opsx:propose "GGVP-27: ..."`. Cole. Leia os quatro arquivos que saem em `openspec/changes/`.
4. Suba o plano: `git add openspec && git commit -m "docs(spec): GGVP-27 proposta" && git push -u origin HEAD`.
5. `/opsx:apply`. Uma tarefa por vez, com teste. Ao terminar, o Claude roda as verificações e pergunta "Agora ok?". Peça ajustes até estar ok.
6. `/ok`: commita com a chave, sobe e abre o pull request com o template. O item vai para Em revisão.
7. O outro dev revisa. Ninguém mescla o próprio PR. Depois do merge e do "Aceita" do Lucas: `/opsx:archive`.

Sem change do OpenSpec o Claude não escreve código: responde com o comando do `propose`. Ele descontrolou: `kit/quando-descontrola.md`.

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
