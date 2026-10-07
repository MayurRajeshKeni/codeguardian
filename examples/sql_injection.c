// SQL Injection Example: Direct unsanitized flow into execute_query (CWE-89)
int main() {
    int user_input = read_input();
    execute_query(user_input);
    return 0;
}
