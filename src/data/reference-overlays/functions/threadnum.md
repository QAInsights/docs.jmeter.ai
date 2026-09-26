**TL;DR:** `__threadNum` returns the current thread's number (1, 2, 3, ...) within its Thread Group — useful for deriving per-thread test data (e.g. `user${__threadNum}`) without a CSV file.

<!-- FOOTER -->

### Example

```
${__threadNum}   → e.g. 3 for the third thread started
```

Combine with [__threadGroupName](/functions/threadgroupname/) when a test plan has multiple Thread Groups and per-group-scoped IDs are needed. For genuinely unique values across a distributed run (multiple injectors), prefer [__UUID](/functions/uuid/) — thread numbers restart from 1 on every injector.
