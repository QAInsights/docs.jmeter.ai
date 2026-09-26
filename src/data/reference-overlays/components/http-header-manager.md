**TL;DR:** the HTTP Header Manager sets custom HTTP headers (Authorization, Content-Type, custom API keys) on every request in its scope — the standard place to inject a bearer token or API key without repeating it on every sampler.

<!-- FOOTER -->

### Common gotchas

- Scope it at the right level: a Header Manager on the Thread Group applies to every request underneath; one on a single sampler overrides just that request — duplicate/conflicting headers at different scopes is a common source of confusing behavior.
- **Content-Type** set here can be silently overridden by JMeter itself for some body types (e.g. multipart) — if a header isn't appearing as expected, check whether the sampler is auto-setting it.
- For dynamic values (a token that changes per iteration), reference a variable in the header value (`Bearer ${authToken}`) rather than hardcoding it — see [JWT, OAuth & SSO Authentication](/topics/jwt-oauth-sso/).
- If requests return 401/403 only in JMeter, compare the actual sent headers (View Results Tree → Request tab) against a working browser request — see [HTTP 401/403 after recording](/topics/errors/401-403-after-recording/).
