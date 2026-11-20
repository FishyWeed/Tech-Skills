# Assembles the document in Microsoft Word: the cover of the lecturer's template + body.docx + figures + contents lists.
# Run `node body.js` first. Writes ..\Outputs\<output>.docx and .pdf (names from doc.json). Close that file in Word first.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File assemble.ps1
# CAUTION: this script never updates all fields: that resets form fields in a cover. It updates only the contents and the lists.
$ErrorActionPreference = 'Stop'
$b = $PSScriptRoot
$cfg = Get-Content "$b\doc.json" -Raw -Encoding UTF8 | ConvertFrom-Json
# Paths for Word must be plain strings: a Join-Path result makes SaveAs2 hang without an error.
$outDir = [IO.Path]::Combine((Split-Path $b), 'Outputs')
New-Item -ItemType Directory -Force $outDir | Out-Null
$outDocx = [IO.Path]::Combine($outDir, "$($cfg.output).docx"); $outPdf = [IO.Path]::ChangeExtension($outDocx, '.pdf')
Copy-Item "$b\body.docx" "$b\work.docx" -Force   # work on a copy
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
function FindRange($doc, $txt) { $r = $doc.Content; $f = $r.Find; $f.ClearFormatting(); if ($f.Execute($txt)) { return $r } else { return $null } }
function Need($doc, $txt) { $r = FindRange $doc $txt; if (-not $r) { throw "not found: $txt" }; $r }
try {
  $d = $w.Documents.Open("$b\work.docx")

  # 1. Cover: everything in the template before the paragraph whose text is coverEnd.
  $c = (Need $d '[[COVER]]').Paragraphs(1).Range
  if ($cfg.template) {
    $tpl = if ([IO.Path]::IsPathRooted($cfg.template)) { $cfg.template } else { [IO.Path]::GetFullPath([IO.Path]::Combine($b, $cfg.template)) }
    $cv = $w.Documents.Open($tpl, $false, $true)   # read-only: the template never changes
    $endPara = $cv.Paragraphs | Where-Object { $_.Range.Text.Trim() -eq $cfg.coverEnd } | Select-Object -First 1
    if (-not $endPara) { throw "coverEnd '$($cfg.coverEnd)' is not a paragraph of the template" }
    # Paste with the original formatting (16): the cover keeps the template's look even where the body has styles
    # of the same name (Title, Normal). This uses the clipboard.
    $cv.Range(0, $endPara.Range.Start).Copy(); $c.PasteAndFormat(16)
    $cv.Close($false)
    $coverEnd = (Need $d '[[TOC]]').Start
    foreach ($p in $cfg.coverAfter.PSObject.Properties) {
      $r = $d.Range(0, $coverEnd); $f = $r.Find; $f.ClearFormatting()
      if ($f.Execute($p.Name)) { $r.InsertAfter($p.Value) } else { "cover label not found: $($p.Name)" }
      $coverEnd = (Need $d '[[TOC]]').Start
    }
    foreach ($p in $cfg.coverReplace.PSObject.Properties) {
      $r = $d.Range(0, $coverEnd); $f = $r.Find; $f.ClearFormatting(); $f.Replacement.ClearFormatting()
      # Execute(FindText, MatchCase, WholeWord, Wildcards, SoundsLike, AllForms, Forward, Wrap=0 stop, Format, ReplaceWith, Replace=2 all)
      if (-not $f.Execute($p.Name, $true, $false, $false, $false, $false, $true, 0, $false, $p.Value, 2)) { "cover text not found: $($p.Name)" }
      $coverEnd = (Need $d '[[TOC]]').Start
    }
    # Table rows in the cover: the first cover table that holds the text 'find' gets the values in row 'row' (null = keep).
    foreach ($ct in @($cfg.coverTables)) {
      if (-not $ct) { continue }
      $t = @($d.Range(0, $coverEnd).Tables) | Where-Object { $_.Range.Text -like "*$($ct.find)*" } | Select-Object -First 1
      if (-not $t) { "cover table not found: $($ct.find)"; continue }
      for ($k = 0; $k -lt $ct.values.Count; $k++) { if ($null -ne $ct.values[$k]) { $t.Cell($ct.row, $k + 1).Range.Text = $ct.values[$k] } }
    }
  } else { $c.Delete() | Out-Null }

  # 2. Figures: each [[FIG:key]] becomes figures\key.svg or figures\key.png, at most the text width and 600 pt high.
  $keys = [regex]::Matches($d.Content.Text, '\[\[FIG:([\w-]+)\]\]') | ForEach-Object { $_.Groups[1].Value }
  foreach ($key in $keys) {
    $r = Need $d "[[FIG:$key]]"; $r.Text = ''
    $img = @("$b\figures\$key.svg", "$b\figures\$key.png", "$b\figures\$key.jpg") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $img) { throw "no image for figure $key in figures\" }
    $s = $d.InlineShapes.AddPicture([string]$img, $false, $true, $r); $s.LockAspectRatio = -1
    # Never enlarge: only shrink a picture that is too wide or too high. 600 pt leaves room for the caption on an A4 page.
    if ($s.Width -gt 451) { $s.Width = 451 }
    if ($s.Height -gt 600) { $s.Height = 600 }
  }

  # 3. Contents lists, only where the body has their placeholders.
  $r = FindRange $d '[[TOC]]'; if ($r) { $r.Text = ''; $d.TablesOfContents.Add($r, $true, 1, 3) | Out-Null }
  $r = FindRange $d '[[LOF]]'; if ($r) { $r.Text = ''; $d.TablesOfFigures.Add($r, 'Figure') | Out-Null }
  $r = FindRange $d '[[LOT]]'; if ($r) { $r.Text = ''; $d.TablesOfFigures.Add($r, 'Table') | Out-Null }
  foreach ($t in $d.TablesOfContents) { $t.Update() }; foreach ($t in $d.TablesOfFigures) { $t.Update() }
  $left = [regex]::Matches($d.Content.Text, '\[\[[^\]]+\]\]') | ForEach-Object { $_.Value }
  if ($left) { "placeholders left: $($left -join ', ')" }

  "pages: " + $d.ComputeStatistics(2) + "; words: " + $d.ComputeStatistics(0) + "; pictures: " + $d.InlineShapes.Count
  $d.SaveAs2($outDocx, 16); $d.ExportAsFixedFormat($outPdf, 17)
  "saved $outDocx and .pdf"
  $d.Close($false)
} finally { foreach ($x in @($w.Documents)) { $x.Close($false) }; $w.Quit(); Remove-Item "$b\work.docx" -ErrorAction SilentlyContinue }
