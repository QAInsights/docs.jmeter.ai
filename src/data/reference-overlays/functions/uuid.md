**TL;DR:** `__UUID` returns a random RFC 4122 UUID (v4) — the standard choice for a genuinely unique identifier per request (idempotency keys, correlation IDs, unique record creation) where a sequential counter would collide across parallel test runs.

<!-- FOOTER -->

### Example

```
${__UUID()}   → e.g. 8f14e45f-ceea-467e-b7d1-9d1946a4c8b1
```

Common use: an `Idempotency-Key` header on a payment/order-creation [HTTP Request](/components/http-request/), or a unique record name so repeated test runs don't collide on a unique-constraint. For sequential (not random) unique values, see [__counter](/functions/counter/).
