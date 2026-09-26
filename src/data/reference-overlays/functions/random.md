**TL;DR:** `__Random` returns a random integer between a min and max value — the simplest way to add variety to a request (random product ID, random delay, random page number) without a CSV file.

<!-- FOOTER -->

### Example

```
${__Random(0,10)}            → a random number between 0 and 10
${__Random(1000,9999,pin)}   → stored in variable "pin" too
```

For weighted or larger datasets, a [CSV Data Set Config](/components/csv-data-set-config/) usually models real traffic more accurately than a uniform random range.
