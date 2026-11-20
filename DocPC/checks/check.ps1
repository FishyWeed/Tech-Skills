# Checks a built PDF: page count, landscape pages, placeholders left, broken Word fields, notes in [brackets] and
# captions that start a page (cut from their figure). The text checks need pdftotext (Poppler; Git for Windows has it).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1 -Pdf <file.pdf> [-AllowLandscape]
# It reports; it does not change the file. Look at the rendered pages too (render.ps1): this script cannot see the layout.
param([Parameter(Mandatory)][string]$Pdf, [switch]$AllowLandscape)
$ErrorActionPreference = 'Stop'
$Pdf = (Resolve-Path $Pdf).Path
$problems = 0

# Page count and orientation with the Windows PDF engine.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$asOp = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asOp.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync((Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Pdf)) ([Windows.Storage.StorageFile])))) ([Windows.Data.Pdf.PdfDocument])
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
    if ($t -match '^\[[^\]]{3,}\]$') { "page ${n}: note: $t" }
  }
  # The first line is the page header; a caption right under it has lost its figure or table.
  if ($lines.Count -gt 1 -and $lines[1].Trim() -match '^Figure \d+:') { "page ${n}: starts with a figure caption: $($lines[1].Trim())"; $problems++ }
}
if ($problems) { "problems: $problems" } else { 'no problems found' }
exit $problems
