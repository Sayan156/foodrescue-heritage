param([string]$SourceDirectory = '', [string]$MobileSourceDirectory = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
if (!$SourceDirectory) {
  foreach ($name in @('food_rescue_frames', 'food_recue_frames')) {
    $candidate = Join-Path $projectRoot $name
    if (Test-Path -LiteralPath $candidate) { $SourceDirectory = $candidate; break }
  }
}
if (!$SourceDirectory) { throw 'Provide -SourceDirectory containing frame_0001 through frame_0240.' }
$frames = @(Get-ChildItem -LiteralPath $SourceDirectory -File | Where-Object { $_.Name -match '^frame_\d{4}\.(jpg|jpeg|png)$' } | Sort-Object Name)
if ($frames.Count -ne 240) { throw "Expected 240 frames, found $($frames.Count)." }
$extensions = @($frames.Extension.ToLowerInvariant() | Select-Object -Unique)
if ($extensions.Count -ne 1) { throw 'Use one consistent image extension for the sequence.' }
$extension = $extensions[0]
if (!$MobileSourceDirectory) {
  $candidate = Join-Path $projectRoot 'food_rescue_frames_mobile'
  if (Test-Path -LiteralPath $candidate) { $MobileSourceDirectory = $candidate }
}
$mobileFrames = $frames
$mobileExtension = $extension
if ($MobileSourceDirectory) {
  $mobileFrames = @(Get-ChildItem -LiteralPath $MobileSourceDirectory -File | Where-Object { $_.Name -match '^frame_\d{4}\.(jpg|jpeg|png)$' } | Sort-Object Name)
  if ($mobileFrames.Count -ne 240) { throw "Expected 240 mobile frames, found $($mobileFrames.Count)." }
  $mobileExtensions = @($mobileFrames.Extension.ToLowerInvariant() | Select-Object -Unique)
  if ($mobileExtensions.Count -ne 1) { throw 'Use one consistent mobile image extension.' }
  $mobileExtension = $mobileExtensions[0]
}
$destination = Join-Path $projectRoot 'client/public/food-rescue-sequence'
$featureDirectory = Join-Path $projectRoot 'client/src/features/home'
New-Item -ItemType Directory -Force -Path $destination, $featureDirectory | Out-Null
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
foreach ($variant in @(@{Name='desktop';Width=1280;Quality=88}, @{Name='mobile';Width=768;Quality=82})) {
  $dimensions = $null
  $variantFrames = if ($variant.Name -eq 'mobile') { $mobileFrames } else { $frames }
  $variantExtension = if ($variant.Name -eq 'mobile') { $mobileExtension } else { $extension }
  $folder = Join-Path $destination $variant.Name
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  for ($i = 0; $i -lt $variantFrames.Count; $i++) {
    $expected = 'frame_{0:D4}{1}' -f ($i + 1), $variantExtension
    if ($variantFrames[$i].Name -ne $expected) { throw "Missing $($variant.Name) frame: $expected" }
    $source = [System.Drawing.Image]::FromFile($variantFrames[$i].FullName)
    try {
      if (!$dimensions) { $dimensions = @($source.Width, $source.Height) }
      if ($source.Width -ne $dimensions[0] -or $source.Height -ne $dimensions[1]) { throw 'Frame dimensions must be consistent.' }
      $width = [Math]::Min($variant.Width, $source.Width)
      $height = [int][Math]::Round($source.Height * $width / $source.Width)
      $bitmap = New-Object System.Drawing.Bitmap $width, $height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($source, 0, 0, $width, $height)
        $output = Join-Path $folder $expected
        if ($variantExtension -eq '.png') { $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png) }
        else {
          $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
          $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$variant.Quality)
          try { $bitmap.Save($output, $encoder, $parameters) } finally { $parameters.Dispose() }
        }
      } finally { $graphics.Dispose(); $bitmap.Dispose() }
    } finally { $source.Dispose() }
  }
  if ($variant.Name -eq 'desktop') { $desktopDimensions = $dimensions }
  else { $mobileDimensions = @($width, $height) }
}
$manifest = [ordered]@{frameCount=240;prefix='frame_';digits=4;extension=$extension;width=$desktopDimensions[0];height=$desktopDimensions[1];basePath='food-rescue-sequence';desktopWidth=[Math]::Min(1280,$desktopDimensions[0]);mobileWidth=$mobileDimensions[0];mobileHeight=$mobileDimensions[1];mobileExtension=$mobileExtension}
$manifest['version'] = [Guid]::NewGuid().ToString('N')
$json = $manifest | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $featureDirectory 'sequenceManifest.json'), $json)
$size = (Get-ChildItem -LiteralPath $destination -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Output "Prepared 240 desktop and 240 mobile frames ($([Math]::Round($size / 1MB, 1)) MiB). Originals preserved."
