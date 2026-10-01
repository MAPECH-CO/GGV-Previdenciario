#!/usr/bin/env bash
# Instala o kit de desenvolvimento nesta máquina. Rode na raiz do clone. Pode rodar de novo.
# Uso: kit/instalar.sh [--so-verificar]
set -u
so_verificar=0; [ "${1:-}" = "--so-verificar" ] && so_verificar=1

raiz="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Rode na raiz do clone do repositório."; exit 1; }
cd "$raiz"

echo "== Pré-requisitos =="
falta=0
for c in git node npm claude; do
  if command -v "$c" >/dev/null 2>&1; then echo "ok     $c $("$c" --version 2>/dev/null | head -1)"; else echo "FALTA  $c"; falta=1; fi
done
if command -v gh >/dev/null 2>&1; then echo "ok     gh"; else echo "aviso  gh não instalado. O /epico usa para abrir o PR: https://cli.github.com"; fi
if command -v node >/dev/null 2>&1; then
  maior="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$maior" -lt 22 ]; then echo "FALTA  Node 22 ou mais novo (tem $(node -v))"; falta=1; fi
fi
[ "$falta" = "0" ] || { echo "Instale o que falta e rode de novo."; exit 1; }
[ "$so_verificar" = "0" ] || { echo "Só verificação. Tudo certo."; exit 0; }

echo; echo "== OpenSpec =="
npm install -g @fission-ai/openspec@latest 2>&1 | tail -1
echo "openspec $(openspec --version)"

echo; echo "== Marketplaces de plugins =="
for m in https://github.com/affaan-m/ECC.git https://github.com/DietrichGebert/ponytail.git https://github.com/pedrogrigs/mapech-delivery-os.git; do
  claude plugin marketplace add "$m" >/dev/null 2>&1 || true
done
claude plugin marketplace update >/dev/null 2>&1 || true
echo ok

echo; echo "== Plugins do projeto =="
for p in superpowers@claude-plugins-official playwright@claude-plugins-official security-guidance@claude-plugins-official context7@claude-plugins-official ecc@ecc ponytail@ponytail mapech-delivery-os@mapech; do
  echo "$p -> $(claude plugin install "$p" 2>&1 | tail -1)"
done

echo; echo "== OpenSpec do repositório =="
openspec update 2>&1 | tail -1

echo; echo "== Configuração do projeto =="
if [ -f .claude/settings.json ]; then echo "ok     .claude/settings.json"
else echo "FALTA  .claude/settings.json. Copie kit/modelos/settings.json para .claude/settings.json (leia kit/modelos/LEIA-ME.md) e commite por PR."; fi

echo; echo "== Biblioteca campos =="
( cd kit/campos && npm test 2>&1 | tail -4 )

echo; echo "Pronto. Próximo passo: claude, e dentro dele /epico <nome do épico>"
