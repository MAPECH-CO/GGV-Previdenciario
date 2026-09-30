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
Instala o OpenSpec, registra os plugins do projeto e confere Node, git, gh e Claude Code. Rodar de novo não estraga nada.

## Uma história, do início ao fim

1. **Confira a fila.** `kit/verificar-historia GGVP-27`. Responde "livre" ou quem está nela. Cartão do Jira sem responsável e em "Pronta" é o outro sinal.
2. **Abra a branch.** `kit/nova-historia GGVP-27`. Puxa a `main`, cria `feat/GGVP-27-...`, abre o `claude`. O Action move o cartão para "Em desenvolvimento".
3. **Peça o plano.** No chat: `/historia GGVP-27`. O Claude lê a história, confere travas e devolve o comando. Cole: `/opsx:propose "GGVP-27: ..."`. Saem proposta, spec, design com o contrato e `tasks.md`. Leia os quatro.
4. **Suba o plano.** `git add openspec && git commit -m "docs(spec): GGVP-27 proposta" && git push -u origin HEAD`. A partir daqui o outro dev vê que a história tem dono.
5. **Execute.** `/opsx:apply`. Uma tarefa por vez, com teste. Ao terminar, o Claude roda as verificações e pergunta **"Agora ok?"**. Peça ajustes até estar ok. Ele pergunta de novo a cada ajuste.
6. **Diga ok.** `/ok`: verifica, commita, sobe, abre o PR com o template. O cartão vai para "Em revisão". O outro dev revisa. Ninguém mescla o próprio PR.
7. **Depois do merge e do "Aceita" do Lucas:** `/opsx:archive <change>` e commit `docs(spec): GGVP-27 arquivada`. A spec principal em `openspec/specs/` passa a descrever o sistema que existe.

Sessão caiu no meio? Abra outra na mesma branch. O kit lembra o Claude onde parou. `openspec status --change <nome>` também.

## Comandos

Permitidos, e só estes:
- `/historia`, `/ok`
- `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:update`, `/opsx:archive`
- `/ecc:code-review`, `/ecc:security-scan`, `/ecc:save-session`, `/ecc:resume-session`
- `/ponytail` quando o Claude complicar
- No terminal: `openspec list`, `openspec status --change <nome>`, `openspec validate --all --strict`

Proibidos neste repositório: `/ecc:orch-*`, `/ecc:multi-*`, `/ecc:team-*`, `/ecc:gan-*`, `/ecc:santa-loop`, `/ecc:loop-start`, `/agenthub:*`, `/autoresearch-agent:*`, e qualquer subagente que você não pediu. Se o Claude abrir um sozinho, Esc e "sem subagente".

## Regras que não se negociam

1. A história é o prompt. Fora dela, o Claude para e diz.
2. Sem change do OpenSpec, sem código. O Claude responde com o comando do `propose`.
3. Menor mudança que cumpre o critério. Sem abstração para uso futuro. Sem refatorar o que não pediu.
4. Campo de formulário usa a biblioteca `campos`. CPF, CEP, data, número, telefone, NB, CNJ. Nunca validação solta na tela.
5. Critério com **[decidir]** aberto não vira código. Pergunta ao Lucas primeiro.
6. Teste acompanha a tarefa. Saída do teste na tela, não "passou".
7. Uma change ativa por dev. Terminou, arquiva; só depois a próxima.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Regras do repositório para o Claude | `CLAUDE.md` (seção "Como o Claude Code trabalha aqui") |
| Comandos do kit | `.claude/commands/historia.md`, `.claude/commands/ok.md` |
| Plugins e permissões do projeto | `.claude/settings.json` |
| Lembrete de estado a cada prompt | `kit/hooks/estado.js` |
| Regras do OpenSpec | `openspec/config.yaml` |
| Biblioteca de campos | `kit/campos/` (vai para `packages/campos` na história GGVP-108) |
| O que entra até 09/10 e em que ordem | `kit/entrega-09-10.md` |
| O Claude descontrolou | `kit/quando-descontrola.md` |
| Revisão automática do PR | `.github/workflows/claude-review.yml` (precisa do segredo `ANTHROPIC_API_KEY`) |
