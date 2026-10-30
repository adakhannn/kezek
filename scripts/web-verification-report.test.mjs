import test from 'node:test';
import assert from 'node:assert/strict';
import { digest, summarize } from './web-verification-report.mjs';

function fixture() {
  const requirements = [{ id: 'E2-01', areaId: 'E2', requirement: 'Load profile', priority: 'P1', status: 'passed', casePlanComplete: true, expectedVariants: ['RU'], caseIds: ['E2-01-RU'] }];
  const data = { proof: Buffer.from('observed'), source: Buffer.from('implementation') };
  const ledger = {
    baseline: { requirementCount: 1, excludedIds: [], scopeHash: digest(JSON.stringify(requirements.map(r => [r.id, r.areaId, r.requirement, r.priority]))) },
    candidate: { id: 'candidate-1', currentCertification: true }, requirements,
    evidence: [{ id: 'EV-1', path: 'proof', sha256: digest(data.proof) }], fixes: [],
    cases: [{ id: 'E2-01-RU', requirementIds: ['E2-01'], status: 'passed', expected: 'Profile loaded', actual: 'Profile loaded', role: 'client', environment: 'dev', observedUtc: '2026-10-18T00:00:00Z', candidateId: 'candidate-1', method: 'live', requiresLive: true, sideEffects: 'Read only', steps: ['Open profile'], variants: ['RU'], dependencyHashes: { source: digest(data.source) }, evidenceIds: ['EV-1'] }],
    releaseGates: [{ id: 'SECURITY', status: 'open' }],
  };
  return { ledger, data, run: () => summarize(ledger, name => { if (!(name in data)) throw Error('missing'); return data[name]; }) };
}

test('100% scoped acceptance does not bypass release gates', () => {
  const f = fixture(), r = f.run(); assert.equal(r.valid, true); assert.equal(r.acceptancePercent, 100); assert.equal(r.releaseReady, false); assert.equal(r.productRemainingPercent, null);
});

test('candidate source boundary detects a changed file outside individual case dependencies', () => {
  const f = fixture();
  f.data.unrelated = Buffer.from('other implementation');
  f.data['source-list'] = Buffer.from(JSON.stringify(['source', 'unrelated']));
  f.ledger.candidate.sourceBoundary = { pathsFile: 'source-list', sha256: digest(f.data['source-list']), fileCount: 2 };
  f.ledger.candidate.sourceFingerprint = digest(JSON.stringify(['source', 'unrelated'].map(p => [p, digest(f.data[p])])));
  assert.equal(f.run().valid, true);
  f.data.unrelated = Buffer.from('changed');
  const s = f.run();
  assert.equal(s.valid, false);
  assert.equal(s.acceptancePercent, null);
  assert.ok(s.errors.includes('Candidate source boundary changed or missing'));
});

test('candidate source list cannot be silently shortened', () => {
  const f = fixture();
  f.data['source-list'] = Buffer.from(JSON.stringify(['source']));
  f.ledger.candidate.sourceBoundary = { pathsFile: 'source-list', sha256: digest(f.data['source-list']), fileCount: 2 };
  assert.equal(f.run().valid, false);
});

test('historical repro outside the active case plan does not inflate execution counts', () => {
  const f = fixture();
  f.ledger.cases.push({ id: 'old-repro', requirementIds: ['E2-01'], status: 'failed' });
  assert.equal(f.run().executionPercent, 100);
});
for (const [name, change] of [
  ['missing evidence', f => delete f.data.proof],
  ['changed evidence', f => f.data.proof = Buffer.from('different')],
  ['changed source dependency', f => f.data.source = Buffer.from('different')],
  ['wrong candidate', f => f.ledger.cases[0].candidateId = 'old'],
  ['historical candidate', f => f.ledger.candidate.currentCertification = false],
  ['unit cannot close live case', f => f.ledger.cases[0].method = 'unit'],
  ['incomplete variant list', f => f.ledger.requirements[0].expectedVariants.push('KY')],
  ['open child', f => f.ledger.cases[0].status = 'blocked'],
  ['unplanned coverage', f => f.ledger.requirements[0].casePlanComplete = false],
  ['missing visual', f => f.ledger.cases[0].requiresVisual = true],
  ['duplicate requirement', f => f.ledger.requirements.push(f.ledger.requirements[0])],
  ['unapproved denominator reduction', f => { f.ledger.requirements[0].status = 'excluded'; f.ledger.requirements[0].exclusionDecision = 'convenient'; }],
  ['changed frozen scope', f => f.ledger.requirements[0].requirement = 'Easier subset'],
  ['unknown evidence reference', f => f.ledger.cases[0].evidenceIds = ['missing']],
]) test(name, () => { const f = fixture(); change(f); const r = f.run(); assert.equal(r.valid, false); assert.equal(r.acceptancePercent, null); assert.equal(r.releaseReady, false); });

test('blocked and unassessed stay in denominator without partial credit', () => {
  const f = fixture(); f.ledger.cases = []; f.ledger.requirements[0].caseIds = []; f.ledger.requirements[0].status = 'blocked'; f.ledger.requirements[0].casePlanComplete = false;
  assert.equal(f.run().acceptancePercent, 0); assert.equal(f.run().applicable, 1); assert.equal(f.run().executionPercent, null);
  f.ledger.requirements[0].status = 'unassessed'; assert.equal(f.run().evidenceTriagePercent, 0);
});

function findingFixture() {
  const f = fixture();
  f.ledger.requirements[0].status = 'failed';
  f.ledger.cases[0].status = 'failed';
  f.ledger.currentFindings = [{ id: 'NEW-1', status: 'open', title: 'Observed failure', expected: 'Loaded', actual: 'Failed', steps: ['Open profile'], observedUtc: '2026-10-18T08:00:00Z', candidateId: 'candidate-1', sideEffects: 'None beyond telemetry', method: 'live', requirementIds: ['E2-01'], caseIds: ['E2-01-RU'], evidenceIds: ['EV-1'], fixApplied: false, retestCaseIds: [] }];
  return f;
}

test('current live findings remain separate from imported historical fixes', () => {
  const f = findingFixture(), s = f.run();
  assert.equal(s.valid, true);
  assert.deepEqual(s.currentFindings, { total: 1, open: 1, verified: 0 });
  assert.equal(s.historicalTargetedFixes, 0);
  assert.equal(s.releaseReady, false);
});
for (const [name, change] of [
  ['duplicate', f => f.ledger.currentFindings.push(f.ledger.currentFindings[0])],
  ['missing repro', f => f.ledger.currentFindings[0].caseIds = ['unknown']],
  ['missing evidence', f => f.ledger.currentFindings[0].evidenceIds = []],
  ['false verified', f => f.ledger.currentFindings[0].status = 'verified'],
  ['accepted affected requirement', f => f.ledger.requirements[0].status = 'passed'],
]) test(`reject current finding ${name}`, () => {
  const f = findingFixture(); change(f);
  assert.equal(f.run().valid, false);
});
