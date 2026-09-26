**TL;DR:** `__counter` returns an incrementing integer, either per-thread (independent counters) or global (shared across all threads) — useful for unique sequential IDs without a CSV file.

<!-- FOOTER -->

### Example

```
${__counter(TRUE)}          → per-thread counter, starts at 1 for each thread
${__counter(FALSE,cnt)}     → global counter shared by all threads, saved to "cnt"
```

Multiple `__counter` calls within the *same* iteration don't increment further — only one increment per iteration, no matter how many times you reference it. If you need one increment per sample instead, put the counter logic in a Pre-Processor. For genuinely unique (not just sequential) values, see [__UUID](/functions/uuid/).
