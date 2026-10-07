// Command Injection Example: Branching path leaves variable unsanitized before system_exec (CWE-78)
int main() {
    int cmd = get_param("cmd");
    int condition = 1;

    if (condition > 0) {
        cmd = sanitize(cmd);
    } else {
        // Unsanitized branch
        cmd = cmd;
    }

    system_exec(cmd);
    return 0;
}
