**TL;DR:** CSV Data Set Config feeds each thread a row from a CSV file (usernames, IDs, search terms) so your load test doesn't hammer the same input on every iteration. It's the standard way to parameterize a test plan with real-world variety.

<!-- FOOTER -->

### Common gotchas

- **"Sharing mode"** controls whether threads share one cursor through the file or each get their own — "All threads" (default) is usually right for distributed-unique data like unique usernames.
- Set **Recycle on EOF** to `False` and **Stop thread on EOF** to `True` if every row must be used at most once (e.g. one-time signup tokens); otherwise JMeter loops back to row 1 silently.
- File paths are relative to the `.jmx` file by default, which breaks when running distributed — see [CSV Data Set & Sharing Issues](/topics/errors/csv-data-set-file-not-found-sharing/) for the fix.
- For structured parameterization strategy (unique vs. shared data, distributed file placement), see the [CSV Data Set & Parameterization guide](/topics/csv-data-set-config-guide/).
