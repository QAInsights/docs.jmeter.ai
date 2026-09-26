**TL;DR:** `__V` (Variable evaluation) resolves a *dynamically built* variable name — e.g. `${__V(row_${__counter(FALSE,)})}` reads `row_1`, `row_2`, ... — solving the "variable name that's itself made of variables" problem that plain `${...}` substitution can't handle in one step.

<!-- FOOTER -->

### Example

```
${__V(row_${__counter(FALSE,)})}   → resolves to the value of row_1, row_2, ... as the counter increments
```

This pattern shows up whenever you've extracted multiple values with `Match No. = -1` (producing `var_1`, `var_2`, ...) and need to loop through them by a computed index — see [__eval](/functions/eval/) for the related "evaluate this string as an expression" function.
