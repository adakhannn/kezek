import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bugBlocks, referencePaths, pages } from './web-evidence-audit.mjs';
import { digest, summarize } from './web-verification-report.mjs';
import { loadArchive } from './web-evidence-accounting.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p));
const actual=JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json'));

test('fenced sample is not a defect; both real colliding IDs and combined IDs survive',()=>{
  const text=['```markdown','### WB-001','- title: example','```','### WB-001','real one','### WB-045','real A','### WB-045','real B','### WB-165 / WB-166','two bugs'].join('\n');
  const result=bugBlocks(text);
  assert.deepEqual(result.map(b=>b.originalId),['WB-001','WB-045','WB-045','WB-165','WB-166']);
  assert.equal(result[0].startLine,5);assert.ok(!result[0].body.includes('example'));
});
test('explicit references normalize slashes without inventing missing proof',()=>{
  assert.deepEqual(referencePaths('`apps/web/test-results/old/a.json`; apps\\web\\test-results\\old\\b.png.'),['apps/web/test-results/old/a.json','apps/web/test-results/old/b.png']);
});
test('transport preserves all records and unicode across bounded pages',()=>{
  const rows=Array.from({length:10},(_,i)=>({i,text:'Киргизский / Кыргызча '+i}));
  const parsed=pages(rows,120).flatMap(p=>p.text.trimEnd().split('\n').map(JSON.parse));
  assert.deepEqual(parsed,rows);
});
test('complete available-history audit is valid, frozen scope stays 321/316, never release PASS',()=>{
  const s=summarize(actual,read);
  assert.deepEqual(s.errors,[]);assert.equal(s.total,321);assert.equal(s.applicable,316);
  assert.equal(s.evidenceTriagePercent,100);assert.equal(s.counts.unassessed,0);
  assert.equal(s.archive.files,2477);assert.equal(s.archive.defectRecords,204);
  assert.equal(s.archive.uniqueOriginalDefectIds,203);assert.equal(s.archive.missingLiteralFileReferences,109);
  assert.deepEqual(s.defectCounts,{historically_verified_targeted:121,documented_historical_verified:32,fixed_pending_verification:42,historical_open_or_reopened:8,retired_social_only:1});
  assert.equal(s.archive.reviewCounts.bounded_historical_evidence,228);
  assert.equal(s.releaseReady,false);assert.equal(s.executionPercent,null);assert.equal(s.productRemainingPercent,null);
  // History remains frozen; newly authorized current cases are accounted separately.
  const passed = actual.requirements.filter(r => r.status === 'passed');
  assert.equal(s.acceptancePercent, Math.round(passed.length / s.applicable * 1000) / 10);
  for (const r of passed) assert.ok(r.caseIds.length > 0 && r.caseIds.every(id => actual.cases.some(c => c.id === id && c.status === 'passed')));
});
test('every archived file and all final reports retain their exact bytes',()=>{
  const {data,errors}=loadArchive(actual.archive,read,actual.requirements);
  assert.deepEqual(errors,[]);
  for(const a of data.inventory)assert.equal(digest(read(a.path)),a.sha256,a.path);
  for(const f of actual.archive.frozenHistoricalFinals)assert.equal(digest(read(f.path)),f.sha256,f.path);
});
for(const [name,mutate] of [
  ['missing-primary declaration cannot become verified',l=>{l.fixes.find(f=>f.id==='WB-001').status='historically_verified_targeted';}],
  ['unrelated evidence cannot substitute exact primary fix proof',l=>{l.fixes.find(f=>f.id==='WB-201').evidenceIds=l.fixes.find(f=>f.id==='WB-200').evidenceIds;}],
  ['missing defect cannot silently reduce remaining work',l=>{l.fixes.pop();}],
  ['duplicate defect cannot increase fixed count',l=>{l.fixes.push(l.fixes[0]);}],
  ['unsubstantiated follow-up cannot supersede the historical status',l=>{l.archive.reconciliations[0].exactValue='invented PASS';}],
  ['archive row loss fails closed',l=>{l.archive.sections.reviews.rows--;}],
  ['archive hash mismatch fails closed',l=>{l.archive.sections.records.sha256='0'.repeat(64);}],
  ['missing complete section fails closed',l=>{delete l.archive.sections.records;}],
  ['requirement classification cannot drift from frozen evidence review',l=>{l.requirements[0].historicalAssessment='bounded_historical_evidence';}],
])test(name,()=>{const ledger=structuredClone(actual);mutate(ledger);const s=summarize(ledger,read);assert.equal(s.valid,false);assert.equal(s.acceptancePercent,null);assert.equal(s.releaseReady,false);});
test('source snapshot and defect excerpts survive active-document updates',()=>{
  const {data,errors}=loadArchive(actual.archive,read,actual.requirements);assert.deepEqual(errors,[]);
  const entries=data.records.filter(b=>b.originalId==='WB-045');assert.equal(entries.length,2);assert.notEqual(entries[0].id,entries[1].id);
  assert.ok(data.records.some(b=>b.id==='WB-165'));assert.ok(data.records.some(b=>b.id==='WB-166'));
  assert.equal(data.records.filter(b=>b.originalId==='WB-001').length,1);
  assert.equal(data.records.find(b=>b.id==='WB-082').status,'fixed_pending_verification');
  assert.equal(actual.fixes.find(b=>b.id==='WB-082').status,'historically_verified_targeted');
});
test('before failures and unit-only negative findings are preserved, not added as new live bugs',()=>{
  const {data}=loadArchive(actual.archive,read,actual.requirements);
  assert.ok(data.inventory.some(a=>/g116.*before/i.test(a.path)));
  assert.ok(data.stages.filter(s=>/stage-G14[15]-/.test(s.path)).every(s=>s.kind==='support_blocked_or_administrative_not_live_pass'));
  assert.ok(actual.fixes.every(f=>f.newInThisAudit===false&&f.currentCertification===false));
});
