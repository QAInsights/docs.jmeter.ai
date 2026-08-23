/**
 * Tokenize pasted POSIX-like shell text into cURL argv arrays.
 *
 * Supported command separators are newline and `;`. Conditionals, shell
 * expansion, pipelines, redirections, and background jobs are rejected because
 * the browser/MCP converter cannot reproduce their effective argv safely.
 */
function startsShellExpansion(next) {
  return next === '(' || next === '{' || next === "'" || next === '"' || /[A-Za-z0-9_@*#?$!-]/.test(next || '');
}

export function tokenizeCurlStream(text, maxInputChars = 1_000_000) {
  if (!text || typeof text !== 'string') return [];
  if (text.length > maxInputChars) {
    throw new Error(`Input exceeds maximum size of ${maxInputChars} characters.`);
  }

  const commands = [];
  let tokens = [];
  let token = '';
  let tokenStarted = false;
  let quote = null;
  let inComment = false;

  const finishToken = () => {
    if (!tokenStarted) return;
    tokens.push(token);
    token = '';
    tokenStarted = false;
  };

  const finishCommand = () => {
    finishToken();
    if (tokens.length === 0) return;
    if (tokens[0].toLowerCase() !== 'curl') {
      throw new Error(`Unsupported shell command "${tokens[0]}". Paste cURL commands only.`);
    }
    commands.push(tokens);
    tokens = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inComment) {
      if (char === '\n' || char === '\r') {
        inComment = false;
        finishCommand();
        if (char === '\r' && next === '\n') i++;
      }
      continue;
    }

    if (quote === "'") {
      if (char === "'") quote = null;
      else token += char;
      tokenStarted = true;
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null;
        tokenStarted = true;
        continue;
      }
      if (char === '\\') {
        if (next === '\n' || next === '\r') {
          if (next === '\r' && text[i + 2] === '\n') i++;
          i++;
          continue;
        }
        if (next === '$' || next === '`' || next === '"' || next === '\\') {
          token += next;
          tokenStarted = true;
          i++;
          continue;
        }
        token += '\\';
        tokenStarted = true;
        continue;
      }
      if (char === '`' || (char === '$' && startsShellExpansion(next))) {
        throw new Error('Security error: Unsupported shell expansion in cURL input. Resolve shell variables/substitutions before converting.');
      }
      token += char;
      tokenStarted = true;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      tokenStarted = true;
      continue;
    }

    if (char === '\\') {
      if (next === undefined) throw new Error('Malformed cURL input: trailing backslash.');
      if (next === '\n' || next === '\r') {
        if (next === '\r' && text[i + 2] === '\n') i++;
        i++;
        continue;
      }
      token += next;
      tokenStarted = true;
      i++;
      continue;
    }

    if (char === '#') {
      if (!tokenStarted) {
        inComment = true;
        continue;
      }
      token += char;
      tokenStarted = true;
      continue;
    }

    if (char === '`' || (char === '$' && startsShellExpansion(next))) {
      throw new Error('Security error: Unsupported shell expansion in cURL input. Resolve shell variables/substitutions before converting.');
    }

    // These constructs are expanded by common POSIX shells before cURL sees
    // argv. Detect them while quote/escape context is still available; after
    // tokenization there is no reliable way to distinguish a literal from an
    // expansion. Quoted or backslash-escaped characters are handled above and
    // remain valid literals.
    if (char === '~' && !tokenStarted) {
      throw new Error('Security error: Unsupported unquoted tilde expansion in cURL input. Quote or escape the literal value before converting.');
    }
    if (char === '*' || char === '?' || char === '[') {
      throw new Error('Security error: Unsupported unquoted pathname expansion in cURL input. Quote or escape glob metacharacters before converting.');
    }
    if (char === '{' || char === '}') {
      throw new Error('Security error: Unsupported unquoted brace expansion in cURL input. Quote or escape braces before converting.');
    }

    if (char === '\n' || char === '\r' || char === ';') {
      finishCommand();
      if (char === '\r' && next === '\n') i++;
      continue;
    }

    if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
      throw new Error(`Unsupported conditional shell operator "${char}${next}". JMeter linear plans cannot preserve conditional execution semantics.`);
    }

    if (char === '|' || char === '&' || char === '<' || char === '>') {
      throw new Error(`Unsupported shell operator "${char}" in cURL input.`);
    }

    if (/\s/.test(char)) {
      finishToken();
      continue;
    }

    token += char;
    tokenStarted = true;
  }

  if (quote) throw new Error('Malformed cURL input: unterminated quoted string.');
  finishCommand();
  return commands;
}
