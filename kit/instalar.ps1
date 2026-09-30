# Instala o kit de desenvolvimento nesta máquina. Rode na raiz do clone. Pode rodar de novo.
# Uso: kit\instalar.ps1 [-SoVerificar]
param([switch]$SoVerificar)
$ErrorActionPreference = 'Continue'

function Tem($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

$raiz = (git rev-parse --show-toplevel 2>$null)
if (-not $raiz) { Write-Host "Rode na raiz do clone do repositório."; exit 1 }
Set-Location $raiz

Write-Host "== Pré-requisitos =="
$falta = $false
foreach ($c in 'git', 'node', 'npm', 'claude') {
    if (Tem $c) { $v = (& $c --version 2>$null | Select-Object -First 1); Write-Host "ok     $c $v" }
    else { Write-Host "FALTA  $c"; $falta = $true }
}
if (Tem 'gh') { Write-Host "ok     gh" } else { Write-Host "aviso  gh não instalado. O /ok usa para abrir o PR: https://cli.github.com" }
if (Tem 'node') {
    $maior = [int](((node -v) -replace '^v', '').Split('.')[0])
    if ($maior -lt 22) { Write-Host "FALTA  Node 22 ou mais novo (tem $(node -v))"; $falta = $true }
}
if ($falta) { Write-Host "Instale o que falta e rode de novo."; exit 1 }
if ($SoVerificar) { Write-Host "Só verificação. Tudo certo."; exit 0 }

Write-Host ""
Write-Host "== OpenSpec =="
npm install -g @fission-ai/openspec@latest 2>&1 | Select-Object -Last 1
Write-Host "openspec $(openspec --version)"

Write-Host ""
Write-Host "== Marketplaces de plugins =="
foreach ($m in 'https://github.com/affaan-m/ECC.git', 'https://github.com/DietrichGebert/ponytail.git', 'https://github.com/pedrogrigs/mapech-delivery-os.git') {
    claude plugin marketplace add $m 2>&1 | Out-Null
}
claude plugin marketplace update 2>&1 | Out-Null
Write-Host "ok"

Write-Host ""
Write-Host "== Plugins do projeto =="
foreach ($p in 'superpowers@claude-plugins-official', 'playwright@claude-plugins-official', 'security-guidance@claude-plugins-official', 'context7@claude-plugins-official', 'ecc@ecc', 'ponytail@ponytail', 'mapech-delivery-os@mapech') {
    $r = claude plugin install $p 2>&1 | Select-Object -Last 1
    Write-Host "$p -> $r"
}

Write-Host ""
Write-Host "== OpenSpec do repositório =="
openspec update 2>&1 | Select-Object -Last 1

Write-Host ""
Write-Host "== Configuração do projeto =="
if (Test-Path '.claude/settings.json') { Write-Host "ok     .claude/settings.json" }
else { Write-Host "FALTA  .claude/settings.json. Copie kit\modelos\settings.json para .claude\settings.json (leia kit\modelos\LEIA-ME.md) e commite por PR." }

Write-Host ""
Write-Host "== Biblioteca campos =="
Push-Location 'kit/campos'
npm test 2>&1 | Select-Object -Last 4
Pop-Location

Write-Host ""
Write-Host "Pronto. Próximo passo: kit\verificar-historia.ps1 GGVP-n"
