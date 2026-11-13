# run-choosefile-evidence.ps1 -- T05 证据：在微信开发者工具里真实走一遍
# “选文件 -> 导入菜单 / 恢复备份”，包括成功、取消、非法文件三条分支。
#
# 背景：v1 只用 store 直调模拟过文件选择，不算真实文件选择。本脚本通过模拟器真实点击
# “选择文件…”按钮 -> 系统原生“打开”对话框 -> 用 UI Automation/Win32 选中磁盘上的真实文件，
# 再触发页面自身的预检/确认入口，逐步记录页面 data 与截图。
#
# 说明（如实记录）：页面上的预检/确认替换等按钮受自动化选择器限制（只能命中首个匹配），
# 因此这些步骤用 automation_evaluate 调用页面自身方法触发；文件选择本身是真实点击 + 真实系统
# 对话框 + 真实文件读取。页面方法入口与按钮 bindtap 指向同一函数。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\miniprogram\run-choosefile-evidence.ps1 `
#     -Project <小程序绝对路径> -OutDir <证据目录> -FixtureDir <ASCII 夹具目录>
# 输出：OutDir 下 screenshots/ 与 log.json / log/*.json / summary.md
# NOTE: ASCII-only file content so Windows PowerShell 5.1 can parse it reliably.
param(
  [Parameter(Mandatory=$true)][string]$Project,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [Parameter(Mandatory=$true)][string]$FixtureDir,
  [string]$ValidMenu = 'menu-valid-multiwindow.json',
  [string]$InvalidMenu = 'menu-invalid.json'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Split-Path (Split-Path $PSScriptRoot)
$WorkspaceRoot = Split-Path (Split-Path $ProjectRoot)
$Tmp = Join-Path $WorkspaceRoot '.toolchain\tmp\t05v2'
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ShotDir = Join-Path $OutDir 'screenshots'
$LogDir = Join-Path $OutDir 'log'
New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Wx = Get-ChildItem -Path 'D:\' -Directory -Force -ErrorAction SilentlyContinue |
  ForEach-Object {
    $root = $_.FullName
    $candidates = @((Join-Path $root 'wechatide.cmd'))
    Get-ChildItem -Path $root -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
      $candidates += (Join-Path $_.FullName 'wechatide.cmd')
    }
    $candidates
  } |
  Where-Object { Test-Path $_ } |
  Select-Object -First 1
if (-not $Wx) { throw 'wechatide.cmd not found under D:\' }

$DlgScript = Join-Path $PSScriptRoot 'select-file-dialog.ps1'
$Steps = New-Object System.Collections.ArrayList

function Invoke-WxTool([string]$toolName, [string[]]$toolArgs) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = @(& $Wx -c DeepSeek $toolName @toolArgs 2>&1)
  } finally {
    $ErrorActionPreference = $prev
  }
  $text = ($lines | ForEach-Object { [string]$_ }) -join "`n"
  $start = $text.IndexOf('{')
  $end = $text.LastIndexOf('}')
  if ($start -lt 0 -or $end -lt $start) { throw "wechatide $toolName returned no JSON: $text" }
  return ($text.Substring($start, $end - $start + 1) | ConvertFrom-Json)
}

function Get-PageData {
  $env = Invoke-WxTool 'automation_page_action' @('--project', $Project, '--action', 'getData')
  if (-not $env.ok) { throw ('getData failed: ' + $env.message) }
  return $env.result.data
}

function Get-Data([string]$path) {
  $data = Get-PageData
  $cur = $data
  foreach ($seg in $path.Split('.')) {
    if ($null -eq $cur) { return $null }
    $cur = $cur.$seg
  }
  return $cur
}

function Invoke-Eval([string]$fnSource) {
  $env = Invoke-WxTool 'automation_evaluate' @('--project', $Project, '--fn-source', $fnSource)
  return $env
}

function Wait-Until([scriptblock]$probe, [int]$timeoutSec, [string]$what) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    $v = & $probe
    if ($v) { return $v }
    Start-Sleep -Milliseconds 500
  }
  return $null
}

function Save-Shot([string]$name) {
  $p = Join-Path $ShotDir $name
  $env = Invoke-WxTool 'simulator_screenshot' @('--project', $Project, '--path', $p, '--wait', '1', '--optimize', 'false')
  $bytes = [System.IO.File]::ReadAllBytes($p)
  $isPng = ($bytes.Length -gt 8 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50)
  return [pscustomobject]@{ file = $p; bytes = $bytes.Length; png = $isPng; width = $env.result.imageWidth; height = $env.result.imageHeight }
}

function Add-Step([string]$name, $payload) {
  $step = [pscustomobject]@{ step = $name; at = (Get-Date).ToString('o'); payload = $payload }
  [void]$Steps.Add($step)
  $file = Join-Path $LogDir (('{0:D2}-{1}.json' -f $Steps.Count, $name))
  $step | ConvertTo-Json -Depth 20 | Set-Content -Path $file -Encoding UTF8
  Write-Output ('[step] ' + $name)
}

function Invoke-Dialog([string]$action, [string]$path) {
  if ($action -eq 'pick') {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $DlgScript -Action pick -Path $path -WaitSec 20
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $DlgScript -Action cancel -WaitSec 20
  }
}

$validPath = Join-Path $FixtureDir $ValidMenu
$invalidPath = Join-Path $FixtureDir $InvalidMenu
if (-not (Test-Path $validPath)) { throw "missing fixture: $validPath" }
if (-not (Test-Path $invalidPath)) { throw "missing fixture: $invalidPath" }

# --- 0. 打开菜单页，记录基线 ---------------------------------------------------------------
# 先清掉上一轮遗留的原生“打开”对话框：chooseMessageFile 的对话框未关闭时页面 JS 会一直等待，
# 表现为 automator 超时（不是页面崩溃）。再重启项目窗口，保证模拟器处于干净可自动化状态
# （本地存储持久化，重启不丢用户数据；窗口最小化时模拟器不渲染，也会表现为超时）。
& powershell -NoProfile -ExecutionPolicy Bypass -File $DlgScript -Action cancel -WaitSec 1 2>&1 | Out-Null
$envClose = Invoke-WxTool 'close_project_window' @('--project', $Project)
Start-Sleep -Seconds 2
$envWin = Invoke-WxTool 'open_project_window' @('--project', $Project, '--window-mode', 'fullMode')
Start-Sleep -Seconds 12
# 只在开发者工具模拟器里复位本机存储：让“导入/恢复”有清晰的前后对比。
# 真机不做这一步（真机步骤见交付反馈里的操作清单）。
$evalClear = Invoke-Eval "function(){wx.clearStorageSync();return {cleared:true};}"
$envClose2 = Invoke-WxTool 'close_project_window' @('--project', $Project)
Start-Sleep -Seconds 2
$envWin2 = Invoke-WxTool 'open_project_window' @('--project', $Project, '--window-mode', 'fullMode')
Start-Sleep -Seconds 12
$envOpen = Invoke-WxTool 'simulator_open_page' @('--project', $Project, '--page', 'pages/menu/index')
Start-Sleep -Seconds 3
# 重启窗口后的首次编译/挂载时间不固定：轮询到页面 data 可读为止（最多约 60s），
# 避免把“模拟器还没就绪”误判成功能失败。
$baseline = $null
for ($attempt = 0; $attempt -lt 8; $attempt++) {
  try {
    $candidate = Get-PageData
    if ($candidate -and $candidate.loaded) { $baseline = $candidate; break }
  } catch { }
  Start-Sleep -Seconds 5
  try { Invoke-WxTool 'simulator_open_page' @('--project', $Project, '--page', 'pages/menu/index') | Out-Null } catch { }
}
if ($null -eq $baseline) { throw 'menu page did not become readable within 60s after window restart' }
$baselineInfo = $baseline.view.info
Add-Step 'baseline' ([pscustomobject]@{
  open = $envOpen.ok
  menuVersion = $baselineInfo.menuVersion
  catalogHash = $baselineInfo.catalogHash
  windowCount = $baselineInfo.windowCount
  dishCount = $baselineInfo.dishCount
  offerCount = $baselineInfo.offerCount
  loaded = $baseline.loaded
})

# --- 1. 成功：真实选文件 -> 预检 -> 确认替换 -------------------------------------------------
$tapEnv = Invoke-WxTool 'automation_element_action' @('--project', $Project, '--action', 'tap', '--selector', 'button', '--wait', '1')
$dlgOut = Invoke-Dialog 'pick' $validPath
Start-Sleep -Milliseconds 800
$afterPick = Get-PageData
$shot1 = Save-Shot '01-menu-file-selected.png'
Add-Step 'menu-pick-valid' ([pscustomobject]@{
  tap = $tapEnv.ok
  dialog = ($dlgOut -join ' ')
  importFileName = $afterPick.importFileName
  importTextLength = ([string]$afterPick.importText).Length
  statusText = $afterPick.statusText
  screenshot = $shot1
})

$evalPre = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onPreflightMenu();return 'preflight-triggered';}"
$ready = Wait-Until { (Get-Data 'importReady') } 20 'importReady'
$afterPre = Get-PageData
$shot2 = Save-Shot '02-menu-preflight-ok.png'
Add-Step 'menu-preflight' ([pscustomobject]@{
  evaluate = $evalPre.ok
  result = $evalPre.result
  importReady = $afterPre.importReady
  importStage = $afterPre.importStage
  importStageLabel = $afterPre.importStageLabel
  importMessage = $afterPre.importMessage
  importErrors = $afterPre.importErrors
  importDiff = $afterPre.importDiff
  screenshot = $shot2
})

$evalApply = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onApplyMenu();return 'apply-triggered';}"
$applied = Wait-Until {
  $info = Get-Data 'view.info'
  if ($info -and $info.menuVersion -ne $baselineInfo.menuVersion) { $info.menuVersion }
} 20 'menuVersionChanged'
$afterApply = Get-PageData
$shot3 = Save-Shot '03-menu-applied.png'
Add-Step 'menu-apply' ([pscustomobject]@{
  evaluate = $evalApply.ok
  menuVersion = $afterApply.view.info.menuVersion
  catalogHash = $afterApply.view.info.catalogHash
  windowCount = $afterApply.view.info.windowCount
  dishCount = $afterApply.view.info.dishCount
  offerCount = $afterApply.view.info.offerCount
  statusText = $afterApply.statusText
  screenshot = $shot3
})

# --- 2. 取消：真实选文件后按“取消” ---------------------------------------------------------
$menuAfterApply = (Get-Data 'view.info.menuVersion')
$tapCancel = Invoke-WxTool 'automation_element_action' @('--project', $Project, '--action', 'tap', '--selector', 'button', '--wait', '1')
$cancelOut = Invoke-Dialog 'cancel' ''
if (($cancelOut -join ' ') -notmatch 'cancel-closed=True') { throw ('file dialog did not close on cancel: ' + ($cancelOut -join ' ')) }
Start-Sleep -Milliseconds 1200
$afterCancel = Get-PageData
$shot4 = Save-Shot '04-menu-cancel-pick.png'
Add-Step 'menu-pick-cancel' ([pscustomobject]@{
  tap = $tapCancel.ok
  dialog = ($cancelOut -join ' ')
  menuVersionUnchanged = ($afterCancel.view.info.menuVersion -eq $menuAfterApply)
  menuVersion = $afterCancel.view.info.menuVersion
  importFileName = $afterCancel.importFileName
  importTextLength = ([string]$afterCancel.importText).Length
  statusText = $afterCancel.statusText
  screenshot = $shot4
})

# --- 3. 非法文件：真实选中截断 JSON -> 预检失败 -> 阻止替换 ---------------------------------
$tapBad = Invoke-WxTool 'automation_element_action' @('--project', $Project, '--action', 'tap', '--selector', 'button', '--wait', '1')
$badOut = Invoke-Dialog 'pick' $invalidPath
Start-Sleep -Milliseconds 800
$afterBadPick = Get-PageData
$evalBadPre = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onPreflightMenu();return 'preflight-bad-triggered';}"
Start-Sleep -Milliseconds 1500
# 失败预检可能只体现在 errors/message 上（stage 有值与否取决于失败位置），三者任一出现即可读。
$badFailed = Wait-Until {
  $stage = Get-Data 'importStage'
  $errors = Get-Data 'importErrors'
  $message = Get-Data 'importMessage'
  if (($stage -and $stage -ne '') -or ($errors -and $errors.Count -gt 0) -or ($message -and $message -ne '')) { $true }
} 20 'importFailureVisible'
$afterBadPre = Get-PageData
$shot5 = Save-Shot '05-menu-invalid-preflight.png'
$evalBadApply = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onApplyMenu();return 'apply-bad-triggered';}"
Start-Sleep -Seconds 1
$afterBadApply = Get-PageData
Add-Step 'menu-invalid-file' ([pscustomobject]@{
  tap = $tapBad.ok
  dialog = ($badOut -join ' ')
  importFileName = $afterBadPick.importFileName
  importTextLength = ([string]$afterBadPick.importText).Length
  preflightStage = $afterBadPre.importStage
  preflightMessage = $afterBadPre.importMessage
  preflightErrors = $afterBadPre.importErrors
  importReady = $afterBadPre.importReady
  applyBlocked = (-not $afterBadApply.importReady)
  menuVersionUnchanged = ($afterBadApply.view.info.menuVersion -eq $menuAfterApply)
  statusText = $afterBadApply.statusText
  screenshot = $shot5
})

# --- 4. 恢复备份：导出真实文件 -> 真实选备份文件 -> 预检 -> 确认恢复 -------------------------
$evalExport = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onExportBackup();return 'export-triggered';}"
$backupReady = Wait-Until { (Get-Data 'backupReady') } 25 'backupReady'
$afterExport = Get-PageData
$shot6 = Save-Shot '06-menu-export.png'
$backupCopy = Join-Path $FixtureDir 'backup-exported.json'
$backupCopied = $false
# backupPath 是小程序侧 http://usr/... 虚拟路径，不是磁盘路径；从页面拿真实备份文本再落盘，
# 这样“选择恢复文件”读到的就是同一次导出的真实备份内容。返回值包成对象，避免字符串返回被
# 运行时再包一层 result 造成取值歧义。
$evalBackupText = Invoke-Eval "function(){var p=getCurrentPages();var pg=p[p.length-1];var t=pg.backupText;if(!t){t=wx.getFileSystemManager().readFileSync(pg.data.backupPath,'utf8');}return {text:String(t)};}"
$backupText = ''
$node = $evalBackupText.result.result
# 运行时可能把返回值再包一层 result，向下找到带 text 的对象为止（不猜测固定层数）。
for ($i = 0; $i -lt 5 -and $null -ne $node; $i++) {
  if ($node.PSObject.Properties.Name -contains 'text') { $backupText = [string]$node.text; break }
  if ($node.PSObject.Properties.Name -contains 'result') { $node = $node.result; continue }
  break
}
if ($backupText.Length -gt 0) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($backupCopy, $backupText, $utf8NoBom)
  $backupCopied = $true
}
Add-Step 'menu-export-backup' ([pscustomobject]@{
  evaluate = $evalExport.ok
  backupReady = $afterExport.backupReady
  backupDigest = $afterExport.backupDigest
  backupPath = $afterExport.backupPath
  backupCopiedTo = $(if ($backupCopied) { $backupCopy } else { '' })
  backupTextLength = $afterExport.backupTextLength
  backupTextWritten = $backupText.Length
  backupMessage = $afterExport.backupMessage
  screenshot = $shot6
})
if (-not $backupCopied) { throw 'backup file was not written; cannot test restore-from-file' }

$evalChooseRestore = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onChooseRestoreFile();return 'restore-choose-triggered';}"
$restorePickOut = Invoke-Dialog 'pick' $backupCopy
Start-Sleep -Milliseconds 800
$afterRestorePick = Get-PageData
$shot7 = Save-Shot '07-restore-file-selected.png'
Add-Step 'restore-pick-file' ([pscustomobject]@{
  evaluate = $evalChooseRestore.ok
  dialog = ($restorePickOut -join ' ')
  restoreFileName = $afterRestorePick.restoreFileName
  restoreTextLength = ([string]$afterRestorePick.restoreText).Length
  statusText = $afterRestorePick.statusText
  screenshot = $shot7
})

$evalRestorePre = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onPreflightRestore();return 'restore-preflight-triggered';}"
Start-Sleep -Milliseconds 1500
$restoreReady = Wait-Until {
  $ready = Get-Data 'restoreReady'
  $message = Get-Data 'restoreMessage'
  if ($ready -or ($message -and $message -ne '')) { $true }
} 20 'restorePreflightSettled'
$afterRestorePre = Get-PageData
$shot8 = Save-Shot '08-restore-preflight.png'
Add-Step 'restore-preflight' ([pscustomobject]@{
  evaluate = $evalRestorePre.ok
  restoreReady = $afterRestorePre.restoreReady
  restoreStage = $afterRestorePre.restoreStage
  restoreMessage = $afterRestorePre.restoreMessage
  restoreErrors = $afterRestorePre.restoreErrors
  restoreSummary = $afterRestorePre.restoreSummary
  restoreComparison = $afterRestorePre.restoreComparison
  screenshot = $shot8
})

$evalRestoreApply = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onApplyRestore();return 'restore-apply-triggered';}"
$restoreApplied = Wait-Until { (Get-Data 'restoreResultMessage') } 25 'restoreResultMessage'
$afterRestoreApply = Get-PageData
$shot9 = Save-Shot '09-restore-applied.png'
Add-Step 'restore-apply' ([pscustomobject]@{
  evaluate = $evalRestoreApply.ok
  restoreResultMessage = $afterRestoreApply.restoreResultMessage
  restoreDigestAfter = $afterRestoreApply.restoreDigestAfter
  restoreReady = $afterRestoreApply.restoreReady
  menuVersion = $afterRestoreApply.view.info.menuVersion
  statusText = $afterRestoreApply.statusText
  screenshot = $shot9
})

# --- 5. 非法恢复文件：真实选中菜单 JSON 当备份 -> 预检失败 ----------------------------------
$evalBadRestore = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onChooseRestoreFile();return 'restore-choose-bad-triggered';}"
$badRestoreOut = Invoke-Dialog 'pick' $validPath
Start-Sleep -Milliseconds 800
$afterBadRestorePick = Get-PageData
$shot10 = Save-Shot '10-restore-file-selected.png'
$evalBadRestorePre = Invoke-Eval "function(){var p=getCurrentPages();p[p.length-1].onPreflightRestore();return 'restore-preflight-bad-triggered';}"
Start-Sleep -Milliseconds 1500
$badRestoreStage = Wait-Until {
  $stage = Get-Data 'restoreStage'
  $errors = Get-Data 'restoreErrors'
  $message = Get-Data 'restoreMessage'
  if (($stage -and $stage -ne '') -or ($errors -and $errors.Count -gt 0) -or ($message -and $message -ne '')) { $true }
} 20 'restoreFailureVisible'
$afterBadRestorePre = Get-PageData
$shot11 = Save-Shot '11-restore-invalid-preflight.png'
Add-Step 'restore-invalid-file' ([pscustomobject]@{
  evaluate = $evalBadRestore.ok
  dialog = ($badRestoreOut -join ' ')
  restoreFileName = $afterBadRestorePick.restoreFileName
  restoreTextLength = ([string]$afterBadRestorePick.restoreText).Length
  restoreStage = $afterBadRestorePre.restoreStage
  restoreMessage = $afterBadRestorePre.restoreMessage
  restoreErrors = $afterBadRestorePre.restoreErrors
  restoreReady = $afterBadRestorePre.restoreReady
  screenshot = $shot11
})

# --- 6. 四个页面截图（首页/档案/记餐/菜单） -------------------------------------------------
$pageShots = @()
foreach ($p in @(
  @{ name = '12-page-home.png'; page = 'pages/home/index' },
  @{ name = '13-page-profile.png'; page = 'pages/profile/index' },
  @{ name = '14-page-logs.png'; page = 'pages/logs/index' },
  @{ name = '15-page-menu.png'; page = 'pages/menu/index' }
)) {
  $o = Invoke-WxTool 'simulator_open_page' @('--project', $Project, '--page', $p.page)
  Start-Sleep -Seconds 2
  $shot = Save-Shot $p.name
  $pageShots += [pscustomobject]@{ page = $p.page; opened = $o.ok; screenshot = $shot.file; width = $shot.width; height = $shot.height; png = $shot.png; bytes = $shot.bytes }
}
Add-Step 'page-screenshots' ([pscustomobject]@{ pages = $pageShots })

# --- 7. 汇总 -------------------------------------------------------------------------------
$summary = [pscustomobject]@{
  project = $Project
  fixtureDir = $FixtureDir
  validMenu = [pscustomobject]@{ path = $validPath; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $validPath).Hash.ToLower() }
  invalidMenu = [pscustomobject]@{ path = $invalidPath; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $invalidPath).Hash.ToLower() }
  backupFile = $backupCopy
  steps = $Steps.Count
  logFile = (Join-Path $OutDir 'log.json')
}
$Steps | ConvertTo-Json -Depth 20 | Set-Content -Path (Join-Path $OutDir 'log.json') -Encoding UTF8
$summary | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $OutDir 'summary.json') -Encoding UTF8
Write-Output ('DONE steps=' + $Steps.Count + ' out=' + $OutDir)