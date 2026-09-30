# Confere se a história GGVP-n está livre antes de você pegá-la.
# Uso: kit\verificar-historia.ps1 GGVP-27
param([Parameter(Mandatory = $true)][string]$Chave)

$ErrorActionPreference = 'Continue'
$Chave = $Chave.Trim().ToUpper()
if ($Chave -notmatch '^GGVP-\d+$') { Write-Host "Uso: kit\verificar-historia.ps1 GGVP-27"; exit 1 }

$raiz = (git rev-parse --show-toplevel 2>$null)
if (-not $raiz) { Write-Host "Rode dentro do clone do repositório."; exit 1 }
Set-Location $raiz

git fetch -q origin 2>$null
Write-Host ""
Write-Host "== $Chave =="

$branches = @(git branch -r --list "*$Chave*" 2>$null | ForEach-Object { $_.Trim() })
if ($branches.Count -gt 0) { Write-Host "Branch remota : $($branches -join ', ')" } else { Write-Host "Branch remota : nenhuma" }

$prsAbertos = @()
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $json = gh pr list --state all --search $Chave --json number,title,state,author 2>$null
    if ($json) {
        $prs = $json | ConvertFrom-Json
        foreach ($p in $prs) {
            Write-Host "PR            : #$($p.number) [$($p.state)] $($p.author.login): $($p.title)"
            if ($p.state -eq 'OPEN') { $prsAbertos += $p }
        }
        if ($prs.Count -eq 0) { Write-Host "PR            : nenhum" }
    } else { Write-Host "PR            : (gh sem acesso; confira no GitHub)" }
} else { Write-Host "PR            : gh não instalado; confira no GitHub" }

$n = ($Chave -split '-')[1]
$changes = @(Get-ChildItem -Path (Join-Path $raiz 'openspec/changes') -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne 'archive' -and $_.Name.ToLower() -like "*ggvp-$n*" } | ForEach-Object { $_.Name })
if ($changes.Count -gt 0) { Write-Host "Change local  : $($changes -join ', ')" } else { Write-Host "Change local  : nenhuma" }

$arq = Get-ChildItem -Path (Join-Path $raiz 'docs/requisitos/candidatas') -Filter "$Chave-*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($arq) { Write-Host "História      : docs/requisitos/candidatas/$($arq.Name)" } else { Write-Host "História      : não está em docs/requisitos/candidatas (leia no Jira)" }
Write-Host "Jira          : https://mapech.atlassian.net/browse/$Chave"

Write-Host ""
if ($branches.Count -eq 0 -and $prsAbertos.Count -eq 0) {
    Write-Host "LIVRE. Confirme no Jira que o cartão está sem responsável, e rode: kit\nova-historia.ps1 $Chave"
} else {
    $quem = if ($prsAbertos.Count -gt 0) { $prsAbertos[0].author.login } else { 'quem criou a branch' }
    Write-Host "EM ANDAMENTO por $quem. Fale com a pessoa antes de mexer."
}
