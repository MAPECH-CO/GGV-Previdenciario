#!/usr/bin/env bash
# Abre a branch da história e o Claude Code no trilho do kit.
# Uso: kit/nova-historia.sh GGVP-27 [descricao-curta]
set -euo pipefail
chave="$(echo "${1:-}" | tr '[:lower:]' '[:upper:]' | xargs)"
descricao="${2:-}"
if ! [[ "$chave" =~ ^GGVP-[0-9]+$ ]]; then echo "Uso: kit/nova-historia.sh GGVP-27 [descricao-curta]"; exit 1; fi

raiz="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Rode dentro do clone do repositório."; exit 1; }
cd "$raiz"
aqui="$(cd "$(dirname "$0")" && pwd)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Há mudanças não commitadas nesta árvore. Commite ou guarde antes (git stash push -u -m $chave)."
  exit 1
fi

if [ -z "$descricao" ]; then
  arq="$(ls docs/requisitos/candidatas/$chave-*.md 2>/dev/null | head -1 || true)"
  if [ -n "$arq" ]; then descricao="$(basename "$arq" .md)"; descricao="${descricao#$chave-}"; fi
fi
if [ -z "$descricao" ]; then read -r -p "Descrição curta da branch (ex.: protocolar-no-meu-inss): " descricao; fi
slug="$(echo "$descricao" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
[ -n "$slug" ] || { echo "Descrição inválida."; exit 1; }
branch="feat/$chave-$slug"

bash "$aqui/verificar-historia.sh" "$chave"
read -r -p "Seguir com a branch $branch ? (s/N) " resp
[[ "$resp" =~ ^[sS] ]] || { echo "Parado."; exit 0; }

git switch main
git pull --ff-only origin main
if git show-ref --verify --quiet "refs/heads/$branch"; then git switch "$branch"; else git switch -c "$branch"; fi

echo
echo "Branch: $branch"
echo "No chat do Claude, cole:  /historia $chave"
echo
if command -v claude >/dev/null 2>&1; then claude; else echo "Claude Code não encontrado no PATH. Abra-o na raiz do repositório."; fi
