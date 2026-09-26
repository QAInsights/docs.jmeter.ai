**TL;DR:** `__P` is the short form of [__property](/functions/property/) built specifically for command-line overrides (`jmeter -Jgroup1.threads=7`) — no variable-saving option, and its implicit default is `1` (chosen to be a safe fallback for thread counts, loops, and ramp-up).

<!-- FOOTER -->

### Example

```bash
jmeter -Jgroup1.threads=7 -Jhostname1=www.example.com
```

```
${__P(group1.threads)}              → 7
${__P(group1.loops)}                → 1 (undefined property, implicit default)
${__P(hostname,www.dummy.org)}      → www.dummy.org (undefined, explicit default)
```

This is the standard pattern behind CI/CD load tests that tune concurrency per environment without editing the `.jmx` file — see the [CLI Command Builder](/tools/cli-builder/) to construct the `-J` flags.
