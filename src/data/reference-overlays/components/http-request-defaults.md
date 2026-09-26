**TL;DR:** HTTP Request Defaults sets shared server, port, protocol, path prefix, and timeout values that every [HTTP Request](/components/http-request/) underneath it inherits — the standard way to avoid repeating the same hostname on 50 samplers.

<!-- FOOTER -->

### Common gotchas

- Values here are **defaults, not overrides** — if an individual HTTP Request has its own server/port filled in, that sampler's value wins, which can cause "why is this one request hitting the wrong host" confusion after a copy-paste.
- Great place to centralize **Connect/Response timeouts** so every request in a scope gets a sane timeout without configuring each sampler individually.
- Works well combined with a variable for the hostname (`${host}`) so switching environments (staging vs. production) is a single property change — see the [API Load Testing Guide](/topics/api-load-testing/).
- Scope it at the Thread Group (or higher) level for test-plan-wide defaults, or lower in the tree for per-flow overrides.
