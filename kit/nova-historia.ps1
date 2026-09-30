# Abre a branch da história e o Claude Code no trilho do kit.
# Uso: kit\nova-historia.ps1 GGVP-27 [descricao-curta]
param(
    [Parameter(Mandatory = $true)][string]$Chave,
    [string]$Descricao = ''
)
$ErrorActionPreference = 'Stop'
$Chave = $Chave.Trim().ToUpper()
if ($Chave -notmatch '^GGVP-\d+$') { Write-Host "Uso: kit\nova-historia.ps1 GGVP-27 [descricao-curta]"; exit 1 }

$raiz = (git rev-parse --show-toplevel 2>$null)
if (-not $raiz) { Write-Host "Rode dentro do clone do repositório."; exit 1 }
Set-Location $raiz

if (git status --porcelain) {
    Write-Host "Há mudanças não commitadas nesta árvore. Commite ou guarde antes (git stash push -u -m $Chave)."
    exit 1
}

# descrição: argumento, ou o nome do arquivo da história, ou pergunta
if (-not $Descricao) {
    $arq = Get-ChildItem -Path (Join-Path $raiz 'docs/requisitos/candidatas') -Filter "$Chave-*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($arq) { $Descricao = ($arq.BaseName -replace "^$Chave-", '') }
}
if (-not $Descricao) { $Descricao = Read-Host "Descrição curta da branch (ex.: protocolar-no-meu-inss)" }
$slug = ($Descricao.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
if (-not $slug) { Write-Host "Descrição inválida."; exit 1 }
$branch = "feat/$Chave-$slug"

& (Join-Path $PSScriptRoot 'verificar-historia.ps1') $Chave
$resp = Read-Host "Seguir com a branch $branch ? (s/N)"
if ($resp -notmatch '^[sS]') { Write-Host "Parado."; exit 0 }

git switch main
git pull --ff-only origin main
$existe = git branch --list $branch
if ($existe) { git switch $branch } else { git switch -c $branch }

Write-Host ""
Write-Host "Branch: $branch"
Write-Host "No chat do Claude, cole:  /historia $Chave"
Write-Host ""
if (Get-Command claude -ErrorAction SilentlyContinue) { claude } else { Write-Host "Claude Code não encontrado no PATH. Abra-o na raiz do repositório." }
