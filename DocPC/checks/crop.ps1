# Crops the white margin around an image, for example a rendered form page for an appendix (keeps a 12 px border).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File crop.ps1 <source.png> <result.png>
param([string]$src, [string]$dst)
Add-Type -AssemblyName System.Drawing
$bm = [Drawing.Bitmap]::FromFile($src); $wd = $bm.Width; $ht = $bm.Height
function Ink($x, $y) { $c = $bm.GetPixel($x, $y); ($c.R + $c.G + $c.B) -lt 720 }
$top = 0; while ($top -lt $ht) { $hit = $false; for ($x = 0; $x -lt $wd; $x += 3) { if (Ink $x $top) { $hit = $true; break } }; if ($hit) { break }; $top += 2 }
$bot = $ht - 1; while ($bot -gt $top) { $hit = $false; for ($x = 0; $x -lt $wd; $x += 3) { if (Ink $x $bot) { $hit = $true; break } }; if ($hit) { break }; $bot -= 2 }
$lf = 0; while ($lf -lt $wd) { $hit = $false; for ($y = $top; $y -le $bot; $y += 3) { if (Ink $lf $y) { $hit = $true; break } }; if ($hit) { break }; $lf += 2 }
$rt = $wd - 1; while ($rt -gt $lf) { $hit = $false; for ($y = $top; $y -le $bot; $y += 3) { if (Ink $rt $y) { $hit = $true; break } }; if ($hit) { break }; $rt -= 2 }
$x0 = [Math]::Max(0, $lf - 12); $y0 = [Math]::Max(0, $top - 12)
$rect = New-Object Drawing.Rectangle $x0, $y0, ([Math]::Min($wd - 1, $rt + 12) - $x0), ([Math]::Min($ht - 1, $bot + 12) - $y0)
$out = $bm.Clone($rect, $bm.PixelFormat); $bm.Dispose(); $out.Save($dst, [Drawing.Imaging.ImageFormat]::Png); $out.Dispose()
"$dst $($rect.Width)x$($rect.Height)"
