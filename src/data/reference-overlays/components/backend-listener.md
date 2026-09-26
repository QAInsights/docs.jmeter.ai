**TL;DR:** the Backend Listener streams live sample results to an external time-series backend (InfluxDB, Graphite, Elasticsearch, Prometheus via a bridge) during the run, so you can watch a real-time dashboard instead of waiting for the test to finish and parsing a `.jtl` file.

<!-- FOOTER -->

### Common gotchas

- It runs **asynchronously in a queue** — under very high throughput, an undersized queue can drop metrics rather than block the test; increase `async.queue.size` if you see gaps in the dashboard that don't match the actual run.
- This is the right tool for **live observability**; it doesn't replace the standard `.jtl` results file or the HTML Dashboard Report for post-run analysis and archiving.
- Configuration (URL, database/bucket, application name tag) is backend-specific — see [Grafana / InfluxDB / Backend Listener](/topics/grafana-influx-backend-listener/) for a working setup.
- Adds CPU/network overhead on the injector itself; on already-saturated load generators, consider a lighter listener or sampling instead.
