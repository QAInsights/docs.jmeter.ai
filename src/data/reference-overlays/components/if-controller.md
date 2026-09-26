**TL;DR:** the If Controller runs its children only when a condition evaluates true — either a JavaScript-style boolean expression or a variable comparison — the standard way to branch test logic (e.g. only retry on a specific error, only run checkout if login succeeded).

<!-- FOOTER -->

### Common gotchas

- **"Interpret Condition as Variable Expression"** switches evaluation mode entirely: unchecked, it evaluates the condition as JavaScript (`"${status}" == "200"`); checked, it treats it as a JMeter variable/function expression that must resolve to the literal string `true`.
- The condition is a **string comparison** by default — `${count} > 5` as JavaScript works, but subtle quoting mistakes (missing `"` around a variable) are the most common reason a seemingly-correct condition never triggers.
- Evaluated once per loop iteration when the controller is reached — it won't re-check mid-way through its children.
- For sequencing rather than branching, see [Loop Controller](/components/loop-controller/) and [While Controller](/components/while-controller/) alongside the [Logic Controllers & Flow Control guide](/topics/logic-controllers-flow-control/).
