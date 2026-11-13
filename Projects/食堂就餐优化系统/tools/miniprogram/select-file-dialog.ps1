# select-file-dialog.ps1 -- pick a real file in the native Windows file dialog opened by
# wx.chooseMessageFile inside WeChat DevTools. Used only as evidence tooling for T05.
#
# Strategy (most robust first):
#   1) UI Automation: set the "File name" edit (AutomationId 1148) and invoke the Open button
#      (AutomationId 1). Works without stealing focus.
#   2) Fallback: Win32 GetDlgItem(1148)/GetDlgItem(1152) + WM_SETTEXT, then BM_CLICK on ID 1.
#   3) Last resort: focus the dialog and type the path via SendKeys, then Enter.
# -Cancel sends Escape to the dialog (cancel path evidence).
#
# NOTE: ASCII-only file content so Windows PowerShell 5.1 can parse it reliably.
param(
  [Parameter(Mandatory=$true)][string]$Action,   # pick | cancel | probe
  [string]$Path = '',
  [string]$WindowTitleLike = '',
  [int]$WaitSec = 10
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$sig = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class DshFileDlg {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumChildProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr dlg, int id);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  public static List<IntPtr> TopLevel() {
    var list = new List<IntPtr>();
    EnumWindows((h, l) => { if (IsWindowVisible(h)) list.Add(h); return true; }, IntPtr.Zero);
    return list;
  }
  public static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
  public static string Class(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
  public static List<IntPtr> Children(IntPtr parent) {
    var list = new List<IntPtr>();
    EnumChildWindows(parent, (h, l) => { list.Add(h); return true; }, IntPtr.Zero);
    return list;
  }
  public static int CtrlId(IntPtr h) { return GetDlgCtrlID(h); }
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr hWnd);
  public static void SetText(IntPtr h, string text) { SendMessage(h, 0x000C, IntPtr.Zero, text); }
  public static void Click(IntPtr h) { SendMessage(h, 0x00F5, IntPtr.Zero, IntPtr.Zero); }
}
'@
if (-not ('DshFileDlg' -as [type])) { Add-Type -TypeDefinition $sig }

function Find-FileDialog {
  $deadline = (Get-Date).AddSeconds($WaitSec)
  while ((Get-Date) -lt $deadline) {
    foreach ($h in [DshFileDlg]::TopLevel()) {
      if ([DshFileDlg]::Class($h) -eq '#32770') {
        $title = [DshFileDlg]::Title($h)
        if ($WindowTitleLike -eq '' -or $title -like "*$WindowTitleLike*") { return $h }
      }
    }
    Start-Sleep -Milliseconds 400
  }
  return [IntPtr]::Zero
}

function Use-Uia([IntPtr]$dlg, [string]$path) {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($dlg)
  if ($null -eq $root) { return $false }
  $byId = { param($id) New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, $id) }
  $edit = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (& $byId '1148'))
  if ($null -eq $edit) {
    # Some Windows builds expose the file name box with ID 1001 (combo) or as an Edit named "File name".
    $edit = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (& $byId '1152'))
  }
  if ($null -eq $edit) { return $false }
  try {
    $pattern = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $pattern.SetValue($path)
  } catch {
    return $false
  }
  $open = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (& $byId '1'))
  if ($null -eq $open) { return $false }
  try {
    $invoke = $open.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invoke.Invoke()
  } catch {
    return $false
  }
  return $true
}

function Use-Win32([IntPtr]$dlg, [string]$path) {
  $edit = [DshFileDlg]::GetDlgItem($dlg, 1148)
  if ($edit -eq [IntPtr]::Zero) { $edit = [DshFileDlg]::GetDlgItem($dlg, 1152) }
  if ($edit -eq [IntPtr]::Zero) { return $false }
  [DshFileDlg]::SetText($edit, $path)
  Start-Sleep -Milliseconds 300
  $open = [DshFileDlg]::GetDlgItem($dlg, 1)
  if ($open -eq [IntPtr]::Zero) { return $false }
  [DshFileDlg]::Click($open)
  return $true
}

function Use-SendKeys([IntPtr]$dlg, [string]$path) {
  [void][DshFileDlg]::ShowWindow($dlg, 9)
  [void][DshFileDlg]::SetForegroundWindow($dlg)
  Start-Sleep -Milliseconds 600
  $shell = New-Object -ComObject WScript.Shell
  $shell.SendKeys($path)
  Start-Sleep -Milliseconds 400
  $shell.SendKeys('{ENTER}')
  return $true
}

$dlg = Find-FileDialog
if ($dlg -eq [IntPtr]::Zero) { Write-Output 'dialog=NOT_FOUND'; exit 2 }
Write-Output ('dialog=' + $dlg + ' title=' + [DshFileDlg]::Title($dlg))

if ($Action -eq 'probe') {
  foreach ($h in [DshFileDlg]::Children($dlg)) {
    $cls = [DshFileDlg]::Class($h)
    $id = [DshFileDlg]::CtrlId($h)
    $text = [DshFileDlg]::Title($h)
    if ($cls -match 'Edit|ComboBox|Button') { 'child class={0} id={1} text=[{2}]' -f $cls, $id, $text }
  }
  exit 0
}

if ($Action -eq 'cancel') {
  # Cancel = click the dialog's own Cancel button (control id 2). Win32 BM_CLICK is used first
  # because it targets the dialog subtree directly and does not depend on foreground focus.
  # UIA is only a fallback, and the dialog must actually disappear before we report success.
  $button = [DshFileDlg]::GetDlgItem($dlg, 2)
  if ($button -ne [IntPtr]::Zero) { [DshFileDlg]::Click($button) }
  $closed = $false
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Milliseconds 300
    if (-not [DshFileDlg]::IsWindowVisible($dlg)) { $closed = $true; break }
  }
  if (-not $closed) {
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($dlg)
      $byId = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '2')
      $uiaButton = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $byId)
      if ($null -ne $uiaButton) {
        $invoke = $uiaButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $invoke.Invoke()
        Start-Sleep -Milliseconds 800
        $closed = -not [DshFileDlg]::IsWindowVisible($dlg)
      }
    } catch { $closed = $false }
  }
  Write-Output ('cancel-closed=' + $closed)
  if (-not $closed) { exit 3 }
  exit 0
}

if ($Action -ne 'pick') { throw 'unknown action' }

$ok = $false
try { $ok = Use-Uia $dlg $Path } catch { $ok = $false }
if (-not $ok) { try { $ok = Use-Win32 $dlg $Path } catch { $ok = $false } }
if (-not $ok) { $ok = Use-SendKeys $dlg $Path }
Write-Output ('pick-sent=' + $ok + ' path=' + $Path)