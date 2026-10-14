// Cross-Site Scripting (XSS) Example: Untrusted input flows to render_output without html_encode (CWE-79)
int main() {
    int raw_comment = get_param("comment");
    int is_admin = 0;
    int payload;

    if (is_admin == 1) {
        payload = html_encode(raw_comment);
    } else {
        // Unsanitized branch: raw user comment reaches the web sink
        payload = raw_comment;
    }

    render_output(payload);
    return 0;
}
