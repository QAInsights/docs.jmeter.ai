**TL;DR:** the JSR223 PreProcessor runs Groovy code immediately before its parent sampler fires — the standard place to build a signed request, compute a timestamp-based header, or mutate a variable right before it's used.

<!-- FOOTER -->

### Common gotchas

- It runs **before** the sampler's request is built from the JMeter GUI fields, but variable substitution in those fields happens at request-build time — so setting a JMeter variable here (`vars.put(...)`) and referencing it as `${myVar}` in the sampler works correctly.
- Scope matters: a PreProcessor attached directly to a sampler only runs for that sampler; one attached to a Thread Group or Controller runs before every sampler underneath it.
- Prefer Groovy over BeanShell for the same reason as the [JSR223 Sampler](/components/jsr223-sampler/) — BeanShell's per-iteration interpretation cost adds up fast across thousands of iterations.
- Common use: computing an HMAC signature or JWT right before an [HTTP Request](/components/http-request/) that needs it in a header.
