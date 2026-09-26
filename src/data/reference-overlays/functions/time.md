**TL;DR:** `__time` returns the current date/time, formatted however you specify (or epoch milliseconds by default) — the standard way to stamp requests with a live timestamp for signing, cache-busting, or unique identifiers.

<!-- FOOTER -->

### Example

```
${__time(dd/MM/yyyy,)}   → 21/01/2026
${__time(/1000,)}        → epoch seconds
${__time(YMD,)}          → 20260121 (shorthand alias)
${__time(,epochMs)}      → epoch millis, stored in var "epochMs"
```

Frequently paired with HMAC signing in a [JSR223 PreProcessor](/components/jsr223-preprocessor/) for APIs that require a timestamp in the request signature.
