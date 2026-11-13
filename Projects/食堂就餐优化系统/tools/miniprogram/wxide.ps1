# wxide.ps1 -- thin, UTF-8 safe wrapper around the WeChat DevTools automation CLI.
#
# Every CLI call redirects stdout/stderr to temp files and decodes stdout as UTF-8. The CLI
# prints skill-call logs on stderr and JSON on stdout; PowerShell 5.1 native-command decoding
# would mangle UTF-8, so we never pipe the CLI directly.
# NOTE: ASCII-only so Windows PowerShell 5.1 (ANSI code page) can always parse this file.
param(
  [Parameter(Mandatory=$true)][string]$Action,
  [string]$Project = '',
  [string]$Page = '',
  [string]$Selector = '',
  [string]$PathValue = '',
  [string]$DataPath = '',
  [string]$Tool = '',
  [string]$ArgsJson = '',
  [string]$Url = '',
  [int]$WaitSec = 3
)

$ErrorActionPreference = 'Stop'
# The CLI emits UTF-8 JSON on stdout; tell PowerShell how to decode native stdout.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# Keep this file ASCII-only: Windows PowerShell 5.1 reads scripts with the ANSI code page, so
# Chinese literals here would be mojibake and break paths. Derive paths from $PSScriptRoot and
# locate the DevTools install by probing for wechatide.cmd instead of hard-coding Chinese names.
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot)
$WorkspaceRoot = Split-Path (Split-Path $ProjectRoot)
if ($Project -eq '') { $Project = Join-Path $ProjectRoot 'miniprogram' }
$Tmp = Join-Path $WorkspaceRoot '.toolchain\tmp\t05v2'
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
if (-not $Wx) { throw 'wechatide.cmd not found under D:\ (expected DevTools install root)' }

if (-not ('DshWin32T05' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class DshWin32T05 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public static List<string> List() {
    var rows = new List<string>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var t = new StringBuilder(512); GetWindowText(h, t, 512);
      var c = new StringBuilder(256); GetClassName(h, c, 256);
      RECT r; GetWindowRect(h, out r);
      rows.Add(string.Format("{0}\t{1}\t{2}\t{3},{4}\t{5}", h.ToInt64(), c.ToString(), t.ToString(), r.Left, r.Top, (r.Right - r.Left) + "x" + (r.Bottom - r.Top)));
      return true;
    }, IntPtr.Zero);
    return rows;
  }
}
'@
}

function Invoke-WxTool([string]$toolName, [string[]]$toolArgs) {
  # wechatide writes "[wechatide] skill-call: ..." to stderr; keep native stderr non-terminating
  # and extract the JSON envelope from the combined text (stdout + stderr records).
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
  if ($start -lt 0 -or $end -lt $start) {
    throw "wechatide $toolName returned no JSON envelope. output=$text"
  }
  return ($text.Substring($start, $end - $start + 1) | ConvertFrom-Json)
}

function Find-DialogWindow {
  foreach ($row in [DshWin32T05]::List()) {
    $p = $row -split "`t"
    # Win32 common file dialog uses class #32770. Title is locale dependent, so match the class
    # first and only fall back to English titles to stay ASCII-safe in this script file.
    if ($p[1] -eq '#32770') { return @{ hwnd = [int64]$p[0]; title = $p[2]; cls = $p[1] } }
    if ($p[2] -match '^(Open|Choose|Select)') { return @{ hwnd = [int64]$p[0]; title = $p[2]; cls = $p[1] } }
  }
  return $null
}

switch ($Action) {
  'open-page' {
    (Invoke-WxTool 'simulator_open_page' @('--project', $Project, '--page', $Page)) | ConvertTo-Json -Depth 20
  }
  'nav' {
    (Invoke-WxTool 'automation_navigate' @('--project', $Project, '--action', 'reLaunch', '--url', $Url)) | ConvertTo-Json -Depth 20
  }
  'page' {
    $args = @('--project', $Project, '--action', 'getData')
    if ($DataPath -ne '') { $args += @('--data-path', $DataPath) }
    (Invoke-WxTool 'automation_page_action' $args) | ConvertTo-Json -Depth 30
  }
  'data' {
    # Print only the requested page-data path value, compact. Avoids dumping whole page data.
    $obj = Invoke-WxTool 'automation_page_action' @('--project', $Project, '--action', 'getData')
    $cur = $obj.result.data
    foreach ($seg in $DataPath.Split('.')) {
      if ($null -eq $cur) { break }
      $cur = $cur.$seg
    }
    if ($null -eq $cur) { 'null' } else { $cur | ConvertTo-Json -Depth 20 -Compress }
  }
  'tap' {
    (Invoke-WxTool 'automation_element_action' @('--project', $Project, '--action', 'tap', '--selector', $Selector, '--wait', '1')) | ConvertTo-Json -Depth 20
  }
  'text' {
    (Invoke-WxTool 'automation_element_action' @('--project', $Project, '--action', 'text', '--selector', $Selector)) | ConvertTo-Json -Depth 20
  }
  'wxml' {
    (Invoke-WxTool 'automation_element_action' @('--project', $Project, '--action', 'outerWxml', '--selector', $Selector)) | ConvertTo-Json -Depth 20
  }
  'call' {
    $args = @('--project', $Project, '--action', 'callMethod', '--method', $Page)
    if ($ArgsJson -ne '') { $args += @('--args', $ArgsJson) }
    (Invoke-WxTool 'automation_page_action' $args) | ConvertTo-Json -Depth 30
  }
  'evaluate' {
    (Invoke-WxTool 'automation_evaluate' @('--project', $Project, '--fn-source', $ArgsJson)) | ConvertTo-Json -Depth 30
  }
  'shot' {
    $obj = Invoke-WxTool 'simulator_screenshot' @('--project', $Project, '--path', $PathValue, '--wait', '1', '--optimize', 'false')
    $obj | ConvertTo-Json -Depth 20
  }
  'console' {
    (Invoke-WxTool 'get_simulator_console' @('--project', $Project, '--command', $ArgsJson)) | ConvertTo-Json -Depth 20
  }
  'tool' {
    $args = @('--project', $Project)
    if ($ArgsJson -ne '') { $args += (($ArgsJson | ConvertFrom-Json) | ForEach-Object { [string]$_ }) }
    (Invoke-WxTool $Tool $args) | ConvertTo-Json -Depth 30
  }
  'windows' {
    foreach ($row in [DshWin32T05]::List()) {
      $p = $row -split "`t"
      if (($PathValue -ne '') -and ($p[2] -notlike "*$PathValue*")) { continue }
      'hwnd={0} class={1} origin={2} size={3} title={4}' -f $p[0], $p[1], $p[3], $p[4], $p[2]
    }
  }
  'dialog-wait' {
    $found = $null
    for ($i = 0; $i -lt ($WaitSec * 2); $i++) {
      $found = Find-DialogWindow
      if ($found -ne $null) { break }
      Start-Sleep -Milliseconds 500
    }
    if ($found -eq $null) { 'dialog=NOT_FOUND'; exit 2 }
    'dialog=FOUND hwnd={0} cls={1} title={2}' -f $found.hwnd, $found.cls, $found.title
  }
  'send-file' {
    $found = Find-DialogWindow
    if ($found -eq $null) { throw 'no dialog window found' }
    [void][DshWin32T05]::ShowWindow([IntPtr]$found.hwnd, 9)
    [void][DshWin32T05]::SetForegroundWindow([IntPtr]$found.hwnd)
    Start-Sleep -Milliseconds 600
    $shell = New-Object -ComObject WScript.Shell
    $shell.SendKeys($PathValue)
    Start-Sleep -Milliseconds 400
    $shell.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 2500
    'sent ' + $PathValue
  }
  'send-esc' {
    $found = Find-DialogWindow
    if ($found -eq $null) { throw 'no dialog window found' }
    [void][DshWin32T05]::ShowWindow([IntPtr]$found.hwnd, 9)
    [void][DshWin32T05]::SetForegroundWindow([IntPtr]$found.hwnd)
    Start-Sleep -Milliseconds 600
    $shell = New-Object -ComObject WScript.Shell
    $shell.SendKeys('{ESC}')
    Start-Sleep -Milliseconds 1500
    'cancelled'
  }
  default { throw "unknown action: $Action" }
}