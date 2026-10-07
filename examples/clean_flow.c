// Clean Flow Example: Source -> Sanitize -> Sink (0 vulnerabilities)
int main() {
    int user_input = read_input();
    int clean_input = sanitize(user_input);
    execute_query(clean_input);
    return 0;
}
