# Assembles the document in Microsoft Word: the cover of the lecturer's template + body.docx + figures + contents lists.
# The assemble pipeline runs the text pipeline first and the check after. Writes Outputs\<output>.docx and .pdf (names
# from doc.json). Close that file in Word first.
# Usage by hand: powershell -NoProfile -ExecutionPolicy Bypass -File assemble.ps1 [-Source <Source folder>]
# CAUTION: this script never updates all fields: that resets form fields in a cover. It updates only the contents and the lists.
param([string]$Source = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$b = (Resolve-Path $Source).Path
$cfg = Get-Content "$b\doc.json" -Raw -Encoding UTF8 | ConvertFrom-Json
# Paths for Word must be plain strings: a Join-Path result makes SaveAs2 hang without an error.
$outDir = [IO.Path]::Combine((Split-Path $b), 'Outputs')
New-Item -ItemType Directory -Force $outDir | Out-Null
$outDocx = [IO.Path]::Combine($outDir, "$($cfg.output).docx"); $outPdf = [IO.Path]::ChangeExtension($outDocx, '.pdf')

function Find-Text($doc, $txt) { $r = $doc.Content; $f = $r.Find; $f.ClearFormatting(); if ($f.Execute($txt)) { return $r } else { return $null } }
function Get-Text($doc, $txt) { $r = Find-Text $doc $txt; if (-not $r) { throw "not found: $txt" }; $r }

# Everything in the template before the paragraph whose text is coverEnd goes in place of [[COVER]].
function Copy-Cover($d) {
  $c = (Get-Text $d '[[COVER]]').Paragraphs(1).Range
  if (-not $cfg.template) { $c.Delete() | Out-Null; return }
  $tpl = if ([IO.Path]::IsPathRooted($cfg.template)) { $cfg.template } else { [IO.Path]::GetFullPath([IO.Path]::Combine($b, $cfg.template)) }
  $cv = $w.Documents.Open($tpl, $false, $true)   # read-only: the template never changes
  $endPara = $cv.Paragraphs | Where-Object { $_.Range.Text.Trim() -eq $cfg.coverEnd } | Select-Object -First 1
  if (-not $endPara) { throw "coverEnd '$($cfg.coverEnd)' is not a paragraph of the template" }
  # Paste with the original formatting (16): the cover keeps the template's look even where the body has styles
  # of the same name (Title, Normal). This uses the clipboard.
  $cv.Range(0, $endPara.Range.Start).Copy(); $c.PasteAndFormat(16)
  $cv.Close($false)
  Set-CoverValues $d
}

# The cover values of doc.json, only inside the cover (before [[TOC]]): after a label, in place of a text, in a table row.
function Set-CoverValues($d) {
  foreach ($p in $cfg.coverAfter.PSObject.Properties) {
    $r = $d.Range(0, (Get-Text $d '[[TOC]]').Start); $f = $r.Find; $f.ClearFormatting()
    if ($f.Execute($p.Name)) { $r.InsertAfter($p.Value) } else { "problem: cover label not found: $($p.Name)" }
  }
  foreach ($p in $cfg.coverReplace.PSObject.Properties) {
    $r = $d.Range(0, (Get-Text $d '[[TOC]]').Start); $f = $r.Find; $f.ClearFormatting(); $f.Replacement.ClearFormatting()
    # Execute(FindText, MatchCase, WholeWord, Wildcards, SoundsLike, AllForms, Forward, Wrap=0 stop, Format, ReplaceWith, Replace=2 all)
    if (-not $f.Execute($p.Name, $true, $false, $false, $false, $false, $true, 0, $false, $p.Value, 2)) { "problem: cover text not found: $($p.Name)" }
  }
  # The first cover table that holds the text 'find' gets the values in row 'row' (null = keep).
  foreach ($ct in @($cfg.coverTables)) {
    if (-not $ct) { continue }
    $t = @($d.Range(0, (Get-Text $d '[[TOC]]').Start).Tables) | Where-Object { $_.Range.Text -like "*$($ct.find)*" } | Select-Object -First 1
    if (-not $t) { "problem: cover table not found: $($ct.find)"; continue }
    for ($k = 0; $k -lt $ct.values.Count; $k++) { if ($null -ne $ct.values[$k]) { $t.Cell($ct.row, $k + 1).Range.Text = $ct.values[$k] } }
  }
}

# Each [[FIG:key]] becomes figures\key.svg, .png or .jpg, at most the text width and 600 pt high.
function Add-Figures($d) {
  $keys = [regex]::Matches($d.Content.Text, '\[\[FIG:([\w-]+)\]\]') | ForEach-Object { $_.Groups[1].Value }
  foreach ($key in $keys) {
    $r = Get-Text $d "[[FIG:$key]]"; $r.Text = ''
    $img = @("$b\figures\$key.svg", "$b\figures\$key.png", "$b\figures\$key.jpg") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $img) { throw "no image for figure $key in figures\" }
    $s = $d.InlineShapes.AddPicture([string]$img, $false, $true, $r); $s.LockAspectRatio = -1
    # Never enlarge: only shrink a picture that is too wide or too high. 600 pt leaves room for the caption on an A4 page.
    if ($s.Width -gt 451) { $s.Width = 451 }
    if ($s.Height -gt 600) { $s.Height = 600 }
  }
}

# The contents and the lists of figures and tables, only where the body has their placeholders.
function Update-Lists($d) {
  $r = Find-Text $d '[[TOC]]'; if ($r) { $r.Text = ''; $d.TablesOfContents.Add($r, $true, 1, 3) | Out-Null }
  $r = Find-Text $d '[[LOF]]'; if ($r) { $r.Text = ''; $d.TablesOfFigures.Add($r, 'Figure') | Out-Null }
  $r = Find-Text $d '[[LOT]]'; if ($r) { $r.Text = ''; $d.TablesOfFigures.Add($r, 'Table') | Out-Null }
  foreach ($t in $d.TablesOfContents) { $t.Update() }; foreach ($t in $d.TablesOfFigures) { $t.Update() }
  $left = [regex]::Matches($d.Content.Text, '\[\[[^\]]+\]\]') | ForEach-Object { $_.Value }
  if ($left) { "problem: placeholders left: $($left -join ', ')" }
}

# A caption must be on the page of its picture or pseudocode box (above a figure caption) or its table (below a
# table caption). Word knows the page of each paragraph (Information 3 = page number at the end of the range).
# A caption holds a SEQ field (type 12); an entry of the list of figures looks the same but has none.
function Test-Captions($d) {
  foreach ($p in @($d.Paragraphs)) {
    $t = $p.Range.Text.Trim()
    if ($t -notmatch '^(Figure|Table) \d+:' -or -not (@($p.Range.Fields) | Where-Object { $_.Type -eq 12 })) { continue }
    $o = if ($t.StartsWith('Figure')) { $p.Previous(1) } else { $p.Next(1) }
    if ($o -and $o.Range.Information(3) -ne $p.Range.Information(3)) { "problem: caption on another page than its $($Matches[1].ToLower()): $t" }
  }
}

Copy-Item "$b\body.docx" "$b\work.docx" -Force   # work on a copy
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open("$b\work.docx")
  Copy-Cover $d
  Add-Figures $d
  Update-Lists $d
  Test-Captions $d
  "pages: " + $d.ComputeStatistics(2) + "; words: " + $d.ComputeStatistics(0) + "; pictures: " + $d.InlineShapes.Count
  $d.SaveAs2($outDocx, 16); $d.ExportAsFixedFormat($outPdf, 17)
  "saved $outDocx and .pdf"
  $d.Close($false)
} finally { foreach ($x in @($w.Documents)) { $x.Close($false) }; $w.Quit(); Remove-Item "$b\work.docx" -ErrorAction SilentlyContinue }
