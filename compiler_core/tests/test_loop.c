// Test Case 3: While loop iteration and compound logic
int compute_sum(int max_count) {
    int sum = 0;
    int i = 1;

    while (i <= max_count) {
        sum = sum + i;
        i = i + 1;
    }

    return sum;
}
