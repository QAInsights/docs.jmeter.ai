**TL;DR:** `__property` reads a JMeter property (JVM-level config, not a per-thread variable) — the standard way to make a test plan configurable from outside without editing the `.jmx` (environment name, base URL, feature flags).

<!-- FOOTER -->

### Example

```
${__property(user.dir)}              → value of the "user.dir" JMeter property
${__property(abcd,ABCD,atod)}        → value of "abcd" (or "atod" default), saved to variable ABCD
${__property(abcd,,atod)}            → same lookup, without saving to a variable
```

For properties set specifically via the `-J` CLI flag, [__P](/functions/p/) is a shorter alternative. See the [Properties Reference](/user-manual/properties-reference/) for JMeter's built-in tuning properties and the [CLI Command Builder](/tools/cli-builder/) for constructing `-J` flags.
