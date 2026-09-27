import { parse as parseYaml } from 'yaml';
import { OPENAPI_TO_JMX } from '../tools-config.mjs';
import { buildJmxXml, MAX_INPUT_CHARS } from './curl-har-to-jmx.mjs';
import { sanitizeJMeterValue } from './request-normalization.mjs';

export { MAX_INPUT_CHARS };

const OPERATION_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function localRefValue(document, ref) {
  if (!ref.startsWith('#/')) return undefined;
  return ref.slice(2).split('/').reduce((value, part) => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    return value && typeof value === 'object' ? value[key] : undefined;
  }, document);
}

function createResolver(document, warn) {
  const resolver = (value, seenRefs = new Set()) => {
    if (!value || typeof value !== 'object' || !value.$ref) return value;
    const ref = String(value.$ref);
    if (!ref.startsWith('#/')) {
      warn(`External $ref is not supported: ${ref}`);
      return {};
    }
    if (seenRefs.has(ref)) {
      warn(`Cyclic $ref detected: ${ref}`);
      return null;
    }
    const target = localRefValue(document, ref);
    if (!target || typeof target !== 'object') {
      warn(`Unresolved local $ref: ${ref}`);
      return {};
    }
    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);
    const resolved = resolver(target, nextSeen);
    if (!resolved || typeof resolved !== 'object') return resolved;
    const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref'));
    return { ...resolved, ...siblings };
  };
  resolver.warn = warn;
  return resolver;
}

function firstExample(examples) {
  if (Array.isArray(examples)) return examples[0];
  if (examples && typeof examples === 'object') {
    const first = Object.values(examples)[0];
    return first && typeof first === 'object' && 'value' in first ? first.value : first;
  }
  return undefined;
}

/**
 * Build a deterministic example value from an OpenAPI or Swagger schema.
 * @param {any} schema
 * @param {Function & { warn?: (message: string) => void }} resolver
 * @param {number} [depth]
 * @param {Set<string>} [seenRefs]
 * @returns {any}
 */
export function sampleFromSchema(schema, resolver, depth = 0, seenRefs = new Set()) {
  if (depth > 8) {
    resolver.warn?.('Schema sample depth limit reached; recursive value replaced with null.');
    return null;
  }
  if (!schema || typeof schema !== 'object') return null;

  if (schema.$ref) {
    const ref = String(schema.$ref);
    if (seenRefs.has(ref)) {
      resolver.warn?.(`Cyclic $ref detected: ${ref}; recursive value replaced with null.`);
      return null;
    }
    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);
    const resolved = resolver(schema, seenRefs);
    return resolved ? sampleFromSchema(resolved, resolver, depth + 1, nextSeen) : null;
  }

  if (schema.example !== undefined) return schema.example;
  const example = firstExample(schema.examples);
  if (example !== undefined) return example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;

  if (Array.isArray(schema.allOf)) {
    const merged = {};
    let hasObject = false;
    for (const part of schema.allOf) {
      const sample = sampleFromSchema(part, resolver, depth + 1, new Set(seenRefs));
      if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
        Object.assign(merged, sample);
        hasObject = true;
      }
    }
    return hasObject ? merged : null;
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    return sampleFromSchema(schema.oneOf[0], resolver, depth + 1, new Set(seenRefs));
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    return sampleFromSchema(schema.anyOf[0], resolver, depth + 1, new Set(seenRefs));
  }

  let type = schema.type;
  if (Array.isArray(type)) type = type.find((item) => item !== 'null') || type[0];
  if (!type && schema.properties) type = 'object';

  if (type === 'string') {
    const formats = {
      'date-time': '2026-01-01T00:00:00Z',
      date: '2026-01-01',
      uuid: '00000000-0000-4000-8000-000000000000',
      email: 'user@example.com',
      uri: 'https://example.com',
      url: 'https://example.com',
      ipv4: '127.0.0.1',
      password: 'ChangeMe123!',
      byte: 'ZXhhbXBsZQ==',
    };
    return formats[schema.format] || 'string';
  }
  if (type === 'integer' || type === 'number') return Number(schema.minimum) > 1 ? Number(schema.minimum) : 1;
  if (type === 'boolean') return true;
  if (type === 'array') {
    if (schema.minItems === 0) return [];
    return [sampleFromSchema(schema.items || {}, resolver, depth + 1, new Set(seenRefs))];
  }
  if (type === 'object') {
    const properties = schema.properties || {};
    if (!Object.keys(properties).length) return {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    const keys = [...required, ...Object.keys(properties).filter((key) => !required.includes(key))];
    return Object.fromEntries(keys.map((key) => [key, sampleFromSchema(properties[key], resolver, depth + 1, new Set(seenRefs))]));
  }
  return null;
}

function parseInput(input) {
  if (input.startsWith('{')) return JSON.parse(input);
  try {
    return JSON.parse(input);
  } catch {
    return parseYaml(input, { maxAliasCount: 100 });
  }
}

function detectSpecVersion(document) {
  const openapi = String(document?.openapi || '');
  if (openapi.startsWith('3.1')) return 'openapi-3.1';
  if (openapi.startsWith('3.0')) return 'openapi-3.0';
  if (String(document?.swagger || '').startsWith('2.')) return 'swagger-2.0';
  return 'unknown';
}

function substituteServerVariables(server) {
  const variables = server?.variables || {};
  return String(server?.url || '').replace(/\{([^}]+)\}/g, (_match, name) => {
    const variable = variables[name] || {};
    return String(variable.default ?? variable.enum?.[0] ?? '');
  });
}

function serverInfo(document, specVersion, serverIndex, warn) {
  if (specVersion === 'swagger-2.0') {
    const protocol = document.schemes?.[0] || 'https';
    const host = document.host || 'example.com';
    const path = document.basePath || '';
    const url = `${protocol}://${host}${path}`.replace(/\/$/, '');
    return { servers: [url], baseUrl: url };
  }

  const declared = Array.isArray(document.servers) ? document.servers.map(substituteServerVariables).filter(Boolean) : [];
  if (!declared.length) {
    warn('No servers are defined; using https://example.com.');
    return { servers: ['https://example.com'], baseUrl: 'https://example.com' };
  }
  const selected = declared[Math.max(0, Math.min(Number(serverIndex) || 0, declared.length - 1))];
  if (/^\//.test(selected)) {
    warn(`Relative server URL "${selected}" uses https://example.com as its origin.`);
    return { servers: declared, baseUrl: `https://example.com${selected}`.replace(/\/$/, '') };
  }
  try {
    const parsed = new URL(selected);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('unsupported protocol');
    return { servers: declared, baseUrl: selected.replace(/\/$/, '') };
  } catch {
    warn(`Invalid server URL "${selected}"; using https://example.com.`);
    return { servers: declared, baseUrl: 'https://example.com' };
  }
}

function operationParameters(pathItem, operation, resolver) {
  const merged = new Map();
  for (const parameter of [...(pathItem?.parameters || []), ...(operation?.parameters || [])]) {
    const resolved = resolver(parameter) || {};
    const key = `${resolved.in || ''}:${resolved.name || ''}`;
    if (resolved.name && resolved.in) merged.set(key, resolved);
  }
  return [...merged.values()];
}

function schemaForParameter(parameter) {
  return parameter.schema || parameter;
}

function sampleForParameter(parameter, resolver) {
  if (parameter.example !== undefined) return parameter.example;
  const example = firstExample(parameter.examples);
  if (example !== undefined) return example;
  return sampleFromSchema(schemaForParameter(parameter), resolver);
}

function stringifySample(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function safeLiteral(value) {
  return sanitizeJMeterValue(stringifySample(value));
}

function appendHeader(headers, name, value) {
  const lower = String(name).toLowerCase();
  const existing = headers.find((header) => header.name.toLowerCase() === lower);
  if (existing) existing.value = value;
  else headers.push({ name: String(name), value: String(value) });
}

function mediaBody(content, resolver, operationLabel, warn) {
  const entries = Object.entries(content || {});
  if (!entries.length) return { body: null, bodyType: 'none', formData: undefined, mimeType: undefined };
  const selected = entries.find(([type]) => type === 'application/json')
    || entries.find(([type]) => /\+json(?:;|$)/i.test(type))
    || entries.find(([type]) => type === 'application/x-www-form-urlencoded')
    || entries.find(([type]) => type === 'multipart/form-data')
    || entries.find(([type]) => type === 'text/plain' || type === 'application/xml')
    || entries[0];
  const [mimeType, rawMedia] = selected;
  const media = resolver(rawMedia) || {};
  const sample = media.example !== undefined ? media.example : sampleFromSchema(media.schema || {}, resolver);

  if (mimeType === 'multipart/form-data') {
    warn(`${operationLabel}: multipart/form-data bodies are not converted.`);
    return { body: null, bodyType: 'none', formData: undefined, mimeType };
  }
  if (mimeType === 'application/x-www-form-urlencoded') {
    const objectSample = sample && typeof sample === 'object' && !Array.isArray(sample) ? sample : {};
    return {
      body: null,
      bodyType: 'form',
      formData: Object.entries(objectSample).map(([name, value]) => ({ name, value: safeLiteral(value) })),
      mimeType,
    };
  }
  if (mimeType === 'text/plain' || mimeType === 'application/xml') {
    if (typeof media.example !== 'string') {
      warn(`${operationLabel}: ${mimeType} body has no string example and was skipped.`);
      return { body: null, bodyType: 'none', formData: undefined, mimeType };
    }
    return { body: safeLiteral(media.example), bodyType: 'raw', formData: undefined, mimeType };
  }
  if (!(mimeType === 'application/json' || /\+json(?:;|$)/i.test(mimeType))) {
    warn(`${operationLabel}: unrecognized request content type ${mimeType}; using its first sample.`);
  }
  return {
    body: sample === undefined ? null : safeLiteral(typeof sample === 'string' ? sample : JSON.stringify(sample, null, 2)),
    bodyType: sample === undefined ? 'none' : 'raw',
    formData: undefined,
    mimeType,
  };
}

function swaggerBody(operation, document, parameters, resolver, operationLabel, warn) {
  const bodyParameter = parameters.find((parameter) => parameter.in === 'body');
  if (!bodyParameter) return { body: null, bodyType: 'none', formData: undefined, mimeType: undefined };
  const consumes = operation.consumes || document.consumes || ['application/json'];
  return mediaBody({ [consumes[0]]: { schema: bodyParameter.schema || {} } }, resolver, operationLabel, warn);
}

function effectiveSecurity(document, operation, specVersion, headers, queryParams, extraVariables, warn) {
  const requirements = operation.security ?? document.security;
  if (!Array.isArray(requirements) || requirements.length === 0) return false;
  const definitions = specVersion === 'swagger-2.0' ? document.securityDefinitions || {} : document.components?.securitySchemes || {};
  let hasBearer = false;
  for (const requirement of requirements) {
    for (const schemeName of Object.keys(requirement || {})) {
      const scheme = definitions[schemeName] || {};
      const type = String(scheme.type || '').toLowerCase();
      const httpScheme = String(scheme.scheme || '').toLowerCase();
      if ((type === 'http' && httpScheme === 'bearer') || type === 'oauth2' || type === 'openidconnect') {
        appendHeader(headers, 'Authorization', 'Bearer CHANGE_ME');
        hasBearer = true;
      } else if ((type === 'http' && httpScheme === 'basic') || type === 'basic') {
        appendHeader(headers, 'Authorization', 'Basic ${BASIC_AUTH}');
        if (!extraVariables.has('BASIC_AUTH')) extraVariables.set('BASIC_AUTH', 'dXNlcjpwYXNz');
      } else if (type === 'apikey') {
        const location = String(scheme.in || '').toLowerCase();
        const name = scheme.name || 'X-API-Key';
        if (location === 'header') {
          appendHeader(headers, name, '${API_KEY}');
          if (!extraVariables.has('API_KEY')) extraVariables.set('API_KEY', 'CHANGE_ME');
        } else if (location === 'query') {
          queryParams.push({ name: String(name), value: '${API_KEY}', encode: false, useEquals: true });
          if (!extraVariables.has('API_KEY')) extraVariables.set('API_KEY', 'CHANGE_ME');
        } else if (location === 'cookie') {
          warn('Cookie security schemes are not converted; use HTTP Cookie Manager.');
        }
      }
    }
  }
  return hasBearer;
}

function emptyResult(options, blockingErrors, summary) {
  return {
    jmxXml: buildJmxXml([], options || {}),
    requestCount: 0,
    specVersion: 'unknown',
    title: '',
    baseUrl: '',
    servers: [],
    tags: [],
    operations: [],
    pathVariables: [],
    requests: [],
    detectedDomains: [],
    hasBearerToken: false,
    blockingErrors,
    isValid: false,
    warnings: [],
    summary,
  };
}

/** Convert an OpenAPI 3.x or Swagger 2.0 document into a JMeter test plan. */
export function convertOpenApiToJmx(options = {}) {
  const input = String(options.input || '').trim();
  if (!input) return emptyResult(options, ['No OpenAPI content provided.'], 'No OpenAPI content provided.');
  if (input.length > MAX_INPUT_CHARS) {
    return emptyResult(options, [`Input exceeds maximum size of ${OPENAPI_TO_JMX.limits.maxInputLabel}.`], 'OpenAPI input is too large.');
  }

  let document;
  try {
    document = parseInput(input);
  } catch {
    return emptyResult(options, ['Input is not valid JSON or YAML.'], 'Could not parse OpenAPI input.');
  }
  if (!document || typeof document !== 'object' || (!document.openapi && !document.swagger && !document.paths)) {
    return emptyResult(options, ['Not an OpenAPI/Swagger document'], 'Not an OpenAPI/Swagger document.');
  }

  const warnings = [];
  const warn = (message) => addUnique(warnings, message);
  const resolver = createResolver(document, warn);
  const specVersion = detectSpecVersion(document);
  const title = String(document.info?.title || 'OpenAPI');
  const { servers, baseUrl } = serverInfo(document, specVersion, options.serverIndex, warn);
  const base = new URL(baseUrl);
  const basePrefix = base.pathname === '/' ? '' : base.pathname.replace(/\/$/, '');
  const selectedMethods = new Set((Array.isArray(options.methods) ? options.methods : OPENAPI_TO_JMX.defaults.methods).map((method) => String(method).toUpperCase()));
  const selectedTags = new Set((options.tags || []).map(String));
  const includeOptionalQueryParams = options.includeOptionalQueryParams === true;
  const useExampleValues = options.useExampleValues === true;
  const includeDeprecated = options.includeDeprecated === true;
  const requested = Number(options.maxOperations);
  const maxOperations = Number.isFinite(requested) && requested >= 0
    ? Math.floor(requested)
    : OPENAPI_TO_JMX.limits.maxOperations;
  const operations = [];
  const requests = [];
  const pathVariables = new Set();
  const extraVariables = new Map();
  const allTags = new Set((document.tags || []).map((tag) => String(tag?.name || '')).filter(Boolean));
  const blockingErrors = [];
  let hasBearerToken = false;
  let limitWarned = false;

  for (const [pathName, unresolvedPathItem] of Object.entries(document.paths || {})) {
    const pathItem = resolver(unresolvedPathItem) || {};
    for (const methodName of OPERATION_METHODS) {
      if (!Object.prototype.hasOwnProperty.call(pathItem, methodName)) continue;
      const operation = resolver(pathItem[methodName]) || {};
      const method = methodName.toUpperCase();
      const operationTags = Array.isArray(operation.tags) && operation.tags.length ? operation.tags.map(String) : ['default'];
      operationTags.forEach((tag) => allTags.add(tag));
      const tag = operationTags[0];
      const record = {
        method,
        path: pathName,
        operationId: String(operation.operationId || ''),
        summary: String(operation.summary || ''),
        tag,
        deprecated: operation.deprecated === true,
        included: false,
      };
      operations.push(record);

      if (record.deprecated && !includeDeprecated) record.skippedReason = 'deprecated';
      else if (!selectedMethods.has(method)) record.skippedReason = 'method filtered';
      else if (selectedTags.size && !operationTags.some((item) => selectedTags.has(item))) record.skippedReason = 'tag filtered';
      else if (requests.length >= maxOperations) {
        record.skippedReason = 'operation limit';
        if (!limitWarned) {
          warn(`Operation limit of ${maxOperations} reached; remaining operations were skipped.`);
          limitWarned = true;
        }
      }
      if (record.skippedReason) continue;

      try {
        const parameters = operationParameters(pathItem, operation, resolver);
        let requestPath = `${basePrefix}${pathName.startsWith('/') ? pathName : `/${pathName}`}` || '/';
        requestPath = requestPath.replace(/\{([^}]+)\}/g, (_match, rawName) => {
          const parameter = parameters.find((item) => item.in === 'path' && item.name === rawName);
          const sample = parameter ? sampleForParameter(parameter, resolver) : null;
          const value = sample === null || sample === undefined || sample === '' ? 'CHANGE_ME' : safeLiteral(sample);
          if (useExampleValues) return encodeURIComponent(value);
          const variableName = String(rawName).replace(/[^A-Za-z0-9_]/g, '_') || 'pathParam';
          pathVariables.add(variableName);
          if (!extraVariables.has(variableName)) extraVariables.set(variableName, value);
          return `\${${variableName}}`;
        });

        const headers = [];
        const queryParams = [];
        for (const parameter of parameters) {
          const location = String(parameter.in || '').toLowerCase();
          if (location === 'path' || location === 'body') continue;
          if (location === 'cookie') {
            warn('Cookie parameters are not converted; use HTTP Cookie Manager.');
            continue;
          }
          if (location === 'query' && parameter.required !== true && !includeOptionalQueryParams) continue;
          const sample = sampleForParameter(parameter, resolver);
          const value = safeLiteral(sample === null || sample === undefined ? 'string' : sample);
          if (location === 'query') queryParams.push({ name: safeLiteral(parameter.name), value, encode: true, useEquals: true });
          else if (location === 'header') appendHeader(headers, safeLiteral(parameter.name), value);
        }

        const operationLabel = `${method} ${pathName}`;
        const bodyInfo = specVersion === 'swagger-2.0'
          ? swaggerBody(operation, document, parameters, resolver, operationLabel, warn)
          : mediaBody((resolver(operation.requestBody) || {}).content, resolver, operationLabel, warn);
        if (bodyInfo.mimeType && bodyInfo.bodyType !== 'none') appendHeader(headers, 'Content-Type', bodyInfo.mimeType);

        hasBearerToken = effectiveSecurity(document, operation, specVersion, headers, queryParams, extraVariables, warn) || hasBearerToken;
        const suffix = record.operationId ? ` - ${record.operationId}` : record.summary ? ` - ${record.summary}` : '';
        const name = `${method} ${pathName}${suffix}`.slice(0, 120);
        const url = `${base.origin}${requestPath}`;
        requests.push({
          method,
          url,
          protocol: base.protocol.replace(':', ''),
          domain: base.hostname,
          port: base.port || (base.protocol === 'https:' ? '443' : '80'),
          path: requestPath,
          queryParams,
          headers,
          body: bodyInfo.body,
          bodyType: bodyInfo.bodyType,
          mimeType: bodyInfo.mimeType,
          formData: bodyInfo.formData,
          followRedirects: true,
          name,
        });
        record.included = true;
      } catch (error) {
        record.skippedReason = 'invalid value';
        addUnique(blockingErrors, error instanceof Error ? error.message : String(error));
      }
    }
  }

  const sortedTags = [...allTags].filter(Boolean).sort((a, b) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return a.localeCompare(b);
  });
  const testPlanName = options.testPlanName || `${title} Test Plan`;
  const jmxXml = buildJmxXml(requests, {
    testPlanName,
    threads: options.threads ?? OPENAPI_TO_JMX.defaults.threads,
    rampUpSeconds: options.rampUpSeconds ?? OPENAPI_TO_JMX.defaults.rampUp,
    durationSeconds: options.durationSeconds ?? OPENAPI_TO_JMX.defaults.duration,
    loopCount: options.loopCount ?? OPENAPI_TO_JMX.defaults.loopCount,
    parameterizeHost: options.parameterizeHost !== false,
    parameterizeAuth: true,
    includeAssertions: options.includeAssertions !== false,
    includeCookieManager: options.includeCookieManager !== false,
    extraVariables: [...extraVariables].map(([name, value]) => ({ name, value })),
  });
  const detectedDomains = [...new Set(requests.map((request) => request.domain).filter(Boolean))];
  const isValid = requests.length > 0 && blockingErrors.length === 0;
  const summary = `Converted ${requests.length} of ${operations.length} operations from ${title} (${specVersion})`;

  return {
    jmxXml,
    requestCount: requests.length,
    specVersion,
    title,
    baseUrl,
    servers,
    tags: sortedTags,
    operations,
    pathVariables: [...pathVariables],
    requests: requests.map((request) => ({
      method: request.method,
      url: request.url,
      domain: request.domain,
      path: request.path,
      headersCount: request.headers.length,
      bodyType: request.bodyType,
    })),
    detectedDomains,
    hasBearerToken,
    blockingErrors,
    isValid,
    warnings,
    summary,
  };
}
