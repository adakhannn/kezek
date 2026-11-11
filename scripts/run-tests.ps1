# Legacy seeded scenarios require an explicit, separately authorized isolated target.
$ErrorActionPreference = 'Stop'
$SqlRunnerPath = Join-Path $PSScriptRoot 'run-sql-tests.mjs'
& node $SqlRunnerPath
$SqlRunnerExitCode = $LASTEXITCODE
if ($SqlRunnerExitCode -ne 0) {
    exit $SqlRunnerExitCode
}
exit 0
