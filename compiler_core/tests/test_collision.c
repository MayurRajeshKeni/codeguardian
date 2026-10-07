/*
 * Test Case 5: Lexical Collision & Boundary Verification
 * Verifies that keywords vs identifiers, multi-char vs single-char operators,
 * comments, and escape sequences do not produce lexical collisions.
 */
int test_lexical_boundaries() {
    // 1. Identifiers that start with keyword substrings:
    int internal_counter = 100;
    bool boolean_status = true;
    int void_value = 0;
    int if_branch_taken = 1;
    int else_path = 2;
    int while_loop_index = 3;
    int return_code = 4;

    /* 2. Multi-char operators next to each other and assignments */
    bool check1 = (internal_counter == 100) && (boolean_status != false);
    bool check2 = (internal_counter <= 200) || (internal_counter >= 50);
    bool check3 = !boolean_status;

    // 3. String literals with embedded escapes and spaces
    get_param("admin_user");
    system_exec("cat /var/log/system.log");

    /* 4. Arithmetic operators and comments inside expressions */
    int res = internal_counter + 5 - 2 * 3 / 1 % 4;

    return res;
}
