# list-windows.ps1 -- list visible top-level windows (hwnd/pid/class/title/rect).
# Used only to locate the native file-picker dialog opened by WeChat DevTools when the
# mini program calls wx.chooseMessageFile. Read-only enumeration: no clicks, no changes.
# NOTE: intentionally ASCII-only so that Windows PowerShell 5.1 (ANSI code page) can parse it.
param(
  [string]$TitleLike = ''
)

$ErrorActionPreference = 'Stop'
$signature = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class DshEnumWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public static List<string> List() {
    var rows = new List<string>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var title = new StringBuilder(512);
      GetWindowText(h, title, 512);
      var cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      uint pid; GetWindowThreadProcessId(h, out pid);
      RECT r; GetWindowRect(h, out r);
      rows.Add(string.Format("{0}\t{1}\t{2}\t{3}\t{4}\t{5}\t{6}", h.ToInt64(), pid, cls.ToString(), title.ToString(), r.Left, r.Top, (r.Right - r.Left) + "x" + (r.Bottom - r.Top)));
      return true;
    }, IntPtr.Zero);
    return rows;
  }
  public static long Foreground() { return GetForegroundWindow().ToInt64(); }
}
'@
if (-not ('DshEnumWin' -as [type])) { Add-Type -TypeDefinition $signature }

$fg = [DshEnumWin]::Foreground()
$rows = [DshEnumWin]::List()
foreach ($row in $rows) {
  $parts = $row -split "`t"
  if (($TitleLike -ne '') -and ($parts[3] -notlike "*$TitleLike*")) { continue }
  $mark = if ([int64]$parts[0] -eq $fg) { 'FG' } else { '  ' }
  '{0} hwnd={1} pid={2} class={3} origin={4},{5} size={6} title={7}' -f $mark, $parts[0], $parts[1], $parts[2], $parts[4], $parts[5], $parts[6], $parts[3]
}