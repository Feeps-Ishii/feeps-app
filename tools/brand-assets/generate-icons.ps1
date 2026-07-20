<#
  Feeps One ブランド資産（favicon / apple-touch-icon / og-image）生成スクリプト。

  目的:
    共有プレビュー(OGP/Twitterカード)とブラウザタブ/ブックマークアイコンを、
    既存のブランドマーク(components/common/BrandMark.jsx のブロブロゴ)・
    Prism Brightグラデーション(components/common/theme.js の PRISM.gradMark)と
    完全に同じ形状・配色で再現し、public/ 配下へ書き出す。

  ブロブ形状の再現方法:
    BrandMark.jsx は CSS の border-radius: 46% 54% 52% 48% / 50% 46% 54% 50% で
    ブロブ形状を作っている(index.css .feeps-blob)。この4隅の楕円境界線は、
    64x64のボックス上で「直線区間が長さ0」になる特殊値になっており(各辺で
    左右/上下の割合の合計が100%)、結果として4本の四半楕円ベジェ曲線だけで
    閉じる完全なブロブになる。本スクリプトはこの4本のベジェ曲線を標準の
    楕円->3次ベジェ近似定数(kappa=0.5522847498)で計算し、System.Drawing の
    GraphicsPath.AddBezier で再現する。SVG側 (public/favicon.svg) も同じ計算式
    から書き出した同一のパスを使っている。

  再生成方法:
    PowerShellで実行: powershell -File tools/brand-assets/generate-icons.ps1
    出力先: ../../public/ (favicon.ico, apple-touch-icon.png, og-image.png)
    favicon.svg はテキストファイルとして public/ に直接コミットされているため
    このスクリプトでは生成しない(手動編集する場合は同じベジェ座標を使うこと)。
#>

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
$publicDir = Join-Path $root "public"
if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory -Path $publicDir | Out-Null }

# ---- Prism Bright トークン(theme.js PRISM 準拠) ----
$colAccent = [System.Drawing.Color]::FromArgb(0x12, 0x67, 0xB5)   # PRISM.accent
$colMid    = [System.Drawing.Color]::FromArgb(0x68, 0x43, 0xB7)   # gradMark 55%
$colTeal   = [System.Drawing.Color]::FromArgb(0x17, 0x6B, 0x67)   # gradTraining/gradMark end
$colInk    = [System.Drawing.Color]::FromArgb(0x1A, 0x1C, 0x1F)   # PRISM.ink
$colSub    = [System.Drawing.Color]::FromArgb(0x53, 0x5D, 0x6E)   # PRISM.sub
$colBase   = [System.Drawing.Color]::FromArgb(0xF7, 0xF9, 0xFC)   # PRISM.base
$colWhite  = [System.Drawing.Color]::White

function New-BlobPath {
    param([double]$Scale, [double]$OffsetX, [double]$OffsetY)

    function Pt([double]$x, [double]$y) {
        New-Object System.Drawing.PointF ([single]($OffsetX + $x * $Scale)), ([single]($OffsetY + $y * $Scale))
    }

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddBezier((Pt 29.44 0), (Pt 48.53 0), (Pt 64 13.17), (Pt 64 29.44))
    $path.AddBezier((Pt 64 29.44), (Pt 64 48.53), (Pt 49.10 64), (Pt 30.72 64))
    $path.AddBezier((Pt 30.72 64), (Pt 13.75 64), (Pt 0 49.67), (Pt 0 32))
    $path.AddBezier((Pt 0 32), (Pt 0 14.33), (Pt 13.18 0), (Pt 29.44 0))
    $path.CloseFigure()
    return $path
}

function New-BlobGradientBrush {
    param([System.Drawing.Drawing2D.GraphicsPath]$Path)

    $bounds = $Path.GetBounds()
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bounds, $colAccent, $colTeal, 135)
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend(3)
    $blend.Colors = [System.Drawing.Color[]]@($colAccent, $colMid, $colTeal)
    $blend.Positions = [single[]]@(0.0, 0.55, 1.0)
    $brush.InterpolationColors = $blend
    return $brush
}

function Add-BlobMark {
    param(
        [System.Drawing.Graphics]$Graphics,
        [double]$Size,
        [double]$OffsetX,
        [double]$OffsetY
    )
    $scale = $Size / 64.0
    $path = New-BlobPath -Scale $scale -OffsetX $OffsetX -OffsetY $OffsetY
    $brush = New-BlobGradientBrush -Path $path
    $Graphics.FillPath($brush, $path)

    $fontSize = [single]([Math]::Max(6, $Size * 0.50))
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $whiteBrush = New-Object System.Drawing.SolidBrush($colWhite)
    $center = New-Object System.Drawing.PointF ([single]($OffsetX + $Size / 2)), ([single]($OffsetY + $Size / 2 - $Size * 0.02))
    $Graphics.DrawString("F", $font, $whiteBrush, $center, $format)

    $font.Dispose(); $whiteBrush.Dispose(); $brush.Dispose(); $path.Dispose()
}

function New-Canvas {
    param([int]$Width, [int]$Height, [System.Drawing.Color]$Background)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    if ($Background.A -gt 0) {
        $g.Clear($Background)
    }
    return @{ Bitmap = $bmp; Graphics = $g }
}

function Add-SoftGlow {
    param([System.Drawing.Graphics]$Graphics, [single]$Cx, [single]$Cy, [single]$R, [System.Drawing.Color]$Color, [int]$Alpha)
    $rect = New-Object System.Drawing.RectangleF ($Cx - $R), ($Cy - $R), ($R * 2), ($R * 2)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($rect)
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $brush.CenterColor = [System.Drawing.Color]::FromArgb($Alpha, $Color)
    $brush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, $Color))
    $Graphics.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
}

# ---------------------------------------------------------------------------
# 1) favicon.ico (16 / 32 / 48px, PNG圧縮埋め込み方式 — Vista以降のICOで有効)
# ---------------------------------------------------------------------------
$sizes = @(16, 32, 48)
$pngBytesList = @()
foreach ($size in $sizes) {
    $c = New-Canvas -Width $size -Height $size -Background ([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    Add-BlobMark -Graphics $c.Graphics -Size $size -OffsetX 0 -OffsetY 0
    $ms = New-Object System.IO.MemoryStream
    $c.Bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += , $ms.ToArray()
    $c.Graphics.Dispose(); $c.Bitmap.Dispose(); $ms.Dispose()
}

$icoPath = Join-Path $publicDir "favicon.ico"
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR
$bw.Write([UInt16]0)      # reserved
$bw.Write([UInt16]1)      # type = icon
$bw.Write([UInt16]$sizes.Count)

$headerSize = 6
$dirEntrySize = 16
$offset = $headerSize + ($dirEntrySize * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $pngBytes = $pngBytesList[$i]
    $dim = if ($size -ge 256) { 0 } else { $size }
    $bw.Write([Byte]$dim)          # width
    $bw.Write([Byte]$dim)          # height
    $bw.Write([Byte]0)             # color count (0 = truecolor)
    $bw.Write([Byte]0)             # reserved
    $bw.Write([UInt16]1)           # color planes
    $bw.Write([UInt16]32)          # bits per pixel
    $bw.Write([UInt32]$pngBytes.Length)
    $bw.Write([UInt32]$offset)
    $offset += $pngBytes.Length
}
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bw.Write($pngBytesList[$i])
}
$bw.Flush(); $bw.Close(); $fs.Close()
Write-Host "[generate-icons] favicon.ico written ($($sizes -join '/')px)"

# ---------------------------------------------------------------------------
# 2) apple-touch-icon.png (180x180, 白背景 + 余白付きブロブ)
# ---------------------------------------------------------------------------
$appleSize = 180
$c = New-Canvas -Width $appleSize -Height $appleSize -Background $colWhite
$bloSize = 132
$padding = ($appleSize - $bloSize) / 2
Add-BlobMark -Graphics $c.Graphics -Size $bloSize -OffsetX $padding -OffsetY $padding
$applePath = Join-Path $publicDir "apple-touch-icon.png"
$c.Bitmap.Save($applePath, [System.Drawing.Imaging.ImageFormat]::Png)
$c.Graphics.Dispose(); $c.Bitmap.Dispose()
Write-Host "[generate-icons] apple-touch-icon.png written (${appleSize}x${appleSize})"

# ---------------------------------------------------------------------------
# 3) og-image.png (1200x630, 白背景 + Prism Brightグラデ + ロゴ + Feeps One)
# ---------------------------------------------------------------------------
$ogW = 1200; $ogH = 630
$c = New-Canvas -Width $ogW -Height $ogH -Background $colBase
$g = $c.Graphics

# 四隅のAurora風の淡い光(auroraBgトークンの雰囲気を静止画で再現。主張しすぎない透明度)
Add-SoftGlow -Graphics $g -Cx ($ogW * 1.02) -Cy ($ogH * -0.05) -R 420 -Color $colAccent -Alpha 26
Add-SoftGlow -Graphics $g -Cx ($ogW * -0.03) -Cy ($ogH * 1.08) -R 380 -Color $colTeal -Alpha 22
Add-SoftGlow -Graphics $g -Cx ($ogW * 1.05) -Cy ($ogH * 1.06) -R 360 -Color $colMid -Alpha 18

# ロゴブロブ
$logoSize = 220
$logoX = 96
$logoY = ($ogH - $logoSize) / 2
Add-BlobMark -Graphics $g -Size $logoSize -OffsetX $logoX -OffsetY $logoY

# テキストブロック
$textX = $logoX + $logoSize + 56
$blockCenterY = $ogH / 2

$kickerFont = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$kickerBrush = New-Object System.Drawing.SolidBrush($colAccent)
$kickerText = "LEARN . GROW . CONNECT"
$g.DrawString($kickerText, $kickerFont, $kickerBrush, $textX, ($blockCenterY - 118))

$titleFont = New-Object System.Drawing.Font("Segoe UI", 74, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$inkBrush = New-Object System.Drawing.SolidBrush($colInk)
$accentBrush = New-Object System.Drawing.SolidBrush($colAccent)
$titleY = $blockCenterY - 78
$g.DrawString("Feeps ", $titleFont, $inkBrush, $textX, $titleY)
$feepsWidth = $g.MeasureString("Feeps ", $titleFont).Width
$g.DrawString("One", $titleFont, $accentBrush, ($textX + $feepsWidth), $titleY)

$taglineFont = New-Object System.Drawing.Font("Meiryo", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$subBrush = New-Object System.Drawing.SolidBrush($colSub)
$taglineY = $blockCenterY + 34
$g.DrawString("研修運営・Eラーニング・案件マッチング・", $taglineFont, $subBrush, $textX, $taglineY)
$g.DrawString("助成金申請までを、ひとつのLMSに。", $taglineFont, $subBrush, $textX, ($taglineY + 42))

# アクセントのグラデーションバー
$barRect = New-Object System.Drawing.RectangleF $textX, ($blockCenterY + 140), 340, 8
$barBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($barRect, $colAccent, $colTeal, 0)
$barBlend = New-Object System.Drawing.Drawing2D.ColorBlend(3)
$barBlend.Colors = [System.Drawing.Color[]]@($colAccent, $colMid, $colTeal)
$barBlend.Positions = [single[]]@(0.0, 0.55, 1.0)
$barBrush.InterpolationColors = $barBlend
$barPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$barPath.AddRectangle([System.Drawing.Rectangle]::Round($barRect))
$g.FillPath($barBrush, $barPath)

$ogPath = Join-Path $publicDir "og-image.png"
$c.Bitmap.Save($ogPath, [System.Drawing.Imaging.ImageFormat]::Png)

$kickerFont.Dispose(); $kickerBrush.Dispose(); $titleFont.Dispose(); $inkBrush.Dispose()
$accentBrush.Dispose(); $taglineFont.Dispose(); $subBrush.Dispose(); $barBrush.Dispose(); $barPath.Dispose()
$g.Dispose(); $c.Bitmap.Dispose()
Write-Host "[generate-icons] og-image.png written (${ogW}x${ogH})"

Write-Host "[generate-icons] done. Output: $publicDir"
