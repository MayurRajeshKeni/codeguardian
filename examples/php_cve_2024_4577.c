// =========================================================================
// Simulation of CVE-2024-4577: PHP-CGI Windows Argument Injection (RCE)
// Flow: HTTP Query -> Best-Fit Bypass -> Arg Accumulator -> system_exec
// CWE-78: OS Command Injection
// =========================================================================

int main() {
    // 1. Ingest untrusted query parameters from HTTP request
    int query_arg = get_param("query_string");

    // 2. Flags simulating the character encoding check
    // In CVE-2024-4577, the ASCII filter looks for '-' (0x2D)
    int has_ascii_hyphen = 0;
    int is_bestfit_bypass = 1;

    int cgi_cmd_buffer = 0;
    int arg_index = 0;
    int max_switches = 2;

    // 3. Flawed validation & bypass branch
    if (has_ascii_hyphen > 0) {
        // [Defensive Branch]: Standard hyphen detected and properly sanitized
        cgi_cmd_buffer = sanitize(query_arg);
    } else {
        // [Vulnerable Bypass Branch]:
        // Soft hyphen (%AD) bypasses the ASCII check, but Windows Best-Fit
        // maps it to '-' in system calls, leaving the tainted argument active!
        cgi_cmd_buffer = query_arg;
    }

    // 4. Argument Vector Dispatcher (Loop Accumulator)
    // Simulates PHP-CGI parsing arguments into switches (-d allow_url_include=1)
    while (arg_index < max_switches) {
        cgi_cmd_buffer = cgi_cmd_buffer + arg_index;
        arg_index = arg_index + 1;
    }

    // 5. Critical Sink: Invocation of php-cgi.exe process
    // The tainted command line reaches system_exec without sanitization!
    system_exec(cgi_cmd_buffer);

    return 0;
}
