**TL;DR:** the While Controller repeats its children as long as a condition stays true (or forever, if left blank, until the enclosing loop/thread stops) — the standard element for polling patterns like "keep checking job status until it's done."

<!-- FOOTER -->

### Common gotchas

- **A blank condition means loop forever** (until the thread is told to stop) — a very common way to accidentally hang a test plan; always set an explicit exit condition or a max-iteration guard variable.
- The condition is re-evaluated **after** each pass through the children, so the loop always runs at least once — model that if your logic assumes a "check first, then maybe run" pattern.
- Same JavaScript-expression syntax as [If Controller](/components/if-controller/) (`"${done}" != "true"`), including the same quoting pitfalls.
- For polling with a bounded wait, pair with a Constant Timer inside the loop (see [Timers, Think Time & Pacing](/topics/timers-pacing-throughput-modeling/)) so you're not hammering the endpoint every iteration.
