/**
 * Pure helpers for the JMeter CLI command builder.
 * Sanitize paths and flags, then emit bash / PowerShell / cmd / CI / Docker.
 */

import { CLI_BUILDER } from './tools-config.mjs';
import {
  clampToRange,
  readBoolFlag,
  readNonNegativeClampedNumber,
} from './tools-utils.mjs';

const SHELLS = new Set(['bash', 'powershell', 'cmd']);

/** Characters that must never appear in a generated path or host list. */
const UNSAFE_CHARS = /[;&|`$(){}<>!\n\r]/;

/**
 * @param {unknown} input
 * @returns {'bash' | 'powershell' | 'cmd'}
 */
export function normalizeShell(input) {
  const s = String(input || '').trim().toLowerCase();
  return SHELLS.has(s) ? /** @type {'bash' | 'powershell' | 'cmd'} */ (s) : 'bash';
}

/**
 * Allow only simple relative/absolute paths (no shell metacharacters).
 * @param {unknown} input
 * @param {string} fallback
 * @param {number} [maxLen]
 * @returns {string}
 */
export function sanitizeCliPath(input, fallback, maxLen = CLI_BUILDER.limits.pathMaxLen) {
  const s = String(input ?? '').trim();
  if (!s) return fallback;
  if (s.length > maxLen) return fallback;
  if (UNSAFE_CHARS.test(s) || s.includes('..')) return fallback;
  return s;
}

/**
 * Optional path: empty string is valid (omit the flag).
 * @param {unknown} input
 * @param {number} [maxLen]
 * @returns {string}
 */
export function sanitizeOptionalPath(input, maxLen = CLI_BUILDER.limits.pathMaxLen) {
  const s = String(input ?? '').trim();
  if (!s) return '';
  return sanitizeCliPath(s, '', maxLen);
}

/**
 * Remote host list for -R: hostnames, IPs, commas, optional ports.
 * @param {unknown} input
 * @param {number} [maxLen]
 * @returns {string}
 */
export function sanitizeRemoteHosts(input, maxLen = CLI_BUILDER.limits.remoteHostsMaxLen) {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (s.length > maxLen) return '';
  if (!/^[A-Za-z0-9._:,\-\[\]]+$/.test(s)) return '';
  return s;
}

/**
 * Parse `name=value` lines into safe -J pairs. Drops empty and unsafe rows.
 * @param {unknown} input
 * @param {number} [maxLen]
 * @returns {{ name: string, value: string }[]}
 */
export function parseJProperties(input, maxLen = CLI_BUILDER.limits.extraJMaxLen) {
  const raw = String(input ?? '');
  if (raw.length > maxLen) return [];
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!/^[A-Za-z0-9._-]+$/.test(name)) continue;
    if (UNSAFE_CHARS.test(value) || value.includes(' ')) continue;
    if (!value) continue;
    out.push({ name, value });
  }
  return out;
}

/**
 * Quote a path for the selected shell.
 * @param {string} path
 * @param {'bash' | 'powershell' | 'cmd'} shell
 * @returns {string}
 */
export function quoteCliPath(path, shell) {
  const s = String(path ?? '');
  if (shell === 'powershell') {
    return `'${s.replace(/'/g, "''")}'`;
  }
  if (shell === 'cmd') {
    return /[\s^&]/.test(s) ? `"${s}"` : s;
  }
  if (/^[A-Za-z0-9._\-/@\\:]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * @param {number} heapMb
 * @param {typeof CLI_BUILDER} [config]
 * @returns {{ heapMb: number, xmsMb: number, heapFlag: string } | null}
 */
export function heapEnv(heapMb, config = CLI_BUILDER) {
  const n = Number(heapMb);
  if (!Number.isFinite(n) || n <= 0) return null;
  const heap = Math.round(clampToRange(n, config.limits.heapMb, 0));
  if (heap <= 0) return null;
  const step = 128;
  const xmsMb = Math.min(heap, Math.max(256, Math.round(heap / 2 / step) * step));
  return { heapMb: heap, xmsMb, heapFlag: `-Xms${xmsMb}m -Xmx${heap}m` };
}

/**
 * @typedef {{
 *   plan: string,
 *   results: string,
 *   report: string,
 *   generateReport: boolean,
 *   force: boolean,
 *   heapMb: number,
 *   propertiesFile: string,
 *   logFile: string,
 *   remoteHosts: string,
 *   exitRemote: boolean,
 *   extraJ: string,
 *   shell: string,
 * }} CliBuilderState
 */

/**
 * @param {Partial<CliBuilderState>} raw
 * @param {typeof CLI_BUILDER} [config]
 * @returns {CliBuilderState}
 */
export function normalizeCliState(raw = {}, config = CLI_BUILDER) {
  const def = config.defaults;
  return {
    plan: sanitizeCliPath(raw.plan, def.plan),
    results: sanitizeCliPath(raw.results, def.results),
    report: sanitizeCliPath(raw.report, def.report),
    generateReport: Boolean(raw.generateReport),
    force: Boolean(raw.force),
    heapMb: clampToRange(Number(raw.heapMb) || 0, config.limits.heapMb, 0),
    propertiesFile: sanitizeOptionalPath(raw.propertiesFile),
    logFile: sanitizeOptionalPath(raw.logFile),
    remoteHosts: sanitizeRemoteHosts(raw.remoteHosts),
    exitRemote: Boolean(raw.exitRemote),
    extraJ: String(raw.extraJ ?? '').slice(0, config.limits.extraJMaxLen),
    shell: normalizeShell(raw.shell),
  };
}

/**
 * JMeter argv after `jmeter` (no HEAP prefix).
 * @param {CliBuilderState} state
 * @returns {string[]}
 */
export function buildJmeterArgs(state) {
  const s = normalizeCliState(state);
  const args = ['-n', '-t', s.plan, '-l', s.results];
  if (s.generateReport) {
    args.push('-e', '-o', s.report);
  }
  if (s.force) args.push('-f');
  if (s.propertiesFile) args.push('-q', s.propertiesFile);
  if (s.logFile) args.push('-j', s.logFile);
  for (const prop of parseJProperties(s.extraJ)) {
    args.push(`-J${prop.name}=${prop.value}`);
  }
  if (s.remoteHosts) {
    args.push('-R', s.remoteHosts);
    if (s.exitRemote) args.push('-X');
  }
  return args;
}

/**
 * @param {CliBuilderState} state
 * @param {string[]} args
 * @returns {string}
 */
function formatCommand(state, args) {
  const heap = heapEnv(state.heapMb);
  const shell = normalizeShell(state.shell);
  const quoted = args.map((token, i) => {
    if (token.startsWith('-')) return token;
    const prev = args[i - 1];
    if (prev === '-t' || prev === '-l' || prev === '-o' || prev === '-q' || prev === '-j') {
      return quoteCliPath(token, shell);
    }
    return token;
  });
  const jmeterLine = ['jmeter', ...quoted].join(' ');

  if (!heap) return jmeterLine;
  if (shell === 'powershell') {
    return `$env:HEAP='${heap.heapFlag}'; ${jmeterLine}`;
  }
  if (shell === 'cmd') {
    return `set HEAP=${heap.heapFlag}&& ${jmeterLine}`;
  }
  return `HEAP="${heap.heapFlag}" ${jmeterLine}`;
}

/**
 * @param {Partial<CliBuilderState>} raw
 * @param {typeof CLI_BUILDER} [config]
 */
export function buildCliCommand(raw = {}, config = CLI_BUILDER) {
  const state = normalizeCliState(raw, config);
  const args = buildJmeterArgs(state);
  const command = formatCommand(state, args);
  const heap = heapEnv(state.heapMb, config);
  const notes = [
    'Requires jmeter on PATH (or wrap with the full path to bin/jmeter).',
    'Use CLI mode (-n) for load. Disable View Results Tree in the plan.',
  ];
  if (state.generateReport) {
    notes.push('The report directory must be empty unless you pass -f.');
  }
  if (heap) {
    notes.push(`HEAP sets -Xms${heap.xmsMb}m -Xmx${heap.heapMb}m for this process only.`);
  }
  if (state.remoteHosts) {
    notes.push('Start jmeter-server on each remote host before using -R.');
  } else if (state.exitRemote) {
    notes.push('-X only applies to distributed runs; add remote hosts to emit it.');
  }
  return { state, args, command, heap, notes };
}

/**
 * @param {Partial<CliBuilderState>} raw
 * @param {typeof CLI_BUILDER} [config]
 * @returns {string}
 */
export function buildGithubActionsSnippet(raw = {}, config = CLI_BUILDER) {
  const built = buildCliCommand({ ...raw, shell: 'bash' }, config);
  const lines = [
    '- name: Run JMeter',
    `  run: ${built.command}`,
  ];
  if (built.state.generateReport) {
    const report = built.state.report;
    lines.push(
      '- name: Upload HTML report',
      '  if: always()',
      '  uses: actions/upload-artifact@v4',
      '  with:',
      '    name: jmeter-report',
      `    path: ${report}`,
    );
  }
  return lines.join('\n');
}

/**
 * @param {Partial<CliBuilderState>} raw
 * @param {typeof CLI_BUILDER} [config]
 * @returns {string}
 */
export function buildDockerSnippet(raw = {}, config = CLI_BUILDER) {
  const state = normalizeCliState({ ...raw, shell: 'bash' }, config);
  const args = buildJmeterArgs(state)
    .map((token, i, all) => {
      if (token.startsWith('-')) return token;
      const prev = all[i - 1];
      if (prev === '-t' || prev === '-l' || prev === '-o' || prev === '-q' || prev === '-j') {
        return quoteCliPath(token, 'bash');
      }
      return token;
    })
    .join(' ');
  const heap = heapEnv(state.heapMb, config);
  const env = heap ? ` \\\n  -e HEAP="${heap.heapFlag}"` : '';
  return [
    `docker run --rm \\`,
    `  -v "$PWD:/tests" -w /tests${env} \\`,
    `  ${config.dockerImage} \\`,
    `  ${args}`,
  ].join('\n');
}

/**
 * @param {URLSearchParams | Record<string, string>} params
 * @param {typeof CLI_BUILDER} [config]
 */
export function parseCliParams(params, config = CLI_BUILDER) {
  const get =
    typeof params.get === 'function'
      ? (key) => params.get(key)
      : (key) => /** @type {Record<string, string>} */ (params)[key];
  const def = config.defaults;
  return normalizeCliState(
    {
      plan: get('plan') ?? def.plan,
      results: get('results') ?? def.results,
      report: get('report') ?? def.report,
      generateReport: get('reportOn') == null ? def.generateReport : readBoolFlag(params, 'reportOn'),
      force: readBoolFlag(params, 'force'),
      heapMb: readNonNegativeClampedNumber(params, 'heap', config.limits.heapMb, def.heapMb),
      propertiesFile: get('q') ?? '',
      logFile: get('log') ?? '',
      remoteHosts: get('hosts') ?? '',
      exitRemote: readBoolFlag(params, 'exit'),
      extraJ: get('j') ?? '',
      shell: get('shell') ?? def.shell,
    },
    config,
  );
}

/**
 * @param {Partial<CliBuilderState>} state
 * @param {typeof CLI_BUILDER} [config]
 */
export function serializeCliParams(state, config = CLI_BUILDER) {
  const s = normalizeCliState(state, config);
  const p = new URLSearchParams();
  p.set('plan', s.plan);
  p.set('results', s.results);
  p.set('report', s.report);
  p.set('reportOn', s.generateReport ? '1' : '0');
  if (s.force) p.set('force', '1');
  if (s.heapMb > 0) p.set('heap', String(s.heapMb));
  if (s.propertiesFile) p.set('q', s.propertiesFile);
  if (s.logFile) p.set('log', s.logFile);
  if (s.remoteHosts) p.set('hosts', s.remoteHosts);
  if (s.exitRemote) p.set('exit', '1');
  if (s.extraJ.trim()) p.set('j', s.extraJ.trim());
  p.set('shell', s.shell);
  return p.toString();
}
