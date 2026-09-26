**TL;DR:** the HTTP Request sampler is the workhorse of almost every JMeter test plan — it sends one HTTP/HTTPS call and records the response. Everything else (extractors, assertions, timers) usually hangs off this element.

<!-- FOOTER -->

### Common gotchas

- **Don't hardcode auth tokens.** Extract them once (login response) and reuse via a variable — see [Correlation & Dynamic Values](/topics/correlation-dynamic-values/).
- **Retrieve embedded resources** only if you're deliberately modeling real browser load (images/CSS/JS); for pure API load testing it just adds noise and skews response times.
- **Connect/response timeouts default to 0 (infinite).** A single hung request can silently stall a whole thread — set explicit timeouts under "Advanced" for anything hitting a real network.
- Prefer [HTTP Request Defaults](/components/http-request-defaults/) for shared server/protocol/timeout settings across many samplers instead of repeating them.
