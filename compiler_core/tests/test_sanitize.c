// Test Case 4: Security primitives, sanitization, and function calls
void handle_request() {
    int user_input = read_input();
    int clean_input = sanitize(user_input);
    execute_query(clean_input);
}
