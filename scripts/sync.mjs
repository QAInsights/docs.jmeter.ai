#!/usr/bin/env node

/**
 * Sync upstream JMeter xdocs to the docs repo.
 * Usage: node scripts/sync.mjs [--jmeter-xdocs <path>]
 *
 * If --jmeter-xdocs is not provided, uses the JMETER_XDOCS environment variable.
 * If neither is set, defaults to ../jmeter/xdocs.
 */

import { execSync } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
let xdocsPath = process.env.JMETER_XDOCS || path.resolve('../jmeter/xdocs');

const idx = args.indexOf('--jmeter-xdocs');
if (idx !== -1 && args[idx + 1]) {
  xdocsPath = path.resolve(args[idx + 1]);
}

console.log(`Syncing from: ${xdocsPath}`);

// Step 1: Convert xdocs
process.env.JMETER_XDOCS = xdocsPath;
execSync('node tools/convert.mjs', { stdio: 'inherit' });

// Step 2: Build
console.log('\nBuilding site...');
execSync('npm run build', { stdio: 'inherit' });

console.log('\nSync complete! Run `npm run preview` to test locally.');
