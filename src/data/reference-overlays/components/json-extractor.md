**TL;DR:** the JSON Extractor pulls a value out of a JSON response using JSONPath, so a later request can reuse it (auth tokens, IDs, pagination cursors). It's the modern replacement for regex-scraping JSON bodies.

<!-- FOOTER -->

### Common gotchas

- Set a **Default Value** (e.g. `NOT_FOUND`) for every extraction. Without one, a failed match silently leaves the variable unset instead of failing loudly — see the [Extractor Default Value playbook](/topics/errors/extractor-not-found-default-value/).
- **Match No.** `0` means "random match"; use `-1` to capture every match into `var_1`, `var_2`, ... and `var_matchNr` for the count.
- JSONPath here is Jayway JsonPath syntax (`$.data.items[0].id`), not the same dialect as some online JSONPath testers — verify against actual JMeter behavior before assuming a path is wrong.
- For deeply nested or highly dynamic payloads, a [JSR223 PostProcessor](/components/jsr223-postprocessor/) with a JSON library is sometimes more maintainable than a long JSONPath expression.
