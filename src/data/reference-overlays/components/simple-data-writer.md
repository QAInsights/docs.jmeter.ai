**TL;DR:** Simple Data Writer (the underlying engine of most listeners' "Configure" dialog) writes sample results straight to a file in CSV or XML — the lightest-weight way to persist results without a GUI listener's memory overhead during a real load test.

<!-- FOOTER -->

### Common gotchas

- **Never run GUI listeners (View Results Tree, Graph Results) during an actual load test** — they hold every sample in memory and can OOM the JVM or skew results. Use a file-writing listener like this one and analyze afterward.
- CSV output is far more compact than XML and is what the HTML Dashboard Report generator expects — stick with CSV unless something downstream specifically needs XML.
- Choose exactly which fields to save (response data, headers, etc.) — saving response bodies for every sample on a high-throughput test can produce enormous `.jtl` files fast.
- For turning the resulting file into a report, see [Generating the Dashboard Report](/user-manual/generating-dashboard/) and [HTML Dashboard Errors](/topics/errors/html-dashboard-generation-errors/) if generation fails.
