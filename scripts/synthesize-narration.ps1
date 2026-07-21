[CmdletBinding()]
param(
  [ValidateRange(-10, 10)]
  [int]$Rate = 1
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$transcriptPath = Join-Path $repoRoot 'docs\demo\NARRATION.txt'
$outputPath = Join-Path $repoRoot 'docs\demo\demo-narration.wav'

Add-Type -AssemblyName System.Speech
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $synthesizer.Rate = $Rate
  $synthesizer.Volume = 100
  $synthesizer.SetOutputToWaveFile($outputPath)
  $synthesizer.Speak([System.IO.File]::ReadAllText($transcriptPath))
} finally {
  $synthesizer.Dispose()
}

Write-Host "Created $outputPath from the reviewed narration transcript."
