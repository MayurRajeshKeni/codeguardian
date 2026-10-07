// Complex Loop Example: Taint accumulated across loop iterations
int main() {
    int data = read_input();
    int count = 0;
    int accumulator = 0;

    while (count < 5) {
        accumulator = accumulator + data;
        count = count + 1;
    }

    execute_query(accumulator);
    return 0;
}
