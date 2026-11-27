# Renders PDF pages to PNG with the Windows PDF engine, to look at them or to use them as images.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File render.ps1 -Pdf <file.pdf> -Out <prefix> [-Pages "1,5,9"] [-Width 1400]
# Writes <prefix><page>.png. No -Pages = all pages. -Pages is text: powershell -File passes a list as one string.
# CAUTION: run it with powershell -File (a child process). In a shell session that stays open, the engine keeps the PDF
# locked, and a later Word export to the same PDF fails without an error.
param([Parameter(Mandatory)][string]$Pdf, [Parameter(Mandatory)][string]$Out, [string]$Pages, [int]$Width = 1400)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\lib\winpdf.ps1"
$doc = Open-Pdf $Pdf
$list = if ($Pages) { $Pages -split '[,\s]+' | Where-Object { $_ } | ForEach-Object { [int]$_ } } else { 1..$doc.PageCount }
New-Item -ItemType Directory -Force (Split-Path -Parent ([IO.Path]::GetFullPath($Out))) | Out-Null
foreach ($n in $list) {
  if ($n -lt 1 -or $n -gt $doc.PageCount) { "page $n does not exist ($($doc.PageCount) pages)"; continue }
  $page = $doc.GetPage($n - 1)
  $opt = New-Object Windows.Data.Pdf.PdfPageRenderOptions; $opt.DestinationWidth = [uint32]$Width
  $mem = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  Wait-Action $page.RenderToStreamAsync($mem, $opt)
  $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($mem.GetInputStreamAt(0))
  $file = [IO.File]::Create("$Out$n.png"); $stream.CopyTo($file); $file.Close(); $page.Dispose()
  "$Out$n.png"
}
