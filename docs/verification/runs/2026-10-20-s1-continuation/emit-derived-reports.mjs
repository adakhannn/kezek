// Read-only generation; emits apply_patch for exact derived documents only.
import fs from 'node:fs';
import { summarize, markdown } from '../../../../scripts/web-verification-report.mjs';
import { closureSummary, renderPlan } from '../../../../scripts/web-closure-plan.mjs';
const read = name => fs.readFileSync(name);
const ledger = JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json'));
const plan = JSON.parse(read('docs/WEB_CLOSURE_PLAN.json'));
const summary = summarize(ledger, read);
const closure = closureSummary(plan, ledger, summary);
if (!summary.valid || !closure.valid) throw Error(JSON.stringify([summary.errors, closure.errors]));
let patch = '*** Begin Patch\n';
for (const [file, next] of [['docs/WEB_VERIFICATION_REPORT.md', markdown(ledger, summary)], ['docs/WEB_CLOSURE_PLAN.md', renderPlan(plan, ledger, closure)]]) {
  const old = read(file).toString().replace(/\r\n/g, '\n').trimEnd();
  patch += '*** Update File: ' + file + '\n@@\n' + old.split('\n').map(line => '-' + line).join('\n') + '\n' + next.trimEnd().split('\n').map(line => '+' + line).join('\n') + '\n';
}
console.log(patch + '*** End Patch');
