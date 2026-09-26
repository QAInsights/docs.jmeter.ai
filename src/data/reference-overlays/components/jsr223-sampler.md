**TL;DR:** the JSR223 Sampler runs arbitrary Groovy (or other JSR223) code as the sample itself — useful for protocols JMeter has no built-in sampler for, or for generating a sample result around custom logic (crypto handshakes, SDK calls, batch simulation).

<!-- FOOTER -->

### Common gotchas

- **Always use Groovy**, never BeanShell — Groovy is compiled and cached, BeanShell is interpreted fresh every iteration and is dramatically slower under load.
- Set `SampleResult.setSuccessful(false)` explicitly on failure paths; an uncaught exception marks the sample an error, but logic errors that don't throw won't fail the sample unless you say so.
- Cache expensive setup (compiled patterns, HTTP clients, parsed config) in a `bsh.shared` alternative — for Groovy, prefer a `Pre-Processor`-level one-time init or a static field, not per-iteration work.
- For full recipes (JWT decoding, HMAC signing, dynamic headers), see the [JSR223 Groovy Scripting Guide](/topics/jsr223-groovy-scripting-guide/) and the MCP `get_jsr223_recipe` tool.
