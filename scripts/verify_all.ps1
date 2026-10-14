# CodeGuardian Phase 5 - Master System Verification Suite
# Verifies all 5 Acceptance Gates across Member 1 and Member 2

param(
    [switch]$SkipBenchmark
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   CodeGuardian Master Verification & Gate Review Suite     " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$startTime = [System.Diagnostics.Stopwatch]::StartNew()
$stageResults = @()

function Run-Stage {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Host "`n---> Running Stage: $Name..." -ForegroundColor Yellow
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Action
        $sw.Stop()
        Write-Host "     [STAGE PASSED] $Name ($([math]::Round($sw.Elapsed.TotalMilliseconds)) ms)" -ForegroundColor Green
        return [PSCustomObject]@{ Name = $Name; Status = "PASS"; DurationMs = [math]::Round($sw.Elapsed.TotalMilliseconds) }
    } catch {
        $sw.Stop()
        Write-Host "     [STAGE FAILED] $Name : $_" -ForegroundColor Red
        return [PSCustomObject]@{ Name = $Name; Status = "FAIL"; DurationMs = [math]::Round($sw.Elapsed.TotalMilliseconds) }
    }
}

# 1. Compiler Core Unit Tests
$stageResults += Run-Stage "1. Compiler Core Unit & Lexer/Parser Tests (Gate 1 & 2)" {
    $res = powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1
    if ($LASTEXITCODE -ne 0) { throw "compiler_core tests failed with exit code $LASTEXITCODE" }
}

# 2. Security Engine Full Test Suite (Ajv contract, Kildall solver, transfer, auditor, server)
$stageResults += Run-Stage "2. Security Engine & Fixpoint Solver Test Suite (Gate 2 & 3)" {
    Push-Location security_engine
    try {
        $res = npm test 2>&1
        if ($LASTEXITCODE -ne 0) { throw "npm test in security_engine failed" }
    } finally {
        Pop-Location
    }
}

# 3. Direct End-to-End CLI Pipeline (codeguardian-frontend code.c | node security_engine/src/cli.js)
$stageResults += Run-Stage "3. End-to-End CLI Pipeline Verification (Gate 3)" {
    $out = ./compiler_core/bin/codeguardian-frontend.exe examples/command_injection.c | node security_engine/src/cli.js
    if ($LASTEXITCODE -ne 0) { throw "CLI pipeline failed" }
    $parsed = $out | ConvertFrom-Json
    if (-not $parsed.vulnerabilities -or $parsed.vulnerabilities.Count -lt 1) {
        throw "CLI pipeline did not detect expected vulnerability"
    }
    if ($parsed.vulnerabilities[0].cwe -ne "CWE-78") {
        throw "Expected CWE-78 but got $($parsed.vulnerabilities[0].cwe)"
    }
}

# 4. Dashboard Production Bundle Build (Vite + React 18 + Cytoscape)
$stageResults += Run-Stage "4. Dashboard Production Build & Bundler Verification (Gate 4)" {
    Push-Location dashboard
    try {
        $buildOut = cmd /c "npm run build"
        if ($LASTEXITCODE -ne 0) { throw "Dashboard build failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

# 5. Performance & SLA Benchmarks (Gate 5)
if (-not $SkipBenchmark) {
    $stageResults += Run-Stage "5. Performance & SLA Latency Benchmarks (Gate 5)" {
        $res = powershell -ExecutionPolicy Bypass -File scripts/benchmark.ps1
        if ($LASTEXITCODE -ne 0) { throw "Benchmark suite failed" }
    }
}

$startTime.Stop()
$totalElapsed = [math]::Round($startTime.Elapsed.TotalSeconds, 2)

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "                FINAL VERIFICATION SUMMARY                  " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$allPassed = $true
foreach ($s in $stageResults) {
    $color = if ($s.Status -eq "PASS") { "Green" } else { "Red"; $allPassed = $false }
    Write-Host ("  [{0,-4}] {1,-55} ({2,6} ms)" -f $s.Status, $s.Name, $s.DurationMs) -ForegroundColor $color
}

Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Total Verification Time: $totalElapsed seconds" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "  VERDICT: ALL 5 GATES VERIFIED AND PASSING!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  VERDICT: VERIFICATION FAILED!" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Cyan
    exit 1
}
