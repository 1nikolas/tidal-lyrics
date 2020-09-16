[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
$output = (Get-Process -name "TIDAL" -ErrorAction SilentlyContinue).MainWindowTitle
Write-Host -NoNewline $output