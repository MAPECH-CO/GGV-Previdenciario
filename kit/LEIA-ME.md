# Kit de desenvolvimento · GGV Previdenciário

Para quem vai escrever código neste repositório com o Claude Code: Pedro, Mateus, ou quem entrar. Uma página. O resto está linkado.

## Instalar (uma vez por máquina, 10 minutos)

Já tem o clone? Puxe a versão atual:
```
git switch main && git pull
```
Não tem? `git clone https://github.com/femezher/GGV-Previdenciario.git`.

Depois, na raiz do repositório:
```
kit\instalar.ps1        (Windows)
kit/instalar.sh         (Mac ou Linux)
```
Instala o OpenSpec, registra os plugins do projeto e confere Node, git, gh e Claude Code. Rodar de novo não estraga nada. Ligue também o conector do Jira no Claude Code (`docs/claude-code.md`).

## Trabalhar (todo dia)

1. Na raiz do repositório: `claude`.
2. Digite `/epico` e o nome do seu épico. Exemplo: `/epico Recepção e entrevista`.
3. O Claude pega a primeira história "Refinada" do épico, explica em 5 linhas o que vai fazer, faz, testa e pergunta **"Agora ok?"**.
4. Teste na tela. Peça ajuste quantas vezes quiser; ele pergunta de novo a cada ajuste. Está bom: escreva **ok**.
5. Ele salva, sobe, move o cartão para "Em análise" e já começa a próxima história. Acabou o épico: ele marca o pull request como pronto e diz quem revisa.

Perdeu o fio: `/epico` sem nada mostra onde você está. Fim do dia sem "ok": ele guarda o que tem e retoma amanhã.

## O que o Claude faz por dentro

Você não precisa saber, mas está aqui: uma branch e um pull request por épico; uma change do OpenSpec por épico, com uma spec por história; tarefas de até 2 horas, cada uma com teste; biblioteca `campos` em todo formulário; portões validados no servidor; cartão do Jira movido pelo conector. Comandos em `.claude/commands/epico.md`.

## Como o cartão anda

Tarefas pendentes → **Refinada** (revisado, sem dúvida; o nome do revisor sai do cartão) → **Em andamento** (quem implementa põe o próprio nome) → **Em análise** (o commit da história subiu) → **Em homologação** (o PR do épico foi mesclado) → **Aceita** (Lucas testou). "Concluído" só em produção.

Só história em "Refinada" vira código. Cartão com dúvida aberta fica "Travada": o Claude diz a pergunta e quem responde.

## Comandos

Permitidos: `/epico`, `/ecc:code-review`, `/ecc:security-scan`, `/ecc:save-session`, `/ecc:resume-session`, `/ponytail`. Os `/opsx:*` do OpenSpec só o Claude usa, por dentro do `/epico`.

Proibidos neste repositório: `/ecc:orch-*`, `/ecc:multi-*`, `/ecc:team-*`, `/ecc:gan-*`, `/ecc:santa-loop`, `/ecc:loop-start`, `/agenthub:*`, `/autoresearch-agent:*`, e qualquer subagente que você não pediu. Se o Claude abrir um sozinho, Esc e "sem subagente".

## Regras que não se negociam

1. A história é o prompt. Fora dela, o Claude para e diz.
2. Só história em "Refinada" vira código.
3. Menor mudança que cumpre o critério. Sem abstração para uso futuro. Sem refatorar o que não pediu.
4. Campo de formulário usa a biblioteca `campos`. CPF, CEP, data, número, telefone, NB, CNJ. Nunca validação solta na tela.
5. Dúvida aberta no cartão não vira código. Pergunta a quem revisa.
6. Teste acompanha a tarefa. Saída do teste na tela, não "passou".
7. Um épico por pessoa por vez. Nunca duas sessões na mesma pasta.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Regras do repositório para o Claude | `CLAUDE.md` (seção "Como o Claude Code trabalha aqui") |
| O comando | `.claude/commands/epico.md` |
| Épicos, donos, ordem, prazos | `kit/entrega-09-10.md` |
| Plugins e permissões do projeto | `.claude/settings.json` |
| Lembrete de estado a cada prompt | `kit/hooks/estado.js` |
| Regras do OpenSpec | `openspec/config.yaml` |
| Biblioteca de campos | `kit/campos/` (vai para `packages/campos` na fundação) |
| O Claude descontrolou | `kit/quando-descontrola.md` |
| Cartões do Jira movidos pelo GitHub | `.github/workflows/jira.yml` |
| Revisão automática do PR | `.github/workflows/claude-review.yml` |
