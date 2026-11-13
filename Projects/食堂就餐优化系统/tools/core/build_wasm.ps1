# build_wasm.ps1 - compile the same shared core to a zero-import .wasm module.
#
# Target: wasm32-freestanding with -nostdlib, so the module imports nothing from the
# host and only exports memory plus the mp_* API. That shape works for a mini-program
# host that instantiates the module directly.
# Toolchain: zig 0.16.0 (python -m ziglang) unpacked under <workspace>\.toolchain\py-zig
#
# Notes:
#   * this file is intentionally ASCII-only (Windows PowerShell 5.1 reads .ps1 as ANSI)
#   * run with: powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_wasm.ps1
[CmdletBinding()]
param([string]$OutDir = '')

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# workspace is the parent of the "Projects" folder; the toolchain lives there
$workspace = Split-Path -Parent (Split-Path -Parent $root)
$toolchain = Join-Path $workspace '.toolchain'
$zigDir = Join-Path $toolchain 'py-zig'
if (-not (Test-Path -LiteralPath $zigDir)) {
    throw "missing zig toolchain dir: $zigDir"
}
$targetOut = if ($OutDir) { $OutDir } else { Join-Path $toolchain 'build\wasm' }
$stageDir = Join-Path $toolchain 'build\wasm'
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
New-Item -ItemType Directory -Force -Path $targetOut | Out-Null

# zig caches must live inside the workspace, otherwise the sandbox denies them
$env:PYTHONPATH = $zigDir
$env:ZIG_GLOBAL_CACHE_DIR = Join-Path $toolchain 'zig-cache'
$env:ZIG_LOCAL_CACHE_DIR = Join-Path $toolchain 'zig-cache-local'
$env:PYTHONIOENCODING = 'utf-8'

$includeDir = Join-Path $root 'core\include'
$srcDir = Join-Path $root 'core\src'
$sources = @(Get-ChildItem -LiteralPath $srcDir -Filter *.cpp | Sort-Object Name | ForEach-Object { $_.FullName })
if ($sources.Count -eq 0) { throw "no .cpp sources under core\src" }

$stageWasm = Join-Path $stageDir 'mp_core.wasm'
$logPath = Join-Path $targetOut 'build_wasm.log'

$zigArgs = @(
    'c++'
    '-target', 'wasm32-freestanding'
    '-nostdlib'
    '-Os'
    '-fno-exceptions'
    '-fno-rtti'
    '-Wall'
    '-Wextra'
    '-Wno-unused-parameter'
    '-std=c++17'
    '-I', $includeDir
    '-Wl,--no-entry'
    '-Wl,--gc-sections'
    '-o', $stageWasm
) + $sources

$output = & python -m ziglang @zigArgs 2>&1
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0 -and (-not $output)) {
    # Fallback for non-interactive sandboxes where SHELL32.dll/ole32.dll KnownDLL user32/imm32 init returns 0xC0000142
    $runnerDir = Join-Path $toolchain 'build\zig-runner'
    $patchedZig = Join-Path $runnerDir 'zig.exe'
    if (-not (Test-Path -LiteralPath $patchedZig)) {
        New-Item -ItemType Directory -Force -Path $runnerDir | Out-Null
        $shimSrc = Join-Path $runnerDir 'shim.c'
        @(
            '__declspec(dllexport) long __stdcall SHGetKnownFolderPath(const void* r, unsigned long f, void* t, wchar_t** p) { if (p) *p = 0; return -2147467259L; }',
            '__declspec(dllexport) void __stdcall CoTaskMemFree(void* pv) { (void)pv; }'
        ) | Set-Content -LiteralPath $shimSrc -Encoding ASCII
        $vcvars = 'D:\Microsoft Visual Studio\VC\Auxiliary\Build\vcvars64.bat'
        & cmd.exe /c ('call "' + $vcvars + '" >nul && cd /d "' + $runnerDir + '" && cl /nologo /LD shim.c /Fe"zigshel.dll" >nul && copy /Y zigshel.dll zigol.dll >nul') | Out-Null
        $origZig = Join-Path $zigDir 'ziglang\zig.exe'
        & python -c "import pathlib, sys; b = pathlib.Path(sys.argv[1]).read_bytes().replace(b'SHELL32.dll', b'zigshel.dll').replace(b'ole32.dll', b'zigol.dll'); pathlib.Path(sys.argv[2]).write_bytes(b)" $origZig $patchedZig
    }
    $env:ZIG_LIB_DIR = Join-Path $zigDir 'ziglang\lib'
    $output = & $patchedZig @zigArgs 2>&1
    $exitCode = $LASTEXITCODE
}
$output | Set-Content -LiteralPath $logPath -Encoding UTF8

$warningCount = @($output | Select-String -Pattern 'warning:' -AllMatches).Count
Write-Host ("[zig] exit=" + $exitCode + " warnings=" + $warningCount)
if ($output) { $output | Select-Object -Last 30 | ForEach-Object { Write-Host ('   ' + $_) } }
if ($exitCode -ne 0) { exit 1 }

$outWasm = Join-Path $targetOut 'mp_core.wasm'
if ($stageWasm -ne $outWasm) {
    Copy-Item -LiteralPath $stageWasm -Destination $outWasm -Force
}

$size = (Get-Item -LiteralPath $outWasm).Length
$hash = (Get-FileHash -LiteralPath $outWasm -Algorithm SHA256).Hash
Write-Host ("wasm  : " + $outWasm)
Write-Host ("size  : " + $size)
Write-Host ("sha256: " + $hash)

$summary = [pscustomobject]@{
    wasm     = $outWasm
    size     = $size
    sha256   = $hash
    warnings = $warningCount
    log      = $logPath
}
$summary | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $targetOut 'wasm_summary.json') -Encoding UTF8
if ($warningCount -gt 0) { exit 3 }
exit 0
