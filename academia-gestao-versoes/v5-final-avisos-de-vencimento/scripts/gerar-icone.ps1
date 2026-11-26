# Gera o ícone do aplicativo em PNG (vários tamanhos) e ICO.
# Desenho: halter branco sobre o azul do projeto, com a faixa laranja da identidade visual.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/gerar-icone.ps1
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'assets'
New-Item -ItemType Directory -Force -Path $destino | Out-Null

# ---- desenho em alta resolução (1024 x 1024), depois reduzido com qualidade ----
$alta = 1024
$bmp = New-Object System.Drawing.Bitmap($alta, $alta, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Fundo azul com cantos arredondados (mesmo azul do menu lateral)
$raio = 200
$fundo = New-Object System.Drawing.Drawing2D.GraphicsPath
$fundo.AddArc(0, 0, $raio, $raio, 180, 90)
$fundo.AddArc($alta - $raio, 0, $raio, $raio, 270, 90)
$fundo.AddArc($alta - $raio, $alta - $raio, $raio, $raio, 0, 90)
$fundo.AddArc(0, $alta - $raio, $raio, $raio, 90, 90)
$fundo.CloseFigure()
$pincelFundo = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#17325C'))
$g.FillPath($pincelFundo, $fundo)

# Faixa laranja na base (a "fita de quadra" da marca), recortada pelos cantos
$g.SetClip($fundo)
$pincelFita = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#E8590C'))
$g.FillRectangle($pincelFita, 0, 842, $alta, $alta - 842)
$g.ResetClip()

# Halter branco: duas anilhas arredondadas e a barra central
$pincelBranco = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
function New-CaixaArredondada([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}
$g.FillPath($pincelBranco, (New-CaixaArredondada 300 366 424 116 58))
$g.FillPath($pincelBranco, (New-CaixaArredondada 178 252 124 344 58))
$g.FillPath($pincelBranco, (New-CaixaArredondada 722 252 124 344 58))

$g.Dispose()

# ---- redução para os tamanhos usados pelo Windows ----
function Salvar-Png([int]$tamanho, [string]$caminho) {
  $menor = New-Object System.Drawing.Bitmap($tamanho, $tamanho, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $r = [System.Drawing.Graphics]::FromImage($menor)
  $r.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $r.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $r.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $r.DrawImage($bmp, 0, 0, $tamanho, $tamanho)
  $r.Dispose()
  $menor.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)
  $menor.Dispose()
}

$tamanhos = @(256, 128, 64, 48, 32, 16)
foreach ($t in $tamanhos) { Salvar-Png $t (Join-Path $destino "icon-$t.png") }
Copy-Item (Join-Path $destino 'icon-256.png') (Join-Path $destino 'icon.png') -Force
$bmp.Dispose()

# ---- ICO com as versões 16, 32, 48 e 256 (entradas PNG) ----
$entradas = @(16, 32, 48, 256)
$imagens = @()
foreach ($t in $entradas) { $imagens += ,([System.IO.File]::ReadAllBytes((Join-Path $destino "icon-$t.png"))) }
$cabecalho = New-Object System.IO.MemoryStream
$escritor = New-Object System.IO.BinaryWriter($cabecalho)
$escritor.Write([uint16]0)                 # reservado
$escritor.Write([uint16]1)                 # tipo: ícone
$escritor.Write([uint16]$entradas.Count)   # quantidade de imagens
$deslocamento = 6 + 16 * $entradas.Count
for ($i = 0; $i -lt $entradas.Count; $i++) {
  $lado = $entradas[$i]
  $bytes = $imagens[$i]
  $escritor.Write([byte]([Math]::Min($lado, 255)))  # largura (0 = 256)
  $escritor.Write([byte]([Math]::Min($lado, 255)))  # altura
  $escritor.Write([byte]0)                 # cores da paleta
  $escritor.Write([byte]0)                 # reservado
  $escritor.Write([uint16]1)               # planos
  $escritor.Write([uint16]32)              # bits por pixel
  $escritor.Write([uint32]$bytes.Length)   # tamanho da imagem
  $escritor.Write([uint32]$deslocamento)   # posição da imagem
  $deslocamento += $bytes.Length
}
foreach ($bytes in $imagens) { $escritor.Write($bytes) }
$escritor.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $destino 'icon.ico'), $cabecalho.ToArray())
$escritor.Dispose(); $cabecalho.Dispose()

Write-Host "Ícones gerados em $destino"
