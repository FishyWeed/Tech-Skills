# Checks a built PDF: page count, landscape pages, placeholders left, broken Word fields and notes in [brackets].
# The text checks need pdftotext (Poppler; Git for Windows has it). A caption cut from its figure or table is
# checked in Word by assemble.ps1, because a picture has no text in the PDF.
# Usage: node <skill>/run.js check <file.pdf> [--landscape], or
#        powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1 -Pdf <file.pdf> [-AllowLandscape]
# It reports; it does not change the file. Look at the rendered pages too (render.ps1): this script cannot see the layout.
param([Parameter(Mandatory)][string]$Pdf, [switch]$AllowLandscape)
$ErrorActionPreference = 'Stop'
$Pdf = (Resolve-Path $Pdf).Path
$problems = 0

# Page count and orientation with the Windows PDF engine.
. "$PSScriptRoot\..\..\lib\winpdf.ps1"
$doc = Open-Pdf $Pdf
"pages: $($doc.PageCount)"
$land = @(); for ($i = 0; $i -lt $doc.PageCount; $i++) { $p = $doc.GetPage($i); if ($p.Size.Width -gt $p.Size.Height) { $land += $i + 1 }; $p.Dispose() }
if ($land) { "landscape pages: $($land -join ', ')"; if (-not $AllowLandscape) { $problems++ } }

# Text checks.
$tool = (Get-Command pdftotext -ErrorAction SilentlyContinue).Source
if (-not $tool -and (Test-Path 'C:\Program Files\Git\mingw64\bin\pdftotext.exe')) { $tool = 'C:\Program Files\Git\mingw64\bin\pdftotext.exe' }
if (-not $tool) { 'pdftotext not found: text checks skipped'; exit $problems }
$tmp = [IO.Path]::GetTempFileName()
& $tool -layout -enc UTF-8 $Pdf $tmp
$pagesText = (Get-Content $tmp -Raw -Encoding UTF8) -split "`f"; Remove-Item $tmp
for ($i = 0; $i -lt $pagesText.Count; $i++) {
  $n = $i + 1; $lines = @($pagesText[$i] -split "`r?`n" | Where-Object { $_.Trim() })
  foreach ($l in $lines) {
    $t = $l.Trim()
    if ($t -match '\[\[[^\]]*\]\]') { "page ${n}: placeholder left: $($Matches[0])"; $problems++ }
    if ($t -match 'Error! [^.]*') { "page ${n}: broken Word field: $($Matches[0])"; $problems++ }
    # A note in brackets, also inside a table cell. Citation brackets ([Online], [Accessed ...], [1]) are not notes.
    foreach ($m in [regex]::Matches($t, '(?<!\[)\[([^\[\]]{3,})\](?!\])')) {
      if ($m.Groups[1].Value -notmatch '^(Online|Accessed\b|\d)') { "page ${n}: note: $($m.Value)" }
    }
  }
}
if ($problems) { "problems: $problems" } else { 'no problems found' }
exit $problems
