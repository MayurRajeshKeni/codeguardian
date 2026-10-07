// Test Case 2: Conditional branching and nested if-else
int check_auth(int role, bool is_admin) {
    int access_level = 0;

    if (is_admin && role >= 5) {
        access_level = 100;
    } else {
        if (role > 0) {
            access_level = 10;
        } else {
            access_level = 0;
        }
    }

    return access_level;
}
