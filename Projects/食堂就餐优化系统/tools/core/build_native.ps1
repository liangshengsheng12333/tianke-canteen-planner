# build_native.ps1 - build the native CLI and the unit-test executables with MSVC.
#
# Notes:
#   * build outputs go to <workspace>\.toolchain\build\native (never inside the source tree)
#   * fixed options: /std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus
#   * requires Windows PowerShell 5.1 or PowerShell 7; on 5.1 run with
#     powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1
#   * this file is intentionally ASCII-only: Windows PowerShell 5.1 reads .ps1 as ANSI
#     and would mis-parse non-ASCII text.
#   * object files land in a per-target folder (cl is started there) instead of using
#     /Fo with a trailing backslash, which would escape the closing quote in cl's parser.
#
# Usage:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1 -Only mp_test_core
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1 -OutDir D:\path\to\out
[CmdletBinding()]
param(
    [string[]]$Only = @(),
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# workspace is the parent of the "Projects" folder; the toolchain lives there
$workspace = Split-Path -Parent (Split-Path -Parent $root)
$toolchain = Join-Path $workspace '.toolchain'
$outRoot = if ($OutDir) { $OutDir } else { Join-Path $toolchain 'build\native' }
$vcvars = 'D:\Microsoft Visual Studio\VC\Auxiliary\Build\vcvars64.bat'

if (-not (Test-Path -LiteralPath $vcvars)) { throw "vcvars64.bat not found: $vcvars" }

$includeDir = Join-Path $root 'core\include'
$srcDir = Join-Path $root 'core\src'
$sources = @(Get-ChildItem -LiteralPath $srcDir -Filter *.cpp | Sort-Object Name | ForEach-Object { $_.FullName })
if ($sources.Count -eq 0) { throw "no .cpp sources under core\src" }

$targets = @(
    @{ Name = 'mp_cli';         Main = (Join-Path $root 'core\cli\main.cpp') },
    @{ Name = 'mp_test_sha256'; Main = (Join-Path $root 'core\tests\test_sha256_main.cpp') },
    @{ Name = 'mp_test_json';   Main = (Join-Path $root 'core\tests\test_json_main.cpp') },
    @{ Name = 'mp_test_core';   Main = (Join-Path $root 'core\tests\test_core_main.cpp') }
)

New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$quotedSources = ($sources | ForEach-Object { '"' + $_ + '"' }) -join ' '
$results = @()
foreach ($target in $targets) {
    $name = $target.Name
    if ($Only.Count -gt 0 -and ($Only -notcontains $name)) { continue }
    if (-not (Test-Path -LiteralPath $target.Main)) {
        Write-Host "[skip] $name : missing entry $($target.Main)"
        continue
    }

    $objDir = Join-Path $outRoot (Join-Path 'obj' $name)
    New-Item -ItemType Directory -Force -Path $objDir | Out-Null
    $exePath = Join-Path $outRoot ($name + '.exe')
    $logPath = Join-Path $outRoot ('build_' + $name + '.log')

    $cl = 'cl /nologo /std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP ' +
          '/I"' + $includeDir + '" /Fe"' + $exePath + '" ' +
          $quotedSources + ' "' + $target.Main + '"'
    $command = 'call "' + $vcvars + '" >nul && cd /d "' + $objDir + '" && ' + $cl

    $output = & cmd.exe /c $command 2>&1
    $exitCode = $LASTEXITCODE
    $output | Set-Content -LiteralPath $logPath -Encoding UTF8

    $warningCount = @($output | Select-String -Pattern ': warning C\d+' -AllMatches).Count
    $errorCount = @($output | Select-String -Pattern ': error C\d+|: fatal error' -AllMatches).Count

    $status = if ($exitCode -eq 0) { 'OK' } else { 'FAILED' }
    Write-Host ('[{0}] {1}  exit={2} warnings={3} errors={4}' -f $status, $name, $exitCode, $warningCount, $errorCount)
    if ($warningCount -gt 0) {
        $output | Select-String -Pattern ': warning C\d+' | Select-Object -First 20 | ForEach-Object { Write-Host ('   ' + $_.Line.Trim()) }
    }
    if ($exitCode -ne 0) {
        $output | Select-Object -Last 30 | ForEach-Object { Write-Host ('   ' + $_) }
    }

    $results += [pscustomobject]@{
        target   = $name
        exe      = $exePath
        exitCode = $exitCode
        warnings = $warningCount
        errors   = $errorCount
        log      = $logPath
    }
}

$summaryPath = Join-Path $outRoot 'build_summary.json'
$results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
Write-Host ("summary -> " + $summaryPath)

if (@($results | Where-Object { $_.exitCode -ne 0 }).Count -gt 0) { exit 1 }
if (@($results | Where-Object { $_.warnings -gt 0 }).Count -gt 0) { exit 3 }
exit 0
