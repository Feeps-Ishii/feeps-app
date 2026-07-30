# 指定した時刻に本番デプロイを実行する（Windowsのタスクスケジューラへ1回だけ登録する）。
#
#   powershell -ExecutionPolicy Bypass -File deploy-at.ps1 -At "21:00"
#   powershell -ExecutionPolicy Bypass -File deploy-at.ps1 -At "2026-07-29 06:30"
#   powershell -ExecutionPolicy Bypass -File deploy-at.ps1 -Cancel   … 予約を取り消す
#   powershell -ExecutionPolicy Bypass -File deploy-at.ps1 -Status   … 予約を確認する
#
# 時刻だけを渡した場合、その時刻が既に過ぎていれば翌日として扱う。
# ログは deploy-at.log に残る。ターミナルを閉じても実行されるが、**PCがシャットダウン／
# スリープしていると実行されない**。確実に出したい場合は起動したままにしておくこと。
param(
  [string]$At,
  [switch]$Cancel,
  [switch]$Status
)

$ErrorActionPreference = "Stop"
$TaskName = "FeepsOne-Deploy-Frontend"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogPath = Join-Path $Here "deploy-at.log"

function Show-Status {
  $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $t) { Write-Host "[deploy-at] 予約はありません。"; return }
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Host "[deploy-at] 予約あり"
  Write-Host ("  次回実行 : " + $info.NextRunTime)
  Write-Host ("  前回実行 : " + $info.LastRunTime + "  結果=" + $info.LastTaskResult)
  Write-Host ("  ログ     : " + $LogPath)
}

if ($Status) { Show-Status; exit 0 }

if ($Cancel) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[deploy-at] 予約を取り消しました。"
  } else {
    Write-Host "[deploy-at] 予約はありません。"
  }
  exit 0
}

if (-not $At) {
  Write-Host "使い方: deploy-at.ps1 -At `"21:00`" | -Cancel | -Status"
  exit 1
}

# 時刻の解釈。"21:00" だけなら今日の21:00、既に過ぎていれば翌日。
try { $when = [datetime]::Parse($At) } catch {
  Write-Host "[deploy-at] ERROR: 時刻を解釈できません: $At"
  exit 1
}
if ($At -notmatch "[-/]" -and $when -lt (Get-Date)) { $when = $when.AddDays(1) }
if ($when -lt (Get-Date)) {
  Write-Host "[deploy-at] ERROR: 指定時刻が過去です: $when"
  exit 1
}

# 研修日の日中は避ける（受講生が打刻・日報・テストを行う時間）
$h = $when.Hour + $when.Minute / 60.0
if ($when.DayOfWeek -ne "Saturday" -and $when.DayOfWeek -ne "Sunday" -and $h -ge 8.5 -and $h -lt 18.5) {
  Write-Host ""
  Write-Host "[deploy-at] 注意: 指定時刻 $when は平日の 8:30-18:30 です。"
  Write-Host "[deploy-at] 研修日であれば受講生の打刻・日報・テストの時間にあたります。"
  $ans = Read-Host "この時刻で予約しますか？ (yes/no)"
  if ($ans -ne "yes") { Write-Host "[deploy-at] 中止しました。"; exit 1 }
}

$deploy = Join-Path $Here "deploy.bat"
if (-not (Test-Path $deploy)) { Write-Host "[deploy-at] ERROR: deploy.bat が見つかりません: $deploy"; exit 1 }

# cmd 経由で deploy.bat を実行し、出力をログへ追記する
$cmd = "/c cd /d `"$Here`" && echo ===== %DATE% %TIME% ===== >> `"$LogPath`" && call `"$deploy`" >> `"$LogPath`" 2>&1"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $cmd
$trigger = New-ScheduledTaskTrigger -Once -At $when
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Feeps One フロントエンドの予約デプロイ（1回のみ）" | Out-Null

Write-Host ""
Write-Host "[deploy-at] 予約しました。"
Write-Host ("  実行時刻 : " + $when.ToString("yyyy/MM/dd HH:mm"))
Write-Host ("  内容     : deploy.bat（ビルド → 本番の退避 → S3同期 → CloudFront無効化）")
Write-Host ("  ログ     : " + $LogPath)
Write-Host ""
Write-Host "  取り消し : powershell -ExecutionPolicy Bypass -File deploy-at.ps1 -Cancel"
Write-Host "  確認     : powershell -ExecutionPolicy Bypass -File deploy-at.ps1 -Status"
Write-Host ""
Write-Host "  ※ PCがシャットダウン／スリープしていると実行されません。"
