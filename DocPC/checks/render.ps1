# Renders PDF pages to PNG with the Windows PDF engine (Windows.Data.Pdf), to look at them or to use them as images.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File render.ps1 -Pdf <file.pdf> -Out <prefix> [-Pages 1,5,9] [-Width 1400]
# Writes <prefix><page>.png. No -Pages = all pages.
# CAUTION: run it with powershell -File (a child process). In a shell session that stays open, the engine keeps the PDF
# locked, and a later Word export to the same PDF fails without an error.
# -Pages is text ("1,5,9"): powershell -File passes a list as one string.
param([Parameter(Mandatory)][string]$Pdf, [Parameter(Mandatory)][string]$Out, [string]$Pages, [int]$Width = 1400)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asOp = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asAct = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asOp.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$list = if ($Pages) { $Pages -split '[,\s]+' | Where-Object { $_ } | ForEach-Object { [int]$_ } } else { 1..$doc.PageCount }
foreach ($n in $list) {
  if ($n -lt 1 -or $n -gt $doc.PageCount) { "page $n does not exist ($($doc.PageCount) pages)"; continue }
  $page = $doc.GetPage($n - 1)
  $opt = New-Object Windows.Data.Pdf.PdfPageRenderOptions; $opt.DestinationWidth = [uint32]$Width
  $mem = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  ($asAct.Invoke($null, @($page.RenderToStreamAsync($mem, $opt)))).Wait()
  $s = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($mem.GetInputStreamAt(0))
  $fs = [IO.File]::Create("$Out$n.png"); $s.CopyTo($fs); $fs.Close(); $page.Dispose()
  "$Out$n.png"
}
