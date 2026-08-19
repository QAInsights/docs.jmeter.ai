import { describe, it, expect } from 'vitest';
import {
  sanitizeCliPath,
  sanitizeRemoteHosts,
  parseJProperties,
  quoteCliPath,
  normalizeShell,
  buildJmeterArgs,
  buildCliCommand,
  buildGithubActionsSnippet,
  buildDockerSnippet,
  parseCliParams,
  serializeCliParams,
} from '../../src/lib/cli-builder.mjs';
import { CLI_BUILDER } from '../../src/lib/tools-config.mjs';

describe('sanitizeCliPath', () => {
  it('keeps simple relative paths', () => {
    expect(sanitizeCliPath('plan.jmx', 'fallback.jmx')).toBe('plan.jmx');
    expect(sanitizeCliPath('tests/plan.jmx', 'x')).toBe('tests/plan.jmx');
  });

  it('rejects shell metacharacters and parent traversal', () => {
    expect(sanitizeCliPath('plan.jmx; rm -rf /', 'safe.jmx')).toBe('safe.jmx');
    expect(sanitizeCliPath('../secret.jmx', 'safe.jmx')).toBe('safe.jmx');
    expect(sanitizeCliPath('plan$(whoami).jmx', 'safe.jmx')).toBe('safe.jmx');
  });
});

describe('sanitizeRemoteHosts / parseJProperties', () => {
  it('accepts a comma-separated host list', () => {
    expect(sanitizeRemoteHosts('worker1,worker2:1099')).toBe('worker1,worker2:1099');
    expect(sanitizeRemoteHosts('bad;host')).toBe('');
  });

  it('parses name=value lines and drops unsafe ones', () => {
    const props = parseJProperties('threads=50\nhost=staging.example.com\nbad name=1\n# comment\nempty=\n');
    expect(props).toEqual([
      { name: 'threads', value: '50' },
      { name: 'host', value: 'staging.example.com' },
    ]);
  });
});

describe('quoteCliPath', () => {
  it('quotes only when needed for bash', () => {
    expect(quoteCliPath('plan.jmx', 'bash')).toBe('plan.jmx');
    expect(quoteCliPath('my plan.jmx', 'bash')).toBe("'my plan.jmx'");
  });
});

describe('buildJmeterArgs / buildCliCommand', () => {
  it('emits the core non-GUI flags plus dashboard', () => {
    const args = buildJmeterArgs({
      plan: 'plan.jmx',
      results: 'results.jtl',
      report: 'report',
      generateReport: true,
    });
    expect(args).toEqual(['-n', '-t', 'plan.jmx', '-l', 'results.jtl', '-e', '-o', 'report']);
  });

  it('adds HEAP, -J, remotes, and -f when requested', () => {
    const built = buildCliCommand({
      plan: 'plan.jmx',
      results: 'results.jtl',
      report: 'report',
      generateReport: true,
      force: true,
      heapMb: 2048,
      extraJ: 'threads=50',
      remoteHosts: 'host1,host2',
      exitRemote: true,
      shell: 'bash',
    });
    expect(built.command).toContain('HEAP="-Xms');
    expect(built.command).toContain('-Xmx2048m"');
    expect(built.command).toContain('-f');
    expect(built.command).toContain('-Jthreads=50');
    expect(built.command).toContain('-R host1,host2');
    expect(built.command).toContain('-X');
  });

  it('uses PowerShell env syntax', () => {
    const built = buildCliCommand({
      plan: 'plan.jmx',
      results: 'results.jtl',
      generateReport: false,
      heapMb: 1024,
      shell: 'powershell',
    });
    expect(built.command.startsWith('$env:HEAP=')).toBe(true);
    expect(built.command).not.toContain('-e');
  });

  it('normalizes unknown shells to bash', () => {
    expect(normalizeShell('zsh')).toBe('bash');
  });
});

describe('CI / Docker snippets', () => {
  it('includes an artifact upload when a report is generated', () => {
    const yml = buildGithubActionsSnippet({
      plan: 'plan.jmx',
      results: 'results.jtl',
      report: 'report',
      generateReport: true,
    });
    expect(yml).toContain('run: jmeter -n -t plan.jmx');
    expect(yml).toContain('actions/upload-artifact@v4');
    expect(yml).toContain('path: report');
  });

  it('uses the configured docker image and mounts cwd', () => {
    const snippet = buildDockerSnippet({
      plan: 'plan.jmx',
      results: 'results.jtl',
      generateReport: false,
    });
    expect(snippet).toContain(CLI_BUILDER.dockerImage);
    expect(snippet).toContain('-v "$PWD:/tests"');
    expect(snippet).toContain('-n -t plan.jmx -l results.jtl');
  });
});

describe('parse/serialize CLI params', () => {
  it('round-trips via URLSearchParams', () => {
    const qs = serializeCliParams({
      plan: 'load.jmx',
      results: 'out.jtl',
      report: 'html',
      generateReport: true,
      force: true,
      heapMb: 1536,
      extraJ: 'host=api.example.com',
      shell: 'cmd',
    });
    const parsed = parseCliParams(new URLSearchParams(qs));
    expect(parsed.plan).toBe('load.jmx');
    expect(parsed.results).toBe('out.jtl');
    expect(parsed.report).toBe('html');
    expect(parsed.force).toBe(true);
    expect(parsed.heapMb).toBe(1536);
    expect(parsed.extraJ).toBe('host=api.example.com');
    expect(parsed.shell).toBe('cmd');
  });

  it('defaults generateReport on when the query omits it', () => {
    const parsed = parseCliParams(new URLSearchParams('plan=a.jmx'));
    expect(parsed.generateReport).toBe(true);
    expect(parsed.plan).toBe('a.jmx');
  });
});
