# Takes a screenshot of each page in screens.json with headless Microsoft Edge, at the exact size, into figures\<name>.png.
# Usage: node <skill>/run.js screenshots, or by hand: powershell -NoProfile -ExecutionPolicy Bypass -File shoot.ps1 [-Source <Source folder>]
# Headless Edge paints a smaller area than its window (the gap was 93 px on Edge for Windows in Nov 2026). This
# script measures the gap on a test page first, takes each screenshot with a window that is taller by the gap, and
# cuts the picture to the asked size.
# CAUTION: headless Edge has no saved sign-ins. A page behind a login shows the login page: capture it with a browser
# tool that the user signs in to, and never type a password for the user.
param([string]$Source = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$b = (Resolve-Path $Source).Path
$cfg = Get-Content "$b\screens.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$edge = if ($env:EDGE) { $env:EDGE } else { 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$tmp = [IO.Path]::Combine($b, 'render'); New-Item -ItemType Directory -Force $tmp, ([IO.Path]::Combine($b, 'figures')) | Out-Null

function Shoot([string]$url, [int]$w, [int]$h, [string]$png, [int]$wait) {
  # Edge writes log lines to stderr; Windows PowerShell 5.1 would stop on them with 'Stop'.
  $ErrorActionPreference = 'Continue'
  & $edge --headless=new --disable-gpu --hide-scrollbars "--window-size=$w,$h" "--virtual-time-budget=$wait" "--screenshot=$png" $url 2>$null | Out-Null
  for ($i = 0; $i -lt 50 -and -not (Test-Path $png); $i++) { Start-Sleep -Milliseconds 100 }
  if (-not (Test-Path $png)) { throw "no screenshot from Edge for $url" }
}

# The gap: a page with a black block taller than the window; the painted black rows show the real height.
$cal = [IO.Path]::Combine($tmp, '_calibrate.html'); $calPng = [IO.Path]::Combine($tmp, '_calibrate.png')
Set-Content $cal '<html><body style="margin:0;background:#fff"><div style="height:2000px;background:#000"></div></body></html>'
Remove-Item $calPng -ErrorAction SilentlyContinue
Shoot ('file:///' + ($cal -replace '\\', '/')) 800 600 $calPng 500
$bm = [Drawing.Bitmap]::FromFile($calPng); $rows = 0
while ($rows -lt $bm.Height -and $bm.GetPixel(400, $rows).R -lt 128) { $rows++ }
$bm.Dispose(); Remove-Item $cal, $calPng
$gap = 600 - $rows; "window gap: $gap px"

foreach ($s in $cfg.screens) {
  $w = if ($s.width) { [int]$s.width } else { [int]$cfg.width }
  $h = if ($s.height) { [int]$s.height } else { [int]$cfg.height }
  $wait = if ($cfg.wait) { [int]$cfg.wait } else { 3000 }
  $raw = [IO.Path]::Combine($tmp, "$($s.name)-raw.png"); $out = [IO.Path]::Combine($b, 'figures', "$($s.name).png")
  Remove-Item $raw -ErrorAction SilentlyContinue
  Shoot $s.url $w ($h + $gap) $raw $wait
  $bm = [Drawing.Bitmap]::FromFile($raw)
  $part = $bm.Clone((New-Object Drawing.Rectangle 0, 0, $w, $h), $bm.PixelFormat); $bm.Dispose()
  $part.Save($out, [Drawing.Imaging.ImageFormat]::Png); $part.Dispose(); Remove-Item $raw
  "figures\$($s.name).png ($w x $h) from $($s.url)"
}
