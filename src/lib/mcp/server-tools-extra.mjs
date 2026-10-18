/**
 * Extended MCP tool registrations and runners (converters, infrastructure
 * planners, and the Correlation & Practice Sandbox).
 * Extracted from server.mjs so every module remains strictly under 500 lines.
 */

import { z } from 'zod';
import { findChunkByPath } from '../rag.mjs';
import { generateDistributedPlan } from '../distributed-planner.mjs';
import { generateOsTuningPlan } from '../os-tuning.mjs';
import { convertCurlOrHarToJmx } from './curl-har-to-jmx.mjs';
import { convertOpenApiToJmx } from './openapi-to-jmx.mjs';
import {
  SANDBOX_FLOWS,
  SANDBOX_TARGETS,
  buildSandboxJmxPlan,
} from '../sandbox-jmx-templates.mjs';
import { withUtm } from '../path-utils.mjs';
import referenceIndex from '../reference-index.json' with { type: 'json' };

function matchReferenceEntries(kind, query) {
  const entries = referenceIndex.filter((e) => e.kind === kind);
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  const exact = entries.filter((e) => e.name.toLowerCase() === needle || e.slug === needle);
  if (exact.length > 0) return exact;
  return entries.filter((e) => e.name.toLowerCase().includes(needle));
}

function errorText(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Execute the cURL/HAR converter with the same blocking policy used by the
 * public MCP tool.
 */
export function runCurlHarConversionTool(params) {
  try {
    const result = convertCurlOrHarToJmx(params);
    if (!result.isValid) {
      const reason =
        result.blockingErrors.length > 0
          ? result.blockingErrors.join(' ')
          : 'No valid HTTP requests were parsed.';
      return {
        content: [
          {
            type: 'text',
            text: `Conversion blocked: ${reason}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Conversion error: ${errorText(err)}` }],
      isError: true,
    };
  }
}

export function runOpenApiConversionTool(params) {
  try {
    const result = convertOpenApiToJmx(params);
    if (!result.isValid) {
      const reason =
        result.blockingErrors.length > 0
          ? result.blockingErrors.join(' ')
          : 'No valid OpenAPI operations were converted.';
      return {
        content: [
          {
            type: 'text',
            text: `Conversion blocked: ${reason}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Conversion error: ${errorText(err)}` }],
      isError: true,
    };
  }
}

/**
 * Return practice JMX test plan (challenge or solved), step metadata, and
 * live sandbox target endpoints for correlation training.
 */
export function runCorrelationSandboxTool(params = {}) {
  try {
    const flowId = params.flowId || 'flow1';
    const mode = params.mode === 'challenge' ? 'challenge' : 'solved';
    const target = params.target === 'local' ? 'local' : 'edge';
    const flow = SANDBOX_FLOWS.find((f) => f.id === flowId) || SANDBOX_FLOWS[0];
    const targetCfg = SANDBOX_TARGETS[target];
    const jmxXml = buildSandboxJmxPlan({ flowId: flow.id, mode, target });

    const payload = {
      flowId: flow.id,
      title: flow.title,
      mode,
      target: targetCfg.baseUrl,
      sandboxToolUrl: withUtm('https://docs.jmeter.ai/tools/correlation-sandbox/', 'mcp'),
      playbookUrl: withUtm(`https://docs.jmeter.ai${flow.playbookUrl}`, 'mcp'),
      extractorConfig: flow.extractorConfig,
      steps: flow.steps,
      jmxXml,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Sandbox tool error: ${errorText(err)}` }],
      isError: true,
    };
  }
}

/**
 * Register infrastructure planners, cURL/OpenAPI converters, and the
 * Correlation Sandbox on an McpServer instance.
 */
export function registerExtraServerTools(server) {
  server.registerTool(
    'lookup_component',
    {
      title: 'Lookup JMeter Component Reference Page',
      description:
        'Find the dedicated reference page for a JMeter test plan component (e.g. "HTTP Request", "JSON Extractor", "Thread Group") and return its full markdown content with properties, defaults, and related guides.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, exact or partial (e.g. "HTTP Request", "JSON Extractor", "CSV Data Set").'),
      },
    },
    async ({ name }) => {
      const matches = matchReferenceEntries('component', name);
      if (matches.length === 0) {
        return {
          content: [{ type: 'text', text: `No component named "${name}" was found. Browse the full list at ${withUtm('https://docs.jmeter.ai/components/', 'mcp')} or use search_jmeter_docs.` }],
          isError: true,
        };
      }
      const entry = matches[0];
      const chunk = findChunkByPath(entry.path);
      const extra = matches.length > 1 ? `\n\n(Matched "${entry.name}" first among ${matches.length} results for "${name}": ${matches.map((m) => m.name).join(', ')})` : '';
      const body = chunk ? chunk.body.trim() : `See ${withUtm(entry.path, 'mcp')} for the ${entry.name} reference.`;
      return {
        content: [{ type: 'text', text: `# ${entry.name}\nCategory: ${entry.category}\nSource: ${withUtm(entry.path, 'mcp')}\n\n${body}${extra}` }],
      };
    },
  );

  server.registerTool(
    'lookup_function',
    {
      title: 'Lookup JMeter Function Reference Page',
      description:
        'Find the dedicated reference page for a built-in JMeter function (e.g. "__time", "__Random", "__P") and return its full markdown content with syntax, parameters, and examples.',
      inputSchema: {
        name: z.string().min(1).describe('Function name, with or without leading underscores (e.g. "__time", "time", "__RandomString").'),
      },
    },
    async ({ name }) => {
      const matches = matchReferenceEntries('function', name);
      if (matches.length === 0) {
        return {
          content: [{ type: 'text', text: `No function named "${name}" was found. Browse the full list at ${withUtm('https://docs.jmeter.ai/functions/', 'mcp')} or use search_jmeter_docs.` }],
          isError: true,
        };
      }
      const entry = matches[0];
      const chunk = findChunkByPath(entry.path);
      const extra = matches.length > 1 ? `\n\n(Matched "${entry.name}" first among ${matches.length} results for "${name}": ${matches.map((m) => m.name).join(', ')})` : '';
      const body = chunk ? chunk.body.trim() : `See ${withUtm(entry.path, 'mcp')} for the ${entry.name} reference.`;
      return {
        content: [{ type: 'text', text: `# ${entry.name}\nSource: ${withUtm(entry.path, 'mcp')}\n\n${body}${extra}` }],
      };
    },
  );

  server.registerTool(
    'plan_distributed_testing',
    {
      title: 'Plan Distributed Testing Ports & Firewall Rules',
      description:
        'Generate Master-Worker RMI port assignments, user.properties, CLI commands, firewall/security group rules, and Docker Compose manifests for distributed load testing.',
      inputSchema: {
        controllerIp: z.string().optional().describe('Controller / Master node IP or hostname (default: "10.0.0.5").'),
        workerIps: z.string().describe('Comma or space-separated list of worker / injector IP addresses (e.g. "10.0.1.10, 10.0.1.11, 10.0.1.12").'),
        serverPort: z.number().int().min(1024).max(65535).optional().describe('RMI registry port on workers (default: 1099).'),
        serverRmiLocalPort: z.number().int().min(1024).max(65535).optional().describe('Pinned worker engine port (default: 50000).'),
        clientRmiLocalPort: z.number().int().min(1024).max(65535).optional().describe('Pinned controller callback port (default: 60000).'),
        disableSsl: z.boolean().optional().describe('Disable RMI SSL (default: false). Only for isolated labs.'),
        mode: z.enum(['StrippedBatch', 'Statistical', 'Batch', 'Standard']).optional().describe('Sample transmission mode (default: "StrippedBatch").'),
        environment: z.enum(['aws', 'azure', 'gcp', 'linux', 'docker', 'k8s']).optional().describe('Target infrastructure environment for firewall/CLI rules (default: "aws").'),
      },
    },
    async (params) => {
      try {
        const plan = generateDistributedPlan(params);
        return { content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Distributed planner error: ${errorText(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'tune_linux_os',
    {
      title: 'Linux Kernel & OS Tuning for Load Injectors',
      description:
        'Generate production sysctl.conf, limits.conf, systemd overrides, and Docker/K8s configs tuned for high-concurrency JMeter load testing (fixing ulimit nofile, BindException port exhaustion, somaxconn backlog, and JVM swappiness).',
      inputSchema: {
        concurrency: z.number().int().min(100).max(500000).optional().describe('Target concurrent connections/threads (default: 10000).'),
        ramGb: z.number().int().min(2).max(512).optional().describe('Host machine RAM in GB for TCP buffer sizing (default: 16).'),
        trafficType: z.enum(['http_churn', 'http_keepalive', 'streaming_ws_grpc']).optional().describe('Traffic profile (default: "http_churn").'),
        targetDistro: z.enum(['ubuntu_debian', 'rhel_rocky', 'amazon_linux', 'docker_k8s']).optional().describe('Linux distro or container target (default: "ubuntu_debian").'),
        role: z.enum(['injector', 'target_sut']).optional().describe('Machine role: "injector" (JMeter client) or "target_sut" (default: "injector").'),
      },
    },
    async (params) => {
      try {
        const plan = generateOsTuningPlan({
          concurrency: params.concurrency,
          ramGb: params.ramGb,
          trafficType: params.trafficType,
          targetDistro: params.targetDistro,
          role: params.role,
        });
        return { content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `OS tuning error: ${errorText(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'convert_curl_or_har_to_jmx',
    {
      title: 'Convert cURL or HAR to JMeter JMX Test Plan',
      description:
        'Convert one or more cURL commands or HAR (HTTP Archive 1.2) JSON traces into a valid, production-ready Apache JMeter .jmx test plan XML with HTTP Request Defaults, Header Managers, Cookie Managers, timeouts, and assertions. Supports GET, POST, PUT, DELETE, PATCH, and RFC 9838 QUERY methods.',
      inputSchema: {
        input: z.string().min(1).max(1_000_000).describe('cURL command string (single, multiline, or batch) or HAR 1.2 JSON text (max 1MB).'),
        testPlanName: z.string().max(200).optional().describe('Name of the JMeter Test Plan (default: "cURL Converted Plan").'),
        threads: z.number().int().min(1).max(50000).optional().describe('Thread concurrency / virtual users (default: 1).'),
        rampUpSeconds: z.number().int().min(0).max(3600).optional().describe('Ramp-up time in seconds (default: 1).'),
        durationSeconds: z.number().int().min(0).max(86400).optional().describe('Test duration in seconds (0 = disabled, default: 0).'),
        loopCount: z.number().int().min(-1).max(1_000_000).optional().describe('Loop count (-1 for infinite, default: 1).'),
        parameterizeHost: z.boolean().optional().describe('Extract common host into HTTP Request Defaults and ${BASE_URL} (default: true).'),
        parameterizeAuth: z.boolean().optional().describe('Extract Bearer token into ${AUTH_TOKEN} variable (default: true).'),
        includeAssertions: z.boolean().optional().describe('Add HTTP 200/201/204 Response Code assertions (default: true).'),
        includeCookieManager: z.boolean().optional().describe('Include HTTP Cookie Manager (default: true).'),
        filterStaticAssets: z.boolean().optional().describe('Filter out images/css/fonts when parsing HAR (default: true).'),
      },
    },
    async (params) => runCurlHarConversionTool(params),
  );

  server.registerTool(
    'convert_openapi_to_jmx',
    {
      title: 'Convert OpenAPI / Swagger to JMeter JMX Test Plan',
      description:
        'Convert an OpenAPI 3.0/3.1 or Swagger 2.0 document (JSON or YAML) into a JMeter 5.6.3 .jmx test plan: servers become HTTP Request Defaults/${BASE_URL}, path parameters become User Defined Variables, request bodies are sampled from schemas, bearer/basic/apiKey security becomes ${AUTH_TOKEN}/${BASIC_AUTH}/${API_KEY}, with optional method, tag, and deprecated-operation filters.',
      inputSchema: {
        input: z.string().min(1).max(1_000_000).describe('OpenAPI 3.x or Swagger 2.0 document as JSON or YAML text (max 1MB).'),
        testPlanName: z.string().max(200).optional().describe('Name of the JMeter Test Plan.'),
        threads: z.number().int().min(1).max(50000).optional().describe('Thread concurrency / virtual users (default: 10).'),
        rampUpSeconds: z.number().int().min(0).max(3600).optional().describe('Ramp-up time in seconds (default: 5).'),
        durationSeconds: z.number().int().min(0).max(86400).optional().describe('Test duration in seconds (0 = disabled, default: 0).'),
        loopCount: z.number().int().min(-1).max(1_000_000).optional().describe('Loop count (-1 for infinite, default: 1).'),
        parameterizeHost: z.boolean().optional().describe('Extract the common host into HTTP Request Defaults and ${BASE_URL} (default: true).'),
        includeAssertions: z.boolean().optional().describe('Add HTTP 200/201/204 Response Code assertions (default: true).'),
        includeCookieManager: z.boolean().optional().describe('Include HTTP Cookie Manager (default: true).'),
        includeOptionalQueryParams: z.boolean().optional().describe('Include optional query parameters (default: false).'),
        useExampleValues: z.boolean().optional().describe('Substitute example/sample values into path params instead of ${var} variables (default: false).'),
        includeDeprecated: z.boolean().optional().describe('Include deprecated operations (default: false).'),
        methods: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'])).optional().describe('HTTP methods to include (default: GET, POST, PUT, PATCH, DELETE).'),
        tags: z.array(z.string().max(100)).max(100).optional().describe('Only include operations with one of these tags ("default" = untagged). Empty = all.'),
        serverIndex: z.number().int().min(0).max(50).optional().describe('Zero-based index of the OpenAPI server to use (default: 0).'),
        maxOperations: z.number().int().min(1).max(500).optional().describe('Maximum number of operations to convert (default: 500).'),
      },
    },
    async (params) => runOpenApiConversionTool(params),
  );

  server.registerTool(
    'get_correlation_sandbox',
    {
      title: 'Get Correlation & Practice Sandbox Test Plan',
      description:
        'Generate a ready-to-run Apache JMeter 5.6.3 .jmx practice test plan (either "solved" with Boundary/JSON/Header extractors or "challenge" with broken hardcoded tokens) targeting the live docs.jmeter.ai/api/sandbox endpoints or local localhost:8787 server.',
      inputSchema: {
        flowId: z.enum(['flow1', 'flow2', 'flow3', 'flow4']).optional().describe('Practice flow: "flow1" (CSRF + Cookie), "flow2" (JWT Bearer + Order chain), "flow3" (ASP.NET __VIEWSTATE + Header ticket), or "flow4" (HTTP 429 & JSON Assertion chaos). Default: "flow1".'),
        mode: z.enum(['solved', 'challenge']).optional().describe('"solved" returns a working correlated .jmx plan; "challenge" returns a broken plan with hardcoded recorded tokens for debugging practice. Default: "solved".'),
        target: z.enum(['edge', 'local']).optional().describe('"edge" targets https://docs.jmeter.ai/api/sandbox (1-thread debug); "local" targets http://localhost:8787/api/sandbox (high-RPS). Default: "edge".'),
      },
    },
    async (params) => runCorrelationSandboxTool(params),
  );
}
