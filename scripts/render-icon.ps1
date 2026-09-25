# 把图标渲染成若干尺寸的 PNG。
#
# 为什么用 PowerShell 而不是 Node：Node 标准库没有 2D 绘图，自己写光栅化
# 与 PNG 编码要几百行；而 .NET 的 System.Drawing 是 Windows 自带的。
# 这是 Windows 专用项目，不介意这一点。
#
# 用法：powershell -ExecutionPolicy Bypass -File scripts/render-icon.ps1 <输出目录>
# 产物由 scripts/make-icon.mjs 读走并包成 .ico。

param([Parameter(Mandatory = $true)][string]$OutDir)

Add-Type -AssemblyName System.Drawing

# 与 README / 界面强调色一致
$ACCENT = [System.Drawing.Color]::FromArgb(255, 91, 127, 166)
$WHITE = [System.Drawing.Color]::White

function New-RoundedPath([int]$size, [double]$radiusRatio) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $r = [Math]::Max(1, [int]($size * $radiusRatio))
    $d = $r * 2
    $m = $size - 1   # 留 1px，免得右/下边缘被裁掉
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($m - $d, 0, $d, $d, 270, 90)
    $path.AddArc($m - $d, $m - $d, $d, $d, 0, 90)
    $path.AddArc(0, $m - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Polygon([object[]]$xy, [int]$size) {
    $pts = @()
    for ($i = 0; $i -lt $xy.Count; $i += 2) {
        $pts += [System.Drawing.PointF]::new(($xy[$i] * $size), ($xy[$i + 1] * $size))
    }
    return $pts
}

function Write-Png([int]$size) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # 圆角方形底
    $bg = New-RoundedPath $size 0.22
    $bgBrush = [System.Drawing.SolidBrush]::new($ACCENT)
    $g.FillPath($bgBrush, $bg)

    # 摊开的书：两片页子在中缝相遇，外缘略低。
    # 书要占满画布中间一大块 —— 缩到 16px 时细节全是糊的，只有大而实的
    # 形状才认得出，中缝也得留够（0.46/0.54 而不是 0.485/0.515）
    $leftBrush = [System.Drawing.SolidBrush]::new($WHITE)
    $g.FillPolygon($leftBrush, (New-Polygon @(0.17, 0.32, 0.46, 0.22, 0.46, 0.78, 0.17, 0.68) $size))
    $g.FillPolygon($leftBrush, (New-Polygon @(0.83, 0.32, 0.54, 0.22, 0.54, 0.78, 0.83, 0.68) $size))

    $out = Join-Path $OutDir "icon_$size.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

    $leftBrush.Dispose(); $bgBrush.Dispose(); $bg.Dispose()
    $g.Dispose(); $bmp.Dispose()
    Write-Output $out
}

foreach ($s in 16, 24, 32, 48, 64, 128, 256) { Write-Png $s | Out-Null }
