# CodeGuardian Test Runner - Comprehensive Verification Suite
param(
    [string]$BinaryPath = "compiler_core/bin/codeguardian-frontend.exe"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   CodeGuardian Comprehensive Test Verification Suite       " -ForegroundColor Cyan
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

$examples = @(
    "clean_flow.c",
    "sql_injection.c",
    "command_injection.c",
    "complex_loop.c"
)

$passed = 0
$failed = 0

Write-Host "`n--- [PART 1: Unit Test Suite in compiler_core/tests/] ---" -ForegroundColor Magenta

foreach ($t in $tests) {
    $filePath = if (Test-Path "compiler_core/tests/$($t.Name)") { "compiler_core/tests/$($t.Name)" } else { "tests/$($t.Name)" }
    Write-Host "`n--> Testing: $($t.Name)" -ForegroundColor Yellow
    
    # 1. Lexer mode
    $lexOutput = & $BinaryPath --lex $filePath 2>&1
    $lexExit = $LASTEXITCODE

    # 2. Parser mode
    $parseOutput = & $BinaryPath --parse $filePath 2>&1
    $parseExit = $LASTEXITCODE

    if ($t.ExpectSuccess) {
        # 3. CFG mode (validate JSON validity)
        $cfgJson = & $BinaryPath --cfg $filePath 2>&1 | Out-String
        $cfgExit = $LASTEXITCODE
        $validJson = $false
        try {
            $parsedObj = $cfgJson | ConvertFrom-Json
            if ($parsedObj.version -and $parsedObj.blocks -and $parsedObj.entryBlock) {
                $validJson = $true
            }
        } catch {
            $validJson = $false
        }

        if ($lexExit -eq 0 -and $parseExit -eq 0 -and $cfgExit -eq 0 -and $validJson) {
            Write-Host "    [PASS] $($t.Name) passed Lexer, Parser, and emitted valid CFG.json." -ForegroundColor Green
            $passed++
        } else {
            Write-Host "    [FAIL] Expected success for $($t.Name), but failed. (Lex: $lexExit, Parse: $parseExit, CFG: $cfgExit, ValidJson: $validJson)" -ForegroundColor Red
            $failed++
        }
    } else {
        if ($lexExit -ne 0 -or $parseExit -ne 0) {
            Write-Host "    [PASS] $($t.Name) correctly rejected invalid syntax/lexemes fail-closed." -ForegroundColor Green
            $passed++
        } else {
            Write-Host "    [FAIL] Expected failure for $($t.Name), but it unexpectedly succeeded." -ForegroundColor Red
            $failed++
        }
    }
}

Write-Host "`n--- [PART 2: Shared Benchmark Suite in examples/] ---" -ForegroundColor Magenta

foreach ($ex in $examples) {
    $exPath = if (Test-Path "examples/$ex") { "examples/$ex" } else { "../examples/$ex" }
    Write-Host "`n--> Benchmarking Example: $ex" -ForegroundColor Yellow

    $cfgJson = & $BinaryPath --cfg $exPath 2>&1 | Out-String
    $cfgExit = $LASTEXITCODE

    $validJson = $false
    try {
        $parsedObj = $cfgJson | ConvertFrom-Json
        if ($parsedObj.version -and $parsedObj.blocks -and $parsedObj.entryBlock) {
            $validJson = $true
        }
    } catch {
        $validJson = $false
    }

    if ($cfgExit -eq 0 -and $validJson) {
        Write-Host "    [PASS] $ex synthesized CFG with $($parsedObj.blocks.Count) blocks, $($parsedObj.edges.Count) edges." -ForegroundColor Green
        $passed++
    } else {
        Write-Host "    [FAIL] $ex failed CFG synthesis or JSON validation." -ForegroundColor Red
        $failed++
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
