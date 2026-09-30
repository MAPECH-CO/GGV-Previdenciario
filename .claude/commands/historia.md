---
description: Lê a história GGVP-n, confere a fila e devolve o comando /opsx:propose pronto para colar. Não escreve código.
argument-hint: GGVP-27
allowed-tools: Bash(git fetch:*), Bash(git branch:*), Bash(gh pr list:*), Bash(openspec:*), Read, Glob, Grep
---

# /historia $ARGUMENTS

Você prepara a história para o OpenSpec. **Não escreve código, não cria arquivo, não roda o propose.** O dev cola o comando.

## Passos

1. **Chave.** `$ARGUMENTS` precisa ter `GGVP-n`. Sem chave, pergunte qual é e pare.
2. **Ler a história.** Abra `docs/requisitos/candidatas/GGVP-n-*.md`. Se o conector do Jira estiver disponível, leia também o cartão `GGVP-n` (estado, responsável, comentários). Texto diferente entre os dois: mostre a diferença em uma linha e siga pelo repositório.
3. **Fila.** Rode e mostre o resultado em uma linha cada:
   - `git fetch -q origin && git branch -r --list "*GGVP-n*"`
   - `gh pr list --state all --search GGVP-n`
   - `openspec list`
   Outra pessoa já está nela (branch de outro dev, PR aberto): diga quem e pare.
4. **Branch.** A branch atual precisa ter a chave. Se não tem, responda só: "rode `kit/nova-historia GGVP-n` e depois `/historia GGVP-n` de novo".
5. **Travas.** Liste as linhas dos critérios com **[decidir]** ou "(proposta)" e as dúvidas `Qn` citadas. Se alguma impede o critério de ser testado, diga o que perguntar ao Lucas e pare. Nota que não muda o critério não trava.
6. **Campos.** Liste os campos de formulário que a história tem (CPF, CEP, data, número, telefone, NB, CNJ, e-mail). Cada um usa a biblioteca `campos` (`kit/campos`, depois `packages/campos`). Nunca validação solta na tela.

## Resposta, neste formato e nada mais

```
GGVP-n · <título>
Papel: <como> · Passo BPMN: <D?.??> · Tela: <id do Figma> · Portões: <G..>
Campos: <lista ou "nenhum">
Travas: <nenhuma | lista curta>
Fila: livre | em andamento por <quem>

Cole no chat:
/opsx:propose "GGVP-n: <título curto>"
```
