/**
 * Shared MCP server factory. Both the public Streamable HTTP endpoint
 * (/api/mcp) and the Ask AI chatbot (/api/chat) call createServer() so
 * they expose the same tools, schemas, and instructions.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { retrieve, findChunkByPath } from '../rag.mjs';
import { lintJmx } from './jmx-linter.mjs';
import { analyzeJmxStructure } from '../jmx-analyzer.mjs';
import { calculateWorkloadModel } from './workload-calculator.mjs';
import { propertiesCheatsheet, filterProperties } from '../properties-data.mjs';
import { getJsr223Recipes } from './jsr223-recipes.mjs';
import { lintGroovyScript, buildJsr223ElementXml, BINDINGS_BY_ELEMENT } from '../groovy-builder.mjs';
import { GROOVY_BUILDER } from '../tools-config.mjs';
import { lookupErrorPlaybookSemantic } from './error-playbooks.mjs';
import { triageErrors, renderTriageText, triageErrorsSchema } from './triage-errors.mjs';
import {
  registerExtraServerTools,
  runCurlHarConversionTool,
  runOpenApiConversionTool,
  runCorrelationSandboxTool,
} from './server-tools-extra.mjs';
import { withUtm } from '../path-utils.mjs';

export {
  runCurlHarConversionTool,
  runOpenApiConversionTool,
  runCorrelationSandboxTool,
};

export const SERVER_NAME = 'jmeter-docs';
export const SERVER_VERSION = '1.6.0';

export const MCP_TOOL_NAMES = [
  'search_jmeter_docs',
  'get_jmeter_page',
  'convert_curl_or_har_to_jmx',
  'convert_openapi_to_jmx',
  'lint_jmx_snippet',
  'calculate_workload_model',
  'plan_distributed_testing',
  'tune_linux_os',
  'lookup_jmeter_property',
  'get_jsr223_recipe',
  'lint_groovy_script',
  'lookup_error_playbook',
  'triage_errors',
  'lookup_component',
  'lookup_function',
  'get_correlation_sandbox',
];

const SNIPPET_CHARS = 500;
const MAX_PAGE_CHARS = 24000;

export const SERVER_INSTRUCTIONS = [
  'You have access to the Apache JMeter community documentation at https://docs.jmeter.ai and built-in JMeter diagnostic/calculation tools.',
  'Use search_jmeter_docs to find documentation pages, and get_jmeter_page to read pages in full.',
  'Use convert_curl_or_har_to_jmx to convert one or more cURL commands or HAR JSON traces into valid Apache JMeter .jmx test plan XML (supporting GET, POST, PUT, DELETE, PATCH, and RFC 9838 QUERY methods).',
  'Use convert_openapi_to_jmx to turn an OpenAPI 3.x or Swagger 2.0 spec (JSON or YAML) into a JMeter .jmx test plan.',
  'Use lint_jmx_snippet to validate JMX test plan snippets against performance best practices and inventory their structure.',
  'Use lint_groovy_script to check a JSR223 Groovy script for JMeter-specific pitfalls and unavailable bindings, and to generate the JSR223 element XML.',
  "Use calculate_workload_model to compute Little's Law concurrency, pacing, ramp-up, and JVM heap sizing.",
  'Use plan_distributed_testing to configure Master-Worker RMI ports, user.properties, firewall rules, and Docker manifests.',
  'Use tune_linux_os to generate sysctl.conf, limits.conf, and systemd tuning parameters for high-concurrency injectors.',
  'Use lookup_jmeter_property, get_jsr223_recipe, and lookup_error_playbook for precise configuration and troubleshooting guidance.',
  'Use triage_errors to batch-map a run\'s distinct failure signatures (sampler | response code | response message) to error playbooks before reading them with get_jmeter_page.',
  'Use lookup_component and lookup_function for the dedicated reference page of a specific test plan component (e.g. "HTTP Request") or built-in function (e.g. "__time").',
  'Use get_correlation_sandbox to fetch practice JMX test plans (CSRF/Cookie, JWT Bearer, ASP.NET ViewState, HTTP 429 Chaos) and live target endpoints.',
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

export function runGroovyLintTool(params) {
  try {
    const elementType = params.elementType || GROOVY_BUILDER.defaults.elementType;
    const elementConfig = GROOVY_BUILDER.elementTypes.find((item) => item.id === elementType);
    const name = params.name || elementConfig?.defaultName || elementConfig?.label || elementType;
    const lint = lintGroovyScript(params.code, elementType);
    const errorCount = lint.findings.filter((finding) => finding.severity === 'error').length;
    const warningCount = lint.findings.filter((finding) => finding.severity === 'warning').length;
    const result = {
      elementType,
      findings: lint.findings,
      bindings: lint.bindings,
      unavailableBindings: lint.unavailableBindings,
      availableBindings: BINDINGS_BY_ELEMENT[elementType],
      errorCount,
      warningCount,
      summary: errorCount || warningCount
        ? `Found ${errorCount} error(s) and ${warningCount} warning(s) for ${elementType}.`
        : 'No JMeter-specific issues found.',
    };
    if (params.includeJmxElement !== false) {
      result.jmxElement = buildJsr223ElementXml({
        elementType,
        name,
        code: params.code,
        parameters: params.parameters || '',
        cacheKey: true,
      });
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Lint error: ${errorText(err)}` }],
      isError: true,
    };
  }
}

export function runJmxLintTool({ jmxContent }) {
  try {
    const report = {
      ...lintJmx(jmxContent),
      structure: analyzeJmxStructure(jmxContent),
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Lint error: ${errorText(err)}` }],
      isError: true,
    };
  }
}

export function createServer({ onToolCall } = {}) {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  if (typeof onToolCall === 'function') {
    const rawRegisterTool = server.registerTool.bind(server);
    server.registerTool = (name, config, handler) =>
      rawRegisterTool(name, config, async (args, extra) => {
        const started = Date.now();
        const result = await handler(args, extra);
        try {
          onToolCall({ toolName: name, args, result, durationMs: Date.now() - started });
        } catch {
          /* telemetry must never break tool serving */
        }
        return result;
      });
  }

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
              text: `No documentation pages on docs.jmeter.ai matched "${query}". Try broader keywords (e.g. "correlation" instead of a full sentence), or point the user at ${withUtm('https://docs.jmeter.ai/topics/troubleshooting/', 'mcp')}.`,
            },
          ],
        };
      }
      const listing = results
        .map((r, i) => `${i + 1}. ${r.title}\nURL: ${withUtm(r.url, 'mcp')}\nSnippet: ${snippet(r.body)}`)
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
            text: `# ${chunk.title}\nSource: ${withUtm(chunk.url, 'mcp')}\n\n${body}${truncatedNote}`,
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
        'Validate a JMeter test plan XML string or snippet against best practices and performance anti-patterns, and return a structural inventory with thread groups, sampler/listener/assertion counts, HTTP Defaults/Header/Cookie/CSV presence, plugin classes, and JMeter version.',
      inputSchema: {
        jmxContent: z.string().min(1).max(1_000_000).describe('JMX XML string or test plan snippet to analyze (max 1MB).'),
      },
    },
    async (params) => runJmxLintTool(params),
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
              text: `No curated JMeter properties matched "${query}". Refer to the full reference at ${withUtm('https://docs.jmeter.ai/tools/properties-cheatsheet/', 'mcp')} or search the user manual using search_jmeter_docs.`,
            },
          ],
        };
      }
      const capped = matches.slice(0, 15);
      const note =
        matches.length > 15
          ? `\n\n(Showing top 15 of ${matches.length} matching properties. For the full list, see ${withUtm('https://docs.jmeter.ai/tools/properties-cheatsheet/', 'mcp')})`
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
    'lint_groovy_script',
    {
      title: 'Lint JMeter Groovy (JSR223) Script',
      description:
        'Statically analyze a Groovy script for a JMeter JSR223 element. Flags Thread.sleep, ${var} interpolation, System.out, BeanShell APIs, per-call Random or Pattern.compile, and bindings such as prev, SampleResult, or sampler that the selected element type does not expose; optionally returns ready-to-paste JMX element XML.',
      inputSchema: {
        code: z.string().min(1).max(200_000).describe('Groovy script source.'),
        elementType: z.enum(GROOVY_BUILDER.elementTypes.map((item) => item.id)).optional().describe('(default: JSR223PostProcessor)'),
        name: z.string().max(120).optional().describe('testname for the generated JMX element (default: element label).'),
        parameters: z.string().max(2000).optional().describe('Space-separated parameters available through Parameters and args.'),
        includeJmxElement: z.boolean().optional().describe('Also return the JSR223 element XML with compilation caching enabled (default: true).'),
      },
    },
    async (params) => runGroovyLintTool(params),
  );

  server.registerTool(
    'lookup_error_playbook',
    {
      title: 'Lookup Error & Exception Diagnostic Playbook',
      description:
        'Get immediate root causes, OS/JVM config fixes, and remediation steps for common JMeter exceptions (e.g. "BindException", "SocketTimeoutException", "OutOfMemoryError", "NoHttpResponseException", "SSLHandshakeException", "401/403 after recording"). When keywords miss, unmatched text is sent to classifier.dev for zero-shot semantic matching (public keyless calls are not stored).',
      inputSchema: {
        query: z.string().describe('Error message, exception name, or status (e.g. "bindexception", "heap", "timeout", "401").'),
        classifierApiKey: z.string().optional().describe('Your own classifier.dev API key for the semantic fallback (anonymous quota is shared); never logged.'),
      },
    },
    async ({ query, classifierApiKey }) => {
      const noMatchText = `No specific playbook matched "${query}". Search general error guides with search_jmeter_docs or see ${withUtm('https://docs.jmeter.ai/topics/errors/', 'mcp')}.`;
      const outcome = await lookupErrorPlaybookSemantic(query, { classifierApiKey });

      if (outcome.matchedBy === 'none') {
        return { content: [{ type: 'text', text: noMatchText }] };
      }
      if (outcome.matchedBy === 'uncertain') {
        const possible = (outcome.possible || [])
          .map((p) => `- ${p.title} (${p.score}) ${p.docUrl}`)
          .join('\n');
        return {
          content: [
            {
              type: 'text',
              text: `${noMatchText}\n\nPossible playbooks:\n${possible}`,
            },
          ],
        };
      }
      const playbooks = outcome.playbooks;
      const capped = playbooks.slice(0, 10);
      const note =
        playbooks.length > 10
          ? `\n\n(Showing top 10 of ${playbooks.length} matching playbooks. See ${withUtm('https://docs.jmeter.ai/topics/errors/', 'mcp')})`
          : '';
      return {
        content: [{ type: 'text', text: JSON.stringify(capped, null, 2) + note }],
      };
    },
  );

  server.registerTool(
    'triage_errors',
    {
      title: 'Triage a Batch of JMeter Error Signatures',
      description:
        'Map a run\'s distinct failure signatures to docs.jmeter.ai error playbooks. Error text is sent to classifier.dev for zero-shot classification (public keyless calls are not stored; obvious secrets are redacted first). Prefer signatures shaped as "sampler | response code | response message".',
      inputSchema: triageErrorsSchema,
    },
    async (params) => {
      try {
        const result = await triageErrors(params);
        return {
          content: [{ type: 'text', text: `${renderTriageText(result)}\n\n${JSON.stringify(result, null, 2)}` }],
          structuredContent: result,
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Triage error: ${errorText(err)}` }],
          isError: true,
        };
      }
    },
  );

  registerExtraServerTools(server);

  return server;
}
