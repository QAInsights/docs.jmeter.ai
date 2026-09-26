**TL;DR:** `__RandomString` generates a random string of a given length, optionally from a specific character set — handy for unique-ish usernames, search terms, or filler payload data.

<!-- FOOTER -->

### Example

```
${__RandomString(5)}                     → random 5-char string
${__RandomString(10,abcdefg)}            → 10 chars from "abcdefg" only
${__RandomString(6,a12zeczclk,myVar)}    → stored in variable "myVar" too
```

Not cryptographically random — don't use this to generate anything security-sensitive (tokens, secrets). For unique IDs instead of random noise, see [__UUID](/functions/uuid/).
