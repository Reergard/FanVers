# Installs backend/requirements.txt into the repo venv (..\venv), not whatever `pip` is on PATH.
$ErrorActionPreference = "Stop"
$backend = $PSScriptRoot
$repoRoot = Split-Path $backend -Parent
$py = Join-Path $repoRoot "venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Error "Not found: $py. Create venv at repo root: python -m venv venv"
}
$req = Join-Path $backend "requirements.txt"
& $py -m pip install -r $req
