**TL;DR:** the Loop Controller repeats its children a fixed number of times (or forever) within a single thread iteration — the basic building block for "do this sequence N times" inside a larger test plan.

<!-- FOOTER -->

### Common gotchas

- **"Forever"** here means "forever within this thread's iteration," not "forever for the whole test" — the enclosing Thread Group's loop count still governs the outer repetition.
- Nesting a Loop Controller inside another Loop Controller multiplies iterations (`outer × inner`) — a common source of accidentally-huge request counts when someone forgets an existing outer loop.
- For conditional repetition instead of a fixed count, use [While Controller](/components/while-controller/); for a single conditional branch, use [If Controller](/components/if-controller/).
- See [Logic Controllers & Flow Control](/topics/logic-controllers-flow-control/) for how loop, branch, and grouping controllers combine in a realistic test plan.
