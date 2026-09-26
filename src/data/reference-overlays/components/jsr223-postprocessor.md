**TL;DR:** the JSR223 PostProcessor runs Groovy code right after its parent sampler completes — the go-to spot for extraction logic too complex for the JSON or Regular Expression Extractor (nested conditionals, multi-step parsing, custom validation).

<!-- FOOTER -->

### Common gotchas

- `prev` (the `SampleResult`) gives you `prev.getResponseDataAsString()`, headers, response code, and timing — you rarely need to re-parse anything the built-in extractors already exposed.
- Anything you `vars.put(...)` here is visible to *later* samplers in the same thread, not earlier ones — order in the test tree matters.
- If you're just pulling one JSON field, reach for the [JSON Extractor](/components/json-extractor/) first; scripting adds maintenance cost that's only worth it for genuinely custom logic.
- Exceptions here don't automatically fail the sample — catch and call `prev.setSuccessful(false)` (or similar) if a parsing failure should count as a test failure.
