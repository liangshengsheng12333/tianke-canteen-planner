# capture-window.ps1 -- capture real desktop pixels of the DevTools window / desktop.
# Why: wechatide simulator_screenshot only captures the mini-program render surface; T05 also
# needs evidence of the DevTools window itself and of native dialogs (file picker) triggered
# by wx.chooseMessageFile. This helper only takes screenshots: it does not drive the app.
# NOTE: intentionally ASCII-only so that Windows PowerShell 5.1 (ANSI code page) can parse it.
param(
  [string]$Out = '',
  [string]$ProcessName = '',
  [switch]$BringToFront,
  [int]$WaitMs = 500
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$signature = @'
using System;
using System.Runtime.InteropServices;
public static class DshWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
if (-not ('DshWin32' -as [type])) { Add-Type -TypeDefinition $signature }

if ($Out -eq '') { throw 'Out is required' }
$dir = Split-Path -Parent $Out
if ($dir -ne '' -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

function Save-Screen([System.Drawing.Rectangle]$bounds, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $gfx.Dispose()
  $bmp.Dispose()
}

$target = [IntPtr]::Zero
if ($ProcessName -ne '') {
  $proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1
  if ($proc) {
    $target = $proc.MainWindowHandle
    if ($BringToFront) {
      [void][DshWin32]::ShowWindow($target, 9)
      [void][DshWin32]::SetForegroundWindow($target)
      Start-Sleep -Milliseconds $WaitMs
    }
  }
}

if ($target -eq [IntPtr]::Zero) {
  $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
  Save-Screen $bounds $Out
  Write-Output ("desktop {0}x{1} origin={2},{3} -> {4}" -f $bounds.Width, $bounds.Height, $bounds.Left, $bounds.Top, $Out)
  exit 0
}

$rect = New-Object DshWin32+RECT
if (-not [DshWin32]::GetWindowRect($target, [ref]$rect)) { throw 'GetWindowRect failed' }
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

if ($BringToFront) {
  $bounds = New-Object System.Drawing.Rectangle($rect.Left, $rect.Top, $width, $height)
  Save-Screen $bounds $Out
  Write-Output ("window-screen {0}x{1} origin={2},{3} -> {4}" -f $width, $height, $rect.Left, $rect.Top, $Out)
  exit 0
}

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
$ok = [DshWin32]::PrintWindow($target, $hdc, 2)
$graphics.ReleaseHdc($hdc)
$graphics.Dispose()
$bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Write-Output ("window-printwindow ok={0} {1}x{2} -> {3}" -f $ok, $width, $height, $Out)