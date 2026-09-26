**TL;DR:** `__groovy` evaluates an inline Groovy expression and returns its result — useful for a one-line computation directly in a field, without a full [JSR223 Sampler/PreProcessor](/components/jsr223-sampler/) element.

<!-- FOOTER -->

### Example

```
${__groovy(1+1)}                              → 2
${__groovy(vars.get("count") as Integer + 1)} → increment a JMeter variable
```

For anything beyond a short expression — multi-line logic, imports, error handling — a [JSR223 PreProcessor](/components/jsr223-preprocessor/) or [PostProcessor](/components/jsr223-postprocessor/) is more maintainable and easier to debug than a one-liner buried inside a field. See the [JSR223 Groovy Scripting Guide](/topics/jsr223-groovy-scripting-guide/).
