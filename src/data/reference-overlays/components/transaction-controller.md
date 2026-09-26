**TL;DR:** the Transaction Controller groups several samplers into one logical "transaction" and reports their combined elapsed time as a single result — use it to measure a multi-request business flow (login + fetch + checkout) as one number instead of N separate ones.

<!-- FOOTER -->

### Common gotchas

- **"Generate parent sample"** must be checked to get the combined transaction result; unchecked, it's purely a grouping/organizational element in the tree and reports nothing extra.
- **"Include duration of timers and pre-post processors"** changes what counts toward the transaction time — leave it on if think time between the grouped requests is part of what you're measuring (real user flow time), off if you only care about server-side request time.
- Nesting Transaction Controllers works, but deeply nested transactions make listener output harder to read — one level per logical business flow is usually enough.
- Pair with [SLA thresholds](/topics/jmeter-assertions-guide/) on the transaction's own elapsed time when the business flow (not the individual request) is what has an SLA.
