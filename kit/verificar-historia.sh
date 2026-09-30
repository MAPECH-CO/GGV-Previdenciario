#!/usr/bin/env bash
# Confere se a história GGVP-n está livre antes de você pegá-la.
# Uso: kit/verificar-historia.sh GGVP-27
set -u
chave="$(echo "${1:-}" | tr '[:lower:]' '[:upper:]' | xargs)"
if ! [[ "$chave" =~ ^GGVP-[0-9]+$ ]]; then echo "Uso: kit/verificar-historia.sh GGVP-27"; exit 1; fi

raiz="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Rode dentro do clone do repositório."; exit 1; }
cd "$raiz"
git fetch -q origin 2>/dev/null || true

echo
echo "== $chave =="
branches="$(git branch -r --list "*$chave*" 2>/dev/null | sed 's/^ *//' | paste -sd ',' -)"
echo "Branch remota : ${branches:-nenhuma}"

abertos=0
if command -v gh >/dev/null 2>&1; then
  json="$(gh pr list --state all --search "$chave" --json number,title,state,author 2>/dev/null || true)"
  if [ -n "$json" ] && [ "$json" != "[]" ]; then
    echo "$json" | node -e '
      const prs = JSON.parse(require("fs").readFileSync(0, "utf8"));
      for (const p of prs) console.log(`PR            : #${p.number} [${p.state}] ${p.author.login}: ${p.title}`);
    '
    abertos="$(echo "$json" | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(p.filter(x=>x.state==="OPEN").length)')"
    autor="$(echo "$json" | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8")).find(x=>x.state==="OPEN");console.log(p?p.author.login:"")')"
  else
    echo "PR            : nenhum"
  fi
else
  echo "PR            : gh não instalado; confira no GitHub"
fi

n="${chave#GGVP-}"
changes="$(ls -1d openspec/changes/*ggvp-$n* 2>/dev/null | grep -v '/archive' | xargs -n1 basename 2>/dev/null | paste -sd ',' -)"
echo "Change local  : ${changes:-nenhuma}"

arq="$(ls docs/requisitos/candidatas/$chave-*.md 2>/dev/null | head -1)"
if [ -n "$arq" ]; then echo "História      : $arq"; else echo "História      : não está em docs/requisitos/candidatas (leia no Jira)"; fi
echo "Jira          : https://mapech.atlassian.net/browse/$chave"

echo
if [ -z "$branches" ] && [ "${abertos:-0}" = "0" ]; then
  echo "LIVRE. Confirme no Jira que o cartão está sem responsável, e rode: kit/nova-historia.sh $chave"
else
  echo "EM ANDAMENTO por ${autor:-quem criou a branch}. Fale com a pessoa antes de mexer."
fi
