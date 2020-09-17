[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
$err = $( $output = (Get-Process -name "TIDAL").MainWindowTitle ) 2>&1
Write-Host -NoNewline $output $err