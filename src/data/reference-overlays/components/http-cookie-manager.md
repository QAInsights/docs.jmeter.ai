**TL;DR:** the HTTP Cookie Manager stores and replays cookies automatically across requests in a thread, simulating a real browser's cookie jar (session cookies, CSRF tokens set via `Set-Cookie`). Add one per test plan unless you're deliberately testing cookie-less/API clients.

<!-- FOOTER -->

### Common gotchas

- **Cookie Policy** should almost always stay at the modern default (`standard`) — older RFC2109-style policies exist for legacy compatibility testing only.
- Cookies are stored **per thread** by default; if you need to share a session cookie across threads (rare, and usually a sign your test design should extract the session ID as a variable instead), that requires extra configuration.
- If a request works from a real browser but fails in JMeter with an auth/session error, a missing or misconfigured Cookie Manager is one of the first things to check — see [Works in Browser, Fails in JMeter](/topics/errors/works-in-browser-fails-in-jmeter/).
- Recorded test plans from the [HTTP(S) Test Script Recorder](/topics/http-recorder/) include a Cookie Manager automatically.
