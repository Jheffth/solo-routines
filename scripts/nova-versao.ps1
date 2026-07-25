<#
.SYNOPSIS
    Cria uma nova versão do Solo Routines.
    Uso: .\scripts\nova-versao.ps1 -Versao "1.7.0" -Descricao "Minha feature"
#>
param(
    [Parameter(Mandatory)][string]$Versao,
    [string]$Descricao = "Nova versão"
)

$root = Split-Path $PSScriptRoot -Parent
$versionFile = Join-Path $root "VERSION"
$changelogDir = Join-Path $root "CHANGELOG"
$changelogFile = Join-Path $changelogDir "v$Versao.md"

# Atualiza VERSION
$Versao | Set-Content $versionFile -NoNewline -Encoding UTF8
Write-Host "✅ VERSION atualizado para $Versao"

# Cria CHANGELOG
if (-not (Test-Path $changelogDir)) { New-Item -ItemType Directory $changelogDir | Out-Null }
$hoje = Get-Date -Format "yyyy-MM-dd"
$conteudo = @"
# v$Versao — $hoje

## $Descricao

<!-- Descreva aqui as mudanças desta versão -->

"@
$conteudo | Set-Content $changelogFile -Encoding UTF8
Write-Host "✅ CHANGELOG/v$Versao.md criado"
Write-Host ""
Write-Host "📌 Próximos passos:"
Write-Host "   1. Edite CHANGELOG/v$Versao.md com as mudanças"
Write-Host "   2. git add . && git commit -m 'release: v$Versao'"
Write-Host "   3. git push"
