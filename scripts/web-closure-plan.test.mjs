import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditPlan, closureSummary, renderPlan } from './web-closure-plan.mjs';

const sourcePlan = JSON.parse(fs.readFileSync(new URL('../docs/WEB_CLOSURE_PLAN.json', import.meta.url)));
const sourceLedger = JSON.parse(fs.readFileSync(new URL('../docs/WEB_VERIFICATION_LEDGER.json', import.meta.url)));
const fixture = () => ({ plan: structuredClone(sourcePlan), ledger: structuredClone(sourceLedger) });
// Unit tests exercise arithmetic only. The CLI independently verifies real evidence.
const validAccounting = { valid: true, executionPercent: null, releaseReady: false };

test('all 316 obligations, 50 unfinished chains and 32 provenance questions have exact ownership', () => {
  const { plan, ledger } = fixture();
  assert.deepEqual(auditPlan(plan, ledger), []);
  const s = closureSummary(plan, ledger, validAccounting);
  assert.deepEqual(s.phases.map(p => p.total), [25, 70, 45, 47, 47, 29, 31, 22]);
  assert.deepEqual(s.phases.map(p => p.plannedRemaining), [291, 221, 176, 129, 82, 53, 22, 0]);
  assert.equal(s.initialUnfinishedDefects, 50);
  assert.equal(s.provenanceQuestions, 32);
  assert.equal(s.phases.reduce((n, p) => n + p.priorityCounts.P0, 0), 168);
  assert.equal(s.phases.reduce((n, p) => n + p.priorityCounts.P1, 0), 110);
  assert.equal(s.phases.reduce((n, p) => n + p.priorityCounts.P2, 0), 38);
});

for (const [name, change] of [
  ['duplicate requirement', f => f.plan.phases[1].requirementIds.push(f.plan.phases[0].requirementIds[0])],
  ['omitted requirement', f => f.plan.phases[0].requirementIds.pop()],
  ['excluded scope', f => f.plan.phases[0].requirementIds.push('C2-01')],
  ['scope hash', f => f.plan.scopeHash = 'changed'],
  ['denominator', f => f.plan.applicableCount--],
  ['package omission', f => f.plan.phases[0].packages[0].requirementIds.pop()],
  ['wrong area mapping', f => f.plan.phases[0].packages[0].areaIds.push('E2')],
  ['duplicate package', f => f.plan.phases[1].packages[0].id = f.plan.phases[0].packages[0].id],
  ['duplicate defect', f => f.plan.phases[1].fixIds.push(f.plan.phases[0].fixIds[0])],
  ['missing provenance', f => f.plan.provenanceTrack.ids.pop()],
  ['unknown blocker', f => f.plan.phases[0].blockers.push('unknown')],
  ['ownerless blocker', f => f.plan.blockers[0].owner = ''],
  ['live authorization', f => f.plan.authorization.liveTestsAuthorized = true],
  ['automation authorization', f => f.plan.authorization.automationResumeAuthorized = true],
  ['prep counted as pass', f => f.plan.preparation.countsAsAcceptedRequirements = 1],
]) test(`reject ${name}`, () => {
  const f = fixture(); change(f);
  const s = closureSummary(f.plan, f.ledger, validAccounting);
  assert.equal(s.valid, false);
  assert.equal(s.actualAccepted, null);
  assert.equal(s.releaseReady, false);
});

test('conditional full milestone does not certify requirements or start tests', () => {
  const { plan, ledger } = fixture();
  for (const r of ledger.requirements) if (r.status !== 'excluded') r.status = 'blocked';
  const s = closureSummary(plan, ledger, validAccounting);
  assert.equal(s.actualAccepted, 0);
  assert.equal(s.actualRemaining, 316);
  assert.equal(s.phases.at(-1).plannedCumulativeAccepted, 316);
  assert.equal(s.phases.reduce((n, p) => n + p.blocked, 0), 316);
  assert.equal(s.atomicExecutionPercent, null);
  assert.equal(s.liveTestsStartedByPlan, false);
});

test('accepted count is derived from ledger, not partial history; stale/reopened decreases it', () => {
  const { plan, ledger } = fixture();
  for (const r of ledger.requirements) if (r.status !== 'excluded') r.status = 'partial';
  const first = ledger.requirements.find(r => r.id === plan.phases[0].requirementIds[0]);
  first.status = 'passed';
  assert.equal(closureSummary(plan, ledger, validAccounting).actualRemaining, 315);
  first.status = 'failed';
  assert.equal(closureSummary(plan, ledger, validAccounting).actualRemaining, 316);
});

test('invalid evidence suppresses actual counts even if ledger labels a requirement passed', () => {
  const { plan, ledger } = fixture(); ledger.requirements[0].status = 'passed';
  const s = closureSummary(plan, ledger, { valid: false, releaseReady: false });
  assert.equal(s.actualAccepted, null);
  assert.equal(s.phases[0].actualAccepted, null);
  assert.match(renderPlan(plan, ledger, s), /ошибка учёта/);
});

test('render is deterministic and does not mutate plan or ledger', () => {
  const { plan, ledger } = fixture();
  const before = JSON.stringify({ plan, ledger });
  const s = closureSummary(plan, ledger, validAccounting);
  const output = renderPlan(plan, ledger, s);
  assert.equal(output, renderPlan(plan, ledger, s));
  assert.match(output, /условный план/);
  assert.match(output, /42 fixed\/pending/);
  assert.equal(before, JSON.stringify({ plan, ledger }));
});
