# Exports a Word file to PDF next to it, with Microsoft Word. The Word file opens read-only and does not change.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File pdf.ps1 <file.docx>
param([Parameter(Mandatory)][string]$Docx)
$ErrorActionPreference = 'Stop'
$Docx = (Resolve-Path $Docx).Path
$pdf = [IO.Path]::ChangeExtension($Docx, '.pdf')
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try { $d = $w.Documents.Open($Docx, $false, $true); $d.ExportAsFixedFormat($pdf, 17); "pages: $($d.ComputeStatistics(2)); saved $pdf"; $d.Close(0) }
finally { $w.Quit() }
