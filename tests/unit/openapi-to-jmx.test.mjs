import { describe, expect, it } from 'vitest';
import { convertOpenApiToJmx } from '../../src/lib/mcp/openapi-to-jmx.mjs';
import { MAX_INPUT_CHARS } from '../../src/lib/mcp/curl-har-to-jmx.mjs';
import { OPENAPI_TO_JMX } from '../../src/lib/tools-config.mjs';

const convertPetstore = (overrides = {}) => convertOpenApiToJmx({
  input: OPENAPI_TO_JMX.samples.petstoreJson,
  ...overrides,
});

function samplerSegment(xml, samplerName) {
  const start = xml.indexOf(`testname="${samplerName}"`);
  const next = xml.indexOf('<HTTPSamplerProxy', start + 1);
  return xml.slice(start, next === -1 ? undefined : next);
}

describe('convertOpenApiToJmx', () => {
  it.each([
    ['petstoreJson', 'openapi-3.0'],
    ['minimalYaml', 'openapi-3.1'],
    ['swagger2Json', 'swagger-2.0'],
  ])('detects the %s sample version', (sample, version) => {
    expect(convertOpenApiToJmx({ input: OPENAPI_TO_JMX.samples[sample] }).specVersion).toBe(version);
  });

  it('substitutes server variables and reports domains', () => {
    const result = convertPetstore();
    expect(result.baseUrl).toBe('https://petstore.example.com/v3');
    expect(result.detectedDomains).toEqual(['petstore.example.com']);
    expect(result.title).toBe('Petstore API');
  });

  it('skips deprecated operations by default and includes them on request', () => {
    const normal = convertPetstore();
    const deprecated = normal.operations.find((operation) => operation.operationId === 'deletePet');
    expect(normal.operations).toHaveLength(6);
    expect(normal.requestCount).toBe(5);
    expect(deprecated).toMatchObject({ included: false, skippedReason: 'deprecated' });

    const included = convertPetstore({ includeDeprecated: true });
    expect(included.requestCount).toBe(6);
    expect(included.operations.find((operation) => operation.operationId === 'deletePet')?.included).toBe(true);
  });

  it('parameterizes path values and emits their sampled UDV defaults', () => {
    const result = convertPetstore();
    expect(result.pathVariables).toContain('petId');
    expect(result.jmxXml).toContain('/v3/pet/${petId}');
    expect(result.jmxXml).toContain('<stringProp name="Argument.name">petId</stringProp>');
    expect(result.jmxXml).toContain('<stringProp name="Argument.value">10</stringProp>');
  });

  it('can insert example values directly into paths', () => {
    const result = convertPetstore({ useExampleValues: true });
    expect(result.pathVariables).toEqual([]);
    expect(result.jmxXml).toContain('/v3/pet/10');
    expect(result.jmxXml).not.toContain('/v3/pet/${petId}');
  });

  it('generates nested JSON samples using allOf, enum, arrays, and refs', () => {
    const result = convertPetstore();
    const segment = samplerSegment(result.jmxXml, 'POST /pet - addPet');
    expect(segment).toContain('&quot;name&quot;: &quot;Fido&quot;');
    expect(segment).toContain('&quot;status&quot;: &quot;available&quot;');
    expect(segment).toContain('&quot;tags&quot;');
    expect(segment).toContain('&quot;friendly&quot;');
  });

  it('omits optional query parameters unless enabled', () => {
    const omitted = convertPetstore();
    const included = convertPetstore({ includeOptionalQueryParams: true });
    expect(samplerSegment(omitted.jmxXml, 'GET /pet/findByStatus - findPetsByStatus')).not.toContain('status=');
    expect(samplerSegment(included.jmxXml, 'GET /pet/findByStatus - findPetsByStatus')).toContain('status=available');
  });

  it('parameterizes bearer security and honors an operation security override', () => {
    const result = convertPetstore();
    expect(result.hasBearerToken).toBe(true);
    expect(result.jmxXml).toContain('Bearer ${AUTH_TOKEN}');
    expect(result.jmxXml).toMatch(/<stringProp name="Argument.name">AUTH_TOKEN<\/stringProp>[\s\S]*?<stringProp name="Argument.value">CHANGE_ME<\/stringProp>/);
    expect(result.jmxXml).not.toContain('REPLACE_WITH_TOKEN');
    expect(samplerSegment(result.jmxXml, 'GET /store/inventory - getInventory')).not.toContain('Authorization');
  });

  it('creates form data samplers for urlencoded request bodies', () => {
    const result = convertPetstore();
    expect(result.requests.find((request) => request.path === '/v3/store/order')?.bodyType).toBe('form');
    const segment = samplerSegment(result.jmxXml, 'POST /store/order - placeOrder');
    expect(segment).toContain('<stringProp name="Argument.name">petId</stringProp>');
    expect(segment).toContain('<stringProp name="Argument.name">quantity</stringProp>');
  });

  it('filters operations by tag and method', () => {
    const store = convertPetstore({ tags: ['store'] });
    expect(store.requestCount).toBe(2);
    expect(store.operations.filter((operation) => operation.included).every((operation) => operation.tag === 'store')).toBe(true);

    const gets = convertPetstore({ methods: ['GET'] });
    expect(gets.requestCount).toBe(3);
    expect(gets.operations.filter((operation) => operation.included).every((operation) => operation.method === 'GET')).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['non-numeric text', 'abc'],
  ])('falls back to the 500-operation limit for %s maxOperations', (_case, maxOperations) => {
    const paths = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [
      `/items/${index}`,
      { get: { operationId: `getItem${index}`, responses: { 200: { description: 'ok' } } } },
    ]));
    const input = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Large API', version: '1' },
      paths,
    });
    const result = convertOpenApiToJmx({ input, maxOperations });
    expect(result.requestCount).toBe(OPENAPI_TO_JMX.limits.maxOperations);
    expect(result.warnings).toContain('Operation limit of 500 reached; remaining operations were skipped.');
  });

  it('parses YAML and emits API key header variables', () => {
    const result = convertOpenApiToJmx({ input: OPENAPI_TO_JMX.samples.minimalYaml });
    expect(result.isValid).toBe(true);
    expect(result.jmxXml).toContain('<stringProp name="Argument.name">API_KEY</stringProp>');
    expect(result.jmxXml).toContain('<stringProp name="Header.name">X-API-Key</stringProp>');
    expect(result.jmxXml).toContain('<stringProp name="Header.value">${API_KEY}</stringProp>');
  });

  it('converts Swagger host, base path, required query, and body refs', () => {
    const result = convertOpenApiToJmx({ input: OPENAPI_TO_JMX.samples.swagger2Json });
    expect(result.baseUrl).toBe('https://legacy.example.com/api/v2');
    expect(result.jmxXml).toContain('/api/v2/orders?limit=20');
    expect(result.jmxXml).toContain('&quot;sku&quot;: &quot;SKU-100&quot;');
    expect(result.jmxXml).toContain('&quot;quantity&quot;: 2');
  });

  it('terminates cyclic schema refs with null and a warning', () => {
    const input = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Tree', version: '1' },
      paths: {
        '/nodes': {
          post: {
            operationId: 'createNode',
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } },
            responses: { 200: { description: 'ok' } },
          },
        },
      },
      components: {
        schemas: {
          Node: { type: 'object', properties: { name: { type: 'string' }, children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } } },
        },
      },
    });
    const result = convertOpenApiToJmx({ input });
    expect(result.isValid).toBe(true);
    expect(result.jmxXml).toContain('&quot;children&quot;: [');
    expect(result.jmxXml).toContain('null');
    expect(result.warnings.some((warning) => /cyclic \$ref/i.test(warning))).toBe(true);
  });

  it('warns for external refs and relative servers', () => {
    const external = convertOpenApiToJmx({ input: JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'External', version: '1' },
      servers: [{ url: '/v1' }],
      paths: { '/items': { post: { requestBody: { content: { 'application/json': { schema: { $ref: 'models.yaml#/Item' } } } }, responses: {} } } },
    }) });
    expect(external.baseUrl).toBe('https://example.com/v1');
    expect(external.warnings.some((warning) => /External \$ref/.test(warning))).toBe(true);
    expect(external.warnings.some((warning) => /Relative server URL/.test(warning))).toBe(true);
  });

  it('rejects YAML whose alias expansion exceeds the parser limit', () => {
    const input = `openapi: 3.0.3
info: { title: Alias Bomb, version: "1" }
a: &a [x, x]
b: &b [*a, *a]
c: &c [*b, *b]
d: &d [*c, *c]
e: &e [*d, *d]
f: &f [*e, *e]
g: &g [*f, *f]
x-bomb: [*g, *g]
paths: {}`;
    expect(convertOpenApiToJmx({ input }).blockingErrors).toEqual(['Input is not valid JSON or YAML.']);
  });

  it('reports blocking errors for empty, invalid, oversized, and non-spec input', () => {
    expect(convertOpenApiToJmx({ input: '' }).blockingErrors).toEqual(['No OpenAPI content provided.']);
    expect(convertOpenApiToJmx({ input: '{bad' }).blockingErrors).toEqual(['Input is not valid JSON or YAML.']);
    expect(convertOpenApiToJmx({ input: 'x'.repeat(MAX_INPUT_CHARS + 1) }).blockingErrors[0]).toMatch(/maximum size/);
    expect(convertOpenApiToJmx({ input: '{"hello":"world"}' }).blockingErrors).toEqual(['Not an OpenAPI/Swagger document']);
  });

  it('keeps sampler counts aligned and includes operationId in names', () => {
    const result = convertPetstore();
    expect(result.jmxXml.match(/<HTTPSamplerProxy\b/g)).toHaveLength(result.requestCount);
    expect(result.jmxXml).toContain('testname="GET /pet/{petId} - getPetById"');
    expect(result.summary).toBe('Converted 5 of 6 operations from Petstore API (openapi-3.0)');
  });

  it('supports basic and query API-key security variables', () => {
    const input = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Secure', version: '1' },
      security: [{ basicAuth: [], queryKey: [] }],
      paths: { '/secure': { get: { responses: {} } } },
      components: { securitySchemes: {
        basicAuth: { type: 'http', scheme: 'basic' },
        queryKey: { type: 'apiKey', in: 'query', name: 'key' },
      } },
    });
    const result = convertOpenApiToJmx({ input });
    expect(result.jmxXml).toContain('Basic ${BASIC_AUTH}');
    expect(result.jmxXml).toContain('key=${API_KEY}');
    expect(result.jmxXml).toContain('<stringProp name="Argument.name">BASIC_AUTH</stringProp>');
    expect(result.jmxXml).toContain('<stringProp name="Argument.name">API_KEY</stringProp>');
  });
});
