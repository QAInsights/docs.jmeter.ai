**TL;DR:** the Throughput Controller runs its children only a percentage of the time (or an exact total count), letting you model realistic traffic mixes — e.g. 70% browse, 20% search, 10% checkout — inside one Thread Group.

<!-- FOOTER -->

### Common gotchas

- **"Percent Execution"** is evaluated per-thread, per-loop — it's a probability each time the controller is reached, not a hard global ratio across the whole test. Over a long run the actual percentage converges close to the target, but short tests can drift.
- **"Total Executions"** runs the children an exact number of times total across *all* threads, then goes idle — different semantics from percent mode, useful for "run this exactly N times regardless of load."
- If overall throughput looks stuck regardless of this controller's settings, the bottleneck is usually elsewhere (threads, pacing, or the target service) — see [Throughput stuck](/topics/errors/throughput-stuck/).
- Combine with a [Constant Throughput Timer](/components/constant-throughput-timer/) when you need an absolute requests/minute cap rather than a relative execution ratio.
