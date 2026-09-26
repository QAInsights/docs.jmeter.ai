**TL;DR:** `__CSVRead` reads a value from a CSV file by column and row, function-style — an older alternative to the [CSV Data Set Config](/components/csv-data-set-config/) element, still useful for one-off lookups (e.g. a config value from a small reference file) rather than full per-thread parameterization.

<!-- FOOTER -->

### Example

```
${__CSVRead(data.csv,0)}   → column 0 of the current row
${__CSVRead(data.csv,1)}   → column 1 of the current row
${__CSVRead(*ALIAS,1)}     → reuse a file already opened under an alias
```

For the common case — feeding each thread a different row automatically — [CSV Data Set Config](/components/csv-data-set-config/) is simpler and is the element most test plans should reach for first. See the [CSV Data Set & Parameterization guide](/topics/csv-data-set-config-guide/).
