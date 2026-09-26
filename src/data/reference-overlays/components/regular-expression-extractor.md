**TL;DR:** the Regular Expression Extractor pulls a value out of *any* response body (HTML, JSON, plain text, headers) using a regex with capture groups. Use it when the response isn't clean JSON, or when a JSON extractor's JSONPath would be more fragile than a targeted regex.

<!-- FOOTER -->

### Common gotchas

- Always set a **Default Value**, otherwise a non-match leaves the variable undefined rather than failing the sample — see the [Extractor Default Value playbook](/topics/errors/extractor-not-found-default-value/).
- **Template `$1$`** refers to capture group 1; `$0$` is the whole match. Forgetting the group number is the single most common cause of "it extracts nothing."
- The **Match No.** field behaves the same as in the JSON Extractor: `0` = random match, `-1` = capture all matches with `_matchNr` suffix.
- For structured JSON, prefer the [JSON Extractor](/components/json-extractor/) — regex against JSON is brittle the moment whitespace or key order changes upstream.
