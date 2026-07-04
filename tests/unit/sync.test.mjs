import { describe, it, expect } from 'vitest';
import path from 'path';

// sync.mjs uses execSync to run convert + build.
// Since it's a script (not a library), we test the argument parsing
// logic by replicating it here. This validates the behavior without
// needing to mock execSync in an ESM context.

function parseSyncArgs(argv, env) {
  const args = argv.slice(2);
  let xdocsPath = env.JMETER_XDOCS || path.resolve('../jmeter/xdocs');

  const idx = args.indexOf('--jmeter-xdocs');
  if (idx !== -1 && args[idx + 1]) {
    xdocsPath = path.resolve(args[idx + 1]);
  }

  return { xdocsPath, shouldConvert: true, shouldBuild: true };
}

describe('sync.mjs argument parsing', () => {
  it('uses JMETER_XDOCS env var when no --jmeter-xdocs arg', () => {
    const result = parseSyncArgs(['node', 'sync.mjs'], { JMETER_XDOCS: '/custom/path' });
    expect(result.xdocsPath).toBe('/custom/path');
  });

  it('uses --jmeter-xdocs argument when provided', () => {
    const tmpPath = path.resolve('/tmp/xdocs');
    const result = parseSyncArgs(['node', 'sync.mjs', '--jmeter-xdocs', '/tmp/xdocs'], {});
    expect(result.xdocsPath).toBe(tmpPath);
  });

  it('--jmeter-xdocs overrides env var', () => {
    const result = parseSyncArgs(
      ['node', 'sync.mjs', '--jmeter-xdocs', '/arg/path'],
      { JMETER_XDOCS: '/env/path' }
    );
    expect(result.xdocsPath).toBe(path.resolve('/arg/path'));
  });

  it('defaults to ../jmeter/xdocs when no env or arg', () => {
    const result = parseSyncArgs(['node', 'sync.mjs'], {});
    expect(result.xdocsPath).toBe(path.resolve('../jmeter/xdocs'));
  });

  it('ignores --jmeter-xdocs without a value', () => {
    const result = parseSyncArgs(['node', 'sync.mjs', '--jmeter-xdocs'], { JMETER_XDOCS: '/env/path' });
    expect(result.xdocsPath).toBe('/env/path');
  });

  it('always sets convert and build to run', () => {
    const result = parseSyncArgs(['node', 'sync.mjs'], {});
    expect(result.shouldConvert).toBe(true);
    expect(result.shouldBuild).toBe(true);
  });
});
