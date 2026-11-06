' EGDesk SMS auto update (run by Task Scheduler). Runs scripts\pc\update.mjs --auto without a window.
' Log: %LOCALAPPDATA%\EgdeskSms\autoupdate.log  (registered by autoupdate-on.cmd, removed by autoupdate-off.cmd)
Option Explicit
Dim fso, sh, root, logDir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
logDir = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\EgdeskSms"
If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir
sh.CurrentDirectory = root
cmd = "cmd /c chcp 65001 >nul & node scripts\pc\update.mjs --auto >> """ & logDir & "\autoupdate.log"" 2>&1"
sh.Run cmd, 0, True
