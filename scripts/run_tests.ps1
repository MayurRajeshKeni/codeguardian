# CodeGuardian Test Runner - Member 1 Verification Suite
param(
    [string]$BinaryPath = "compiler_core/bin/codeguardian-frontend.exe"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CodeGuardian Member 1 Phase 1 Test Verification Harness   " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $BinaryPath)) {
    Write-Host "[ERROR] Binary not found at $BinaryPath. Please build first." -ForegroundColor Red
    exit 1
}

$tests = @(
    @{ Name = "test_simple.c"; ExpectSuccess = $true },
    @{ Name = "test_branch.c"; ExpectSuccess = $true },
    @{ Name = "test_loop.c"; ExpectSuccess = $true },
    @{ Name = "test_sanitize.c"; ExpectSuccess = $true },
    @{ Name = "test_collision.c"; ExpectSuccess = $true },
    @{ Name = "test_invalid.c"; ExpectSuccess = $false }
)

$passed = 0
$failed = 0

foreach ($t in $tests) {
    $filePath = if (Test-Path "compiler_core/tests/$($t.Name)") { "compiler_core/tests/$($t.Name)" } else { "tests/$($t.Name)" }
    Write-Host "`n--> Testing: $($t.Name)" -ForegroundColor Yellow
    
    # Run Lexer mode
    Write-Host "    [LEX MODE]" -ForegroundColor DarkGray
    & $BinaryPath --lex $filePath | Out-Host
    $lexExit = $LASTEXITCODE

    # Run Parser mode
    Write-Host "    [PARSE MODE]" -ForegroundColor DarkGray
    & $BinaryPath --parse $filePath | Out-Host
    $parseExit = $LASTEXITCODE

    if ($t.ExpectSuccess) {
        if ($lexExit -eq 0 -and $parseExit -eq 0) {
            Write-Host "    [PASS] $($t.Name) successfully tokenized and parsed." -ForegroundColor Green
            $passed++
        } else {
            Write-Host "    [FAIL] Expected success for $($t.Name), but exited with code ($lexExit, $parseExit)" -ForegroundColor Red
            $failed++
        }
    } else {
        if ($lexExit -ne 0 -or $parseExit -ne 0) {
            Write-Host "    [PASS] $($t.Name) correctly rejected invalid syntax/lexemes." -ForegroundColor Green
            $passed++
        } else {
            Write-Host "    [FAIL] Expected failure for $($t.Name), but it unexpectedly succeeded." -ForegroundColor Red
            $failed++
        }
    }
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  Summary: $passed PASSED, $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "============================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
