import { describe, it, expect } from 'vitest';
import { normalizeDocPath, findChunkByPath, GET, runCurlHarConversionTool } from '../../src/pages/api/mcp.ts';
import { INDEX } from '../../src/lib/rag.mjs';

describe('normalizeDocPath', () => {
  it('accepts full URLs', () => {
    expect(normalizeDocPath('https://docs.jmeter.ai/topics/api-load-testing/')).toBe(
      'topics/api-load-testing',
    );
  });

  it('accepts absolute and bare paths', () => {
    expect(normalizeDocPath('/user-manual/functions/')).toBe('user-manual/functions');
    expect(normalizeDocPath('user-manual/functions')).toBe('user-manual/functions');
  });

  it('strips file extensions and surrounding slashes', () => {
    expect(normalizeDocPath('/topics/errors/connect-exception.mdx')).toBe(
      'topics/errors/connect-exception',
    );
    expect(normalizeDocPath('//tools///')).toBe('tools');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDocPath('')).toBe('');
    expect(normalizeDocPath('///')).toBe('');
  });
});

describe('findChunkByPath', () => {
  it('finds a known indexed page by bare path', () => {
    const chunk = findChunkByPath('getting-started/get-started');
    expect(chunk).toBeDefined();
    expect(chunk.title).toBeTruthy();
    expect(chunk.url).toContain('docs.jmeter.ai');
  });

  it('finds the same page regardless of input shape', () => {
    const a = findChunkByPath('https://docs.jmeter.ai/getting-started/get-started/');
    const b = findChunkByPath('/getting-started/get-started');
    const c = findChunkByPath('getting-started/get-started/');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('returns undefined for unknown paths', () => {
    expect(findChunkByPath('does/not/exist')).toBeUndefined();
    expect(findChunkByPath('')).toBeUndefined();
  });

  it('every chunk URL is a docs.jmeter.ai URL agents can cite', () => {
    for (const chunk of INDEX) {
      expect(chunk.url.startsWith('https://docs.jmeter.ai/')).toBe(true);
    }
  });
});

describe('GET /api/mcp endpoint discovery', () => {
  it('advertises all 10 MCP tools and streamable HTTP metadata', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('jmeter-docs');
    expect(body.transport).toBe('streamable-http');
    expect(body.tools).toContain('search_jmeter_docs');
    expect(body.tools).toContain('get_jmeter_page');
    expect(body.tools).toContain('convert_curl_or_har_to_jmx');
    expect(body.tools).toContain('lint_jmx_snippet');
    expect(body.tools).toContain('calculate_workload_model');
    expect(body.tools).toContain('plan_distributed_testing');
    expect(body.tools).toContain('tune_linux_os');
    expect(body.tools).toContain('lookup_jmeter_property');
    expect(body.tools).toContain('get_jsr223_recipe');
    expect(body.tools).toContain('lookup_error_playbook');
    expect(body.tools).toHaveLength(10);
  });
});

describe('convert_curl_or_har_to_jmx MCP policy', () => {
  it('returns a tool error for unresolved files instead of a runnable plan', () => {
    const response = runCurlHarConversionTool({
      input: 'curl --data-binary @payload.json https://api.example/items',
    });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/Conversion blocked.*payload\.json/s);
  });

  it('returns a tool error for unsupported critical routing or TLS options', () => {
    const response = runCurlHarConversionTool({
      input: 'curl --cert client.pem --proxy http://proxy.example:8080 https://api.example/items',
    });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/Conversion blocked.*--cert/s);
  });

  it('returns a tool error when recognized HAR validation fails', () => {
    const har = {
      log: {
        entries: [{
          request: {
            method: 'GET',
            url: 'https://api.example/items',
            headers: [{ name: 'X-Leak', value: '${AUTH_TOKEN}' }],
          },
        }],
      },
    };
    const response = runCurlHarConversionTool({ input: JSON.stringify(har) });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/Conversion error: Security error/);
  });

  it('returns a successful tool result only for a runnable conversion', () => {
    const response = runCurlHarConversionTool({ input: 'curl https://api.example/health' });
    expect(response.isError).toBeUndefined();
    expect(JSON.parse(response.content[0].text).isValid).toBe(true);
  });

  it('preserves HAR cookie timelines without plan-initial cookie state', () => {
    const har = {
      log: {
        entries: [
          { request: { method: 'POST', url: 'https://api.example/login' } },
          { request: { method: 'GET', url: 'https://api.example/dashboard', cookies: [{ name: 'sid', value: 'later', domain: 'api.example', path: '/' }] } },
          { request: { method: 'GET', url: 'https://api.example/account', cookies: [{ name: 'sid', value: 'rotated', domain: 'api.example', path: '/' }] } },
        ],
      },
    };
    const response = runCurlHarConversionTool({ input: JSON.stringify(har) });
    expect(response.isError).toBeUndefined();
    const result = JSON.parse(response.content[0].text);
    expect(result.jmxXml).not.toContain('elementType="Cookie"');
    expect(result.jmxXml.indexOf('sid=later')).toBeLessThan(result.jmxXml.indexOf('sid=rotated'));
  });

  it.each([
    ['--json file', 'curl --json @payload.json https://api.example/items'],
    ['unnamed data-urlencode file', 'curl --data-urlencode @payload.txt https://api.example/items'],
    ['named data-urlencode file', 'curl --data-urlencode name@payload.txt https://api.example/items'],
    ['multipart content file', "curl -F 'data=<payload.txt' https://api.example/items"],
    ['cookie file', 'curl -b cookies.txt https://api.example/items'],
    ['header file', 'curl -H @headers.txt https://api.example/items'],
    ['multipart part-header file', "curl -F 'submit=OK;headers=@headers.txt' https://api.example/items"],
    ['multipart part-header file after another modifier', "curl -F 'submit=OK;type=text/plain;headers=@headers.txt' https://api.example/items"],
    ['multipart type modifier', "curl -F 'submit=OK;type=text/plain' https://api.example/items"],
    ['multipart filename modifier', "curl -F 'submit=OK;filename=custom.txt' https://api.example/items"],
    ['multipart literal headers modifier', "curl -F 'submit=OK;headers=X-Part: yes' https://api.example/items"],
  ])('returns a tool error for %s dependencies', (_label, input) => {
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/Conversion blocked/);
  });

  it.each([
    ['attached proxy', 'curl -xhttp://proxy.example:8080 https://api.example/items'],
    ['connect-to routing', 'curl --connect-to api.example:443:edge.example:8443 https://api.example/items'],
    ['unix socket routing', 'curl --unix-socket /var/run/service.sock http://localhost/items'],
    ['connect timeout', 'curl --connect-timeout 20 https://api.example/items'],
    ['max time', 'curl -m30 https://api.example/items'],
    ['retry policy', 'curl --retry 5 https://api.example/items'],
  ])('returns a tool error for unsupported %s semantics', (_label, input) => {
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/Conversion blocked/);
  });

  it.each([
    ['AND conditional', 'curl https://api.example/one && curl https://api.example/two'],
    ['OR conditional', 'curl https://api.example/one || curl -X DELETE https://api.example/two'],
    ['ANSI-C quoting', String.raw`curl -d $'line\nnext' https://api.example/body`],
    ['tilde expansion', 'curl -d ~/payload.json https://api.example/body'],
    ['star glob', 'curl -d *.json https://api.example/body'],
    ['question glob', 'curl -d payload?.json https://api.example/body'],
    ['bracket glob', 'curl -d payload[12].json https://api.example/body'],
    ['brace expansion', 'curl -d {one,two} https://api.example/body'],
  ])('returns a tool error for unsupported %s shell input', (_label, input) => {
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(/Conversion error/);
  });

  it.each([
    ["curl -d '~' https://api.example/body", '~'],
    ["curl -d '*.json' https://api.example/body", '*.json'],
    [String.raw`curl -d \*.json https://api.example/body`, '*.json'],
    ["curl -d '{one,two}' https://api.example/body", '{one,two}'],
  ])('accepts quoted or escaped shell metacharacters as literal data', (input, literal) => {
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBeUndefined();
    expect(JSON.parse(response.content[0].text).jmxXml).toContain(literal);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'QUERY'])(
    'preserves a query-only %s target without manufacturing an entity body',
    (method) => {
      const response = runCurlHarConversionTool({
        input: `curl -X ${method} 'https://api.example/search?q=a%26b&flag'`,
      });
      expect(response.isError).toBeUndefined();
      const jmx = JSON.parse(response.content[0].text).jmxXml;
      expect(jmx).toContain(`<stringProp name="HTTPSampler.method">${method}</stringProp>`);
      expect(jmx).toContain('<stringProp name="HTTPSampler.path">/search?q=a%26b&amp;flag</stringProp>');
      expect(jmx).toContain('<collectionProp name="Arguments.arguments"/>');
    },
  );

  it.each([
    ["curl -G --data-urlencode 'q=a&b' https://api.example/search", 'GET', '/search?q=a%26b'],
    ["curl -G --data-urlencode '=a b' https://api.example/search", 'GET', '/search?a+b'],
    ["curl -G -d 'flag' https://api.example/search", 'GET', '/search?flag'],
    ["curl -G -X POST --data-urlencode 'q=a&b' https://api.example/search", 'POST', '/search?q=a%26b'],
  ])('preserves effective -G method and target', (input, method, path) => {
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBeUndefined();
    const jmx = JSON.parse(response.content[0].text).jmxXml;
    expect(jmx).toContain(`<stringProp name="HTTPSampler.method">${method}</stringProp>`);
    expect(jmx).toContain(`<stringProp name="HTTPSampler.path">${path}</stringProp>`);
  });

  it('encodes a data-urlencode value before treating ampersands as separators', () => {
    const response = runCurlHarConversionTool({
      input: "curl --data-urlencode 'q=a&b' https://api.example/search",
    });
    expect(response.isError).toBeUndefined();
    expect(JSON.parse(response.content[0].text).jmxXml).toContain(
      '<stringProp name="Argument.value">q=a%26b</stringProp>',
    );
  });

  it('uses independent exact-match variables for heterogeneous Bearer tokens', () => {
    const response = runCurlHarConversionTool({
      input: [
        "curl -H 'Authorization: Bearer a' https://api.example/one",
        "curl -H 'Authorization: Bearer abc' https://api.example/two",
        "curl -H 'Authorization: Bearer abcdef' https://api.example/three",
      ].join('\n'),
    });
    expect(response.isError).toBeUndefined();
    const jmx = JSON.parse(response.content[0].text).jmxXml;
    expect(jmx).toContain('Bearer ${AUTH_TOKEN_1}');
    expect(jmx).toContain('Bearer ${AUTH_TOKEN_2}');
    expect(jmx).toContain('Bearer ${AUTH_TOKEN_3}');
    expect(jmx).not.toContain('${AUTH_TOKEN_2}def');
  });

  it('retains mutating static-looking HAR routes under default filtering', () => {
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const input = JSON.stringify({
      log: { entries: methods.map((method) => ({ request: { method, url: `https://api.example/${method.toLowerCase()}.css` } })) },
    });
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBeUndefined();
    const result = JSON.parse(response.content[0].text);
    expect(result.requestCount).toBe(4);
    for (const method of methods) {
      expect(result.jmxXml).toContain(`<stringProp name="HTTPSampler.method">${method}</stringProp>`);
    }
  });

  it.each([
    ['multiple cURL URLs', 'curl https://a.example/one https://b.example/two', /Conversion blocked/],
    ['malformed mixed batch', "curl https://api.example/valid\ncurl -H 'X-Only: missing-url'", /Conversion error/],
    ['missing HAR request', JSON.stringify({ log: { entries: [{}] } }), /Conversion error/],
    ['malformed HAR URL', JSON.stringify({ log: { entries: [{ request: { method: 'GET', url: 'not a valid URL' } }] } }), /Conversion error/],
    ['non-HTTP HAR URL', JSON.stringify({ log: { entries: [{ request: { method: 'GET', url: 'ftp://files.example/archive' } }] } }), /Conversion error/],
    ['non-HTTP cURL URL', 'curl ftp://files.example/archive', /Conversion error/],
  ])('returns a tool error for %s', (_label, input, expected) => {
    const response = runCurlHarConversionTool({ input });
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toMatch(expected);
  });
});
