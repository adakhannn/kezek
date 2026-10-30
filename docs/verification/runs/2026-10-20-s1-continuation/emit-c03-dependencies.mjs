// Emits a narrow patch only; no writes or network. Current C03 live dependency boundary.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const file = 'docs/WEB_VERIFICATION_LEDGER.json';
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const start = source.lastIndexOf('    {', source.indexOf('"id": "B2-04-S13-3"'));
const end = source.indexOf('\n    },\n    {', start) + 7;
const old = source.slice(start, end);
const row = JSON.parse(old.slice(0, -1));
if (row.id !== 'B2-04-S13-3' || row.observedUtc !== '2026-10-20T08:50:56Z') throw Error('Unexpected live row');
for (const name of Object.keys(row.dependencyHashes)) row.dependencyHashes[name] = createHash('sha256').update(fs.readFileSync(name)).digest('hex');
const next = JSON.stringify(row, null, 2).split('\n').map(line => '    ' + line).join('\n') + ',';
console.log('*** Begin Patch\n*** Update File: ' + file + '\n@@\n' + old.split('\n').map(line => '-' + line).join('\n') + '\n' + next.split('\n').map(line => '+' + line).join('\n') + '\n*** End Patch');
