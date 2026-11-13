# copy-wasm.ps1 — 把 DSH 产出的 mp_core.wasm 原字节复制进小程序包，并核对哈希。
# 源文件哈希与 -ExpectedSha256 不一致时不复制、退出码 1（不覆盖、不重建源文件）。
# 用法（阶段 A 基线）：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\miniprogram\copy-wasm.ps1
# 用法（阶段 B，使用 P01/用户给出的绑定候选哈希）：
#   ... -File tools\miniprogram\copy-wasm.ps1 -ExpectedSha256 <绑定哈希>
param(
  [string]$Source = 'D:\项目\cpp\.toolchain\build\wasm\mp_core.wasm',
  [string]$ExpectedSha256 = '1F77D9153EDA9B2A491CCDED8A993AC4CB9C2D2C71447E5CF4453DD863B4B8B5',
  [string]$Destination = (Join-Path $PSScriptRoot '..\..\miniprogram\src\assets\wasm\mp_core.wasm')
)
$ErrorActionPreference = 'Stop'

$sourceItem = Get-Item -LiteralPath $Source
$sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
Write-Output "source      : $($sourceItem.FullName)"
Write-Output "source bytes: $($sourceItem.Length)"
Write-Output "source mtime: $($sourceItem.LastWriteTime.ToString('s'))"
Write-Output "source sha  : $sourceHash"
Write-Output "expected sha: $ExpectedSha256"

if ($sourceHash -ne $ExpectedSha256.ToUpperInvariant()) {
  Write-Output 'RESULT: MISMATCH，未复制。请把差异交 P01，不要覆盖或重建源文件。'
  exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
Copy-Item -LiteralPath $Source -Destination $Destination -Force
$destinationHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
Write-Output "copy        : $((Resolve-Path -LiteralPath $Destination).Path)"
Write-Output "copy sha    : $destinationHash"
if ($destinationHash -ne $sourceHash) {
  throw '副本哈希与源文件不一致'
}
Write-Output 'RESULT: COPIED，副本与源文件字节一致。'
