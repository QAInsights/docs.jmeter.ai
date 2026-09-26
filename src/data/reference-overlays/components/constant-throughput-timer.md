**TL;DR:** the Constant Throughput Timer pads each sample with just enough delay to hold the whole test (or a scope of it) at a target requests-per-minute rate, regardless of how many threads are running.

<!-- FOOTER -->

### Common gotchas

- The name is misleading: it's **throughput per minute**, not per second — a target of `600` means 10 requests/sec, not 600/sec.
- **"Calculate Throughput based on"** matters: "this timer" vs "all active threads in current thread group" vs "all active threads" change whether the rate is per-timer-instance or shared across threads — pick the scope that matches what you're modeling.
- This timer can only slow requests *down* to the target; if your server can't keep up, throughput will fall below target regardless of the setting, and you're measuring server capacity, not the timer.
- For step/ramp load shapes instead of a flat target rate, a **Concurrency Thread Group** with staged ramps is usually a better fit than throttling with this timer alone.
