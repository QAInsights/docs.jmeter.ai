/**
 * Shared MCP server factory. Both the public Streamable HTTP endpoint
 * (/api/mcp) and the Ask AI chatbot (/api/chat) call createServer() so
 * they expose the same tools, schemas, and instructions.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { retrieve, findChunkByPath } from '../rag.mjs';
import { lintJmx } from './jmx-linter.mjs';
import { calculateWorkloadModel } from './workload-calculator.mjs';
import { propertiesCheatsheet, filterProperties } from '../properties-data.mjs';
import { getJsr223Recipes } from './jsr223-recipes.mjs';
import { lookupErrorPlaybook } from './error-playbooks.mjs';
import { generateDistributedPlan } from '../distributed-planner.mjs';
import { generateOsTuningPlan } from '../os-tuning.mjs';
import { convertCurlOrHarToJmx } from './curl-har-to-jmx.mjs';

export const SERVER_NAME = 'jmeter-docs';
export const SERVER_VERSION = '1.4.0';

export const MCP_TOOL_NAMES = [
  'search_jmeter_docs',
  'get_jmeter_page',
  'convert_curl_or_har_to_jmx',
  'lint_jmx_snippet',
  'calculate_workload_model',
  'plan_distributed_testing',
  'tune_linux_os',
  'lookup_jmeter_property',
  'get_jsr223_recipe',
  'lookup_error_playbook',
];

const SNIPPET_CHARS = 500;
const MAX_PAGE_CHARS = 24000;

export const SERVER_INSTRUCTIONS = [
  'You have access to the Apache JMeter community documentation at https://docs.jmeter.ai and built-in JMeter diagnostic/calculation tools.',
  'Use search_jmeter_docs to find documentation pages, and get_jmeter_page to read pages in full.',
  'Use convert_curl_or_har_to_jmx to convert one or more cURL commands or HAR JSON traces into valid Apache JMeter .jmx test plan XML (supporting GET, POST, PUT, DELETE, PATCH, and RFC 9838 QUERY methods).',
  'Use lint_jmx_snippet to validate JMX test plan snippets against performance best practices.',
  "Use calculate_workload_model to compute Little's Law concurrency, pacing, ramp-up, and JVM heap sizing.",
  'Use plan_distributed_testing to configure Master-Worker RMI ports, user.properties, firewall rules, and Docker manifests.',
  'Use tune_linux_os to generate sysctl.conf, limits.conf, and systemd tuning parameters for high-concurrency injectors.',
  'Use lookup_jmeter_property, get_jsr223_recipe, and lookup_error_playbook for precise configuration and troubleshooting guidance.',
  'Always cite the docs.jmeter.ai URL you used when answering.',
].join(' ');

/** Strip markdown noise so search snippets stay readable. */
function snippet(body) {
  const cleaned = String(body || '')
    .replace(/^import .*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<a id="[^"]*"><\/a>/g, '')
    .replace(/:::(note|tip|caution|danger)(\[[^\]]*\])?/g, '')
    .replace(/:::/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > SNIPPET_CHARS
    ? cleaned.slice(0, SNIPPET_CHARS) + '...'
    : cleaned;
}

function errorText(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Execute the converter with the same blocking policy used by the public MCP
 * tool. Exported for endpoint-level regression tests without starting a
 * transport.
 */
export function runCurlHarConversionTool(params) {
  try {
    const result = convertCurlOrHarToJmx(params);
    if (!result.isValid) {
      const reason = result.blockingErrors.length > 0
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
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Conversion error: ${errorText(err)}` }],
      isError: true,
    };
  }
}

export function createServer() {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    'search_jmeter_docs',
    {
      title: 'Search JMeter documentation',
      description:
        'Search the Apache JMeter documentation on docs.jmeter.ai. Returns the most relevant pages with titles, URLs, and snippets. Use for any question about JMeter test plans, components, functions, properties, distributed testing, reports, or troubleshooting.',
      inputSchema: {
        query: z.string().min(1).describe('Search query, e.g. "how to correlate dynamic values" or "thread group ramp up"'),
      },
    },
    async ({ query }) => {
      const results = retrieve(query);
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No documentation pages on docs.jmeter.ai matched "${query}". Try broader keywords (e.g. "correlation" instead of a full sentence), or point the user at https://docs.jmeter.ai/topics/troubleshooting/.`,
            },
          ],
        };
      }
      const listing = results
        .map((r, i) => `${i + 1}. ${r.title}\nURL: ${r.url}\nSnippet: ${snippet(r.body)}`)
        .join('\n\n');
      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} relevant page(s) on docs.jmeter.ai. Use get_jmeter_page with a URL to read one in full.\n\n${listing}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_jmeter_page',
    {
      title: 'Read a JMeter documentation page',
      description:
        'Fetch the full markdown text of one docs.jmeter.ai page. Accepts the page URL (e.g. https://docs.jmeter.ai/topics/api-load-testing/) or a bare path (e.g. topics/api-load-testing).',
      inputSchema: {
        url: z.string().min(1).describe('Page URL or path, e.g. https://docs.jmeter.ai/user-manual/functions/ or user-manual/functions'),
      },
    },
    async ({ url }) => {
      const chunk = findChunkByPath(url);
      if (!chunk) {
        return {
          content: [
            {
              type: 'text',
              text: `No documentation page found for "${url}". Use search_jmeter_docs to find valid pages.`,
            },
          ],
          isError: true,
        };
      }
      let body = chunk.body.trim();
      let truncatedNote = '';
      if (body.length > MAX_PAGE_CHARS) {
        body = body.slice(0, MAX_PAGE_CHARS);
        truncatedNote = `\n\n[...page truncated at ${MAX_PAGE_CHARS} characters]`;
      }
      return {
        content: [
          {
            type: 'text',
            text: `# ${chunk.title}\nSource: ${chunk.url}\n\n${body}${truncatedNote}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'lint_jmx_snippet',
    {
      title: 'Lint JMX Test Plan Snippet',
      description:
        'Validate a JMeter test plan XML string or snippet against best practices and performance anti-patterns (e.g., active GUI listeners, legacy BeanShell, uncompiled JSR223, missing timeouts, zero ramp-up, Thread.sleep in scripts).',
      inputSchema: {
        jmxContent: z.string().min(1).describe('JMX XML string or test plan snippet to analyze.'),
      },
    },
    async ({ jmxContent }) => {
      const report = lintJmx(jmxContent);
      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      };
    },
  );

  server.registerTool(
    'calculate_workload_model',
    {
      title: "Calculate Workload Model & Little's Law Sizing",
      description:
        'Compute required thread concurrency, pacing delays, ramp-up schedules, and JVM heap recommendations based on target RPS/TPS and SLA response times using Little\'s Law.',
      inputSchema: {
        targetRps: z.number().positive().describe('Target throughput in requests / transactions per second (RPS/TPS).'),
        avgResponseTimeMs: z.number().positive().describe('Expected average response time in milliseconds.'),
        thinkTimeMs: z.number().nonnegative().optional().describe('Think time / user pause between requests in milliseconds (default: 0).'),
        testDurationMinutes: z.number().positive().optional().describe('Steady-state test duration in minutes (default: 10).'),
        safetyFactor: z.number().min(1.0).optional().describe('Headroom safety buffer multiplier (default: 1.25 = 25% buffer).'),
      },
    },
    async (params) => {
      try {
        const result = calculateWorkloadModel(params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Calculation error: ${errorText(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'lookup_jmeter_property',
    {
      title: 'Lookup JMeter Tuning Property',
      description:
        'Search or lookup curated JMeter properties (e.g. "httpclient4.idletimeout", "jmeter.save.saveservice.*", "remote_hosts", "summariser"). Returns category, defaults, and recommendations.',
      inputSchema: {
        query: z.string().describe('Property name or keyword to search (e.g. "ssl", "timeout", "jtl", "influxdb").'),
      },
    },
    async ({ query }) => {
      const matches = filterProperties(propertiesCheatsheet, query);
      if (matches.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No curated JMeter properties matched "${query}". Refer to the full reference at https://docs.jmeter.ai/tools/properties-cheatsheet/ or search the user manual using search_jmeter_docs.`,
            },
          ],
        };
      }
      const capped = matches.slice(0, 15);
      const note =
        matches.length > 15
          ? `\n\n(Showing top 15 of ${matches.length} matching properties. For the full list, see https://docs.jmeter.ai/tools/properties-cheatsheet/)`
          : '';
      return {
        content: [{ type: 'text', text: JSON.stringify(capped, null, 2) + note }],
      };
    },
  );

  server.registerTool(
    'get_jsr223_recipe',
    {
      title: 'Get Verified JSR223 Groovy Recipe',
      description:
        'Fetch production-ready, performant Groovy scripts for JMeter JSR223 samplers, preprocessors, and postprocessors (e.g., JWT parsing & expiration, HMAC-SHA256 signing, dynamic header injection, nested JSON array extraction, custom CSV failure logging).',
      inputSchema: {
        query: z.string().optional().describe('Filter by keyword or topic (e.g. "jwt", "hmac", "header", "json", "csv", "logging"). If omitted, returns all recipes.'),
      },
    },
    async ({ query }) => {
      const recipes = getJsr223Recipes(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(recipes, null, 2) }],
      };
    },
  );

  server.registerTool(
    'lookup_error_playbook',
    {
      title: 'Lookup Error & Exception Diagnostic Playbook',
      description:
        'Get immediate root causes, OS/JVM config fixes, and remediation steps for common JMeter exceptions (e.g. "BindException", "SocketTimeoutException", "OutOfMemoryError", "NoHttpResponseException", "SSLHandshakeException", "401/403 after recording").',
      inputSchema: {
        query: z.string().describe('Error message, exception name, or status (e.g. "bindexception", "heap", "timeout", "401").'),
      },
    },
    async ({ query }) => {
      const playbooks = lookupErrorPlaybook(query);
      if (playbooks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No specific playbook matched "${query}". Search general error guides with search_jmeter_docs or see https://docs.jmeter.ai/topics/errors/.`,
            },
          ],
        };
      }
      const capped = playbooks.slice(0, 10);
      const note =
        playbooks.length > 10
          ? `\n\n(Showing top 10 of ${playbooks.length} matching playbooks. See https://docs.jmeter.ai/topics/errors/)`
          : '';
      return {
        content: [{ type: 'text', text: JSON.stringify(capped, null, 2) + note }],
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
        return {
          content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
        };
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
        return {
          content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
        };
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

  return server;
}
