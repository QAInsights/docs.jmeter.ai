**TL;DR:** the Response Assertion checks a sample's response (body, code, message, or headers) against a pattern and fails the sample if it doesn't match — the primary way to catch "200 OK but wrong content" failures that raw HTTP status codes miss.

<!-- FOOTER -->

### Common gotchas

- **Test field** matters: "Text Response" checks the body, but for APIs you usually also want a "Response Code" assertion — a 500 error page can still return `200 OK` from a misbehaving upstream proxy.
- **"Contains" vs "Matches"**: "Contains" does a substring/regex search anywhere in the field; "Matches" requires the whole field to match the pattern. Picking the wrong one is a common source of false failures.
- Assertions only run if the sampler executes — if a request times out entirely, you'll see a sampler error, not a failed assertion; check both when triaging failures.
- For SLA-style pass/fail criteria (percentile thresholds, not just content checks), see [Assertions & SLA Validation](/topics/jmeter-assertions-guide/).
