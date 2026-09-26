**TL;DR:** the Thread Group is the container that defines how many virtual users run, how fast they ramp up, and for how long. Every test plan needs at least one; how you size it decides whether your test actually models real load or just floods the server.

<!-- FOOTER -->

### Common gotchas

- **Number of Threads ≠ concurrent requests.** With think time and non-trivial response times, threads spend most of their time waiting, not requesting — use the [Thread Calculator](/tools/thread-calculator/) to size threads from a target RPS.
- **Ramp-up period of 0** starts every thread at once — a thundering-herd spike, rarely what you want for realistic load. A ramp-up roughly equal to the thread count (in seconds) is a reasonable starting point.
- Prefer the **Concurrency Thread Group** (plugin) or **Ultimate Thread Group** over the classic one when you need staged/variable load profiles — the classic group can only ramp up once.
- For distributed runs, each injector's Thread Group count is *per injector*, not total — see [Distributed Load Testing](/topics/distributed-testing/).
