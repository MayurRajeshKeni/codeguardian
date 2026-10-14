// Master Showcase: Multi-path control flow combining loop accumulation,
// conditional sanitization, clean flows, and command injection vulnerability.
int main() {
    int user_id = read_input();
    int cmd = get_param("cmd");
    int count = 0;
    int accumulator = 0;
    int status = 1;

    // 1. Loop accumulator propagating taint across cyclic back-edges
    while (count < 3) {
        accumulator = accumulator + user_id;
        count = count + 1;
    }

    // 2. Branching control flow: one path sanitizes, other leaves tainted
    if (status > 0) {
        // Sanitized path: clean the SQL payload
        accumulator = sanitize(accumulator);
    } else {
        // Unsanitized branch: taint remains active in cmd
        cmd = cmd + 0;
    }

    // 3. Clean sink: accumulator was sanitized along the active branch
    execute_query(accumulator);

    // 4. Vulnerable sink: cmd reached system_exec without sanitization (CWE-78)
    system_exec(cmd);

    return 0;
}
