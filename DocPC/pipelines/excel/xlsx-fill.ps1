# Fills an Excel form (for example a workload matrix) from xlsx.json, with Microsoft Excel, and saves a copy in Outputs\.
# The template opens read-only and does not change. Relative paths in xlsx.json are relative to the Source folder.
# Usage: node <skill>/run.js excel, or by hand: powershell -NoProfile -ExecutionPolicy Bypass -File xlsx-fill.ps1 [-Source <Source folder>]
# CAUTION: put a signature in only when the user allows it for this form.
param([string]$Source = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$b = (Resolve-Path $Source).Path
$cfg = Get-Content "$b\xlsx.json" -Raw -Encoding UTF8 | ConvertFrom-Json
function Full($p) { if ([IO.Path]::IsPathRooted($p)) { $p } else { [IO.Path]::GetFullPath([IO.Path]::Combine($b, $p)) } }
$tpl = Full $cfg.template
# Paths for Office must be plain strings: a Join-Path result can make a save hang without an error.
$outDir = [IO.Path]::Combine((Split-Path $b), 'Outputs'); New-Item -ItemType Directory -Force $outDir | Out-Null
$out = [IO.Path]::Combine($outDir, "$($cfg.output).xlsx")
$x = New-Object -ComObject Excel.Application; $x.Visible = $false; $x.DisplayAlerts = $false
# "Sheet name!B3" or just "B3" (the first sheet).
function Target($wb, $addr) { if ($addr -match '^(.+)!(.+)$') { $wb.Worksheets.Item($Matches[1]).Range($Matches[2]) } else { $wb.Worksheets.Item(1).Range($addr) } }
try {
  $wb = $x.Workbooks.Open($tpl, 0, $true)
  foreach ($p in $cfg.cells.PSObject.Properties) { (Target $wb $p.Name).Value2 = $p.Value; "$($p.Name) = $($p.Value)" }
  if ($cfg.signature -and $cfg.signature.image) {
    $img = Full $cfg.signature.image; $cell = Target $wb $cfg.signature.cell
    # A picture in the cell (Excel 365) moves and sizes with the cell; older Excel gets a picture placed over the cell.
    try { $cell.InsertPictureInCell($img) | Out-Null; "signature in cell $($cfg.signature.cell)" }
    catch {
      $s = $cell.Worksheet.Shapes.AddPicture($img, 0, -1, $cell.Left + 2, $cell.Top + 2, -1, -1)
      $s.LockAspectRatio = -1; $s.Height = [Math]::Min($s.Height, $cell.Height - 4); if ($s.Width -gt $cell.Width - 4) { $s.Width = $cell.Width - 4 }
      "signature placed over cell $($cfg.signature.cell)"
    }
  }
  $wb.SaveAs($out, 51); "saved $out"
  $wb.Close($false)
} finally { $x.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($x) | Out-Null }
