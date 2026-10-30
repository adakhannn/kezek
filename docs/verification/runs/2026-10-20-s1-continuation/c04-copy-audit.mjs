// Read-only exact copy audit after preflight fingerprint failure; never starts compiler/network.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = JSON.parse(fs.readFileSync('docs/verification/runs/2026-10-20-s1-continuation/c01-source-paths.json'));
const copy = 'test-results/closure-s1-20261020-f003-fontread/build';
const mismatches = paths.filter(file => !fs.existsSync(path.join(copy, file)) || sha(fs.readFileSync(file)) !== sha(fs.readFileSync(path.join(copy, file))));
const fingerprint = sha(JSON.stringify(paths.map(file => [file, sha(fs.readFileSync(path.join(copy, file)))])));
console.log(JSON.stringify({ utc: new Date().toISOString(), fileCount: paths.length, fingerprint, mismatches, diagnosis: 'C01 preserved original ordered boundary then appended one new test; directory-copy traversal inserts that test alphabetically. Compare same exact set using certified order, not a different traversal order.', compilerSpawned: false, noSourceChanges: true }, null, 2));
