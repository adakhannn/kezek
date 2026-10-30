// Emits a reviewable apply_patch; never writes files, starts the app or calls the network.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = 'C:/projects/kezek';
const run = 'docs/verification/runs/2026-10-18-s1';
const ledgerPath = 'docs/WEB_VERIFICATION_LEDGER.json';
const spec = JSON.parse(fs.readFileSync(path.join(root, run, 's14-update-spec.json')));
const bytes = file => fs.readFileSync(path.join(root, file));
const sha = value => createHash('sha256').update(value).digest('hex');
const ledger = JSON.parse(bytes(ledgerPath));
if (sha(bytes(ledgerPath)) !== spec.baseLedgerSha256 || ledger.candidate.id !== spec.fromCandidateId) throw Error('Base ledger changed');
const pathsFile = `${run}/s14-source-paths.json`;
const sourcePaths = JSON.parse(bytes(pathsFile));
if (sha(JSON.stringify(sourcePaths.map(file => [file, sha(bytes(file))]))) !== spec.sourceFingerprint) throw Error('Build source changed');
const oldCandidate = structuredClone(ledger.candidate);
ledger.candidateHistory = [...(ledger.candidateHistory || []), { ...oldCandidate, currentCertification: false, supersededUtc: spec.utc }];
ledger.candidate = { ...oldCandidate, id: spec.candidateId, sourceFingerprint: spec.sourceFingerprint,
    currentCertification: true, status: 'active_scoped_acceptance_not_release', observedUtc: spec.utc,
    fileCount: sourcePaths.length, sourceScope: 'Exact ordered mechanical build selection, including source/tests/public assets and17 selected build/package entries; no environment secrets or generated caches',
    sourceBoundary: { pathsFile, sha256: sha(bytes(pathsFile)), fileCount: sourcePaths.length },
    previousCandidate: { id: oldCandidate.id, sourceFingerprint: oldCandidate.sourceFingerprint } };
for (const c of ledger.cases.filter(c => c.status === 'passed')) {
    const old = { candidateId: c.candidateId, observedUtc: c.observedUtc, variants: c.variants, expected: c.expected, actual: c.actual, evidenceIds: [...c.evidenceIds] };
    const changed = Object.entries(c.dependencyHashes).filter(([file, hash]) => sha(bytes(file)) !== hash).map(([file]) => file);
    if (changed.some(file => !spec.changedRuntimeFiles.includes(file))) throw Error(`Unreviewed dependency: ${c.id}`);
    const refresh = spec.liveRefreshCaseIds.includes(c.id);
    const fragment = spec.unchangedFragmentCaseIds.includes(c.id);
    const unreachable = spec.unreachableBranchCaseIds.includes(c.id);
    const unrelated = spec.unrelatedDependencyCaseIds.includes(c.id);
    if (changed.length && !refresh && !fragment && !unreachable && !unrelated) throw Error(`Missing candidate review: ${c.id}`);
    for (const file of changed) {
        if (unreachable || unrelated || (fragment && file.endsWith('/BusinessInfo.tsx'))) delete c.dependencyHashes[file];
        else c.dependencyHashes[file] = sha(bytes(file));
    }
    if (c.id.startsWith('S12-')) {
        const match = c.id.match(/^S12-(?:owner|guest)-route-(\d)$/);
        const page = match ? ['page.tsx', 'auth/sign-in/page.tsx', 'terms/page.tsx', 'privacy/page.tsx'][Number(match[1]) - 1]
            : c.id === 'S12-404-recovery' ? 'page.tsx' : 'not-found.tsx';
        c.dependencyHashes[`apps/web/src/app/${page}`] = sha(bytes(`apps/web/src/app/${page}`));
        c.dependencyHashes['apps/web/src/app/layout.tsx'] = sha(bytes('apps/web/src/app/layout.tsx'));
    }
    c.previousCertification = old;
    c.candidateId = spec.candidateId;
    c.certificationReview = { utc: spec.utc, fromCandidateId: spec.fromCandidateId,
        basis: refresh ? 'Targeted current-source live result refreshed in S14' : fragment ? 'Current home CTA label/href verified; changed hunks affect only branch booking state; previously tested destination sources unchanged'
            : unreachable ? 'Not-found branch returns unchanged BusinessPageState before BusinessInfo; home page unused' : unrelated ? 'Private route does not import home page; unrelated broad dependency removed' : 'Declared dependencies unchanged; whole candidate source boundary now checked',
        originalChangedDependencies: changed, evidenceId: 'S1-EV-6' };
    if (refresh) {
        c.observedUtc = spec.liveThroughUtc;
        c.evidenceIds = [...new Set([...c.evidenceIds, 'S1-EV-6'])];
        c.actual = spec.actualOverrides[c.id] || `${c.actual} Current changed-page output reverified in S14; see S1-EV-6.`;
    }
}
const cardCase = ledger.cases.find(c => c.id === 'B1-02-S13-3');
cardCase.variants = ['card1 unavailable booking entry'];
cardCase.expected = 'No booking CTA for business without branches; Details remains usable';
const cardRequirement = ledger.requirements.find(r => r.id === 'B1-02');
cardRequirement.expectedVariants = cardRequirement.expectedVariants.map(v => v === 'card1 booking CTA' ? cardCase.variants[0] : v);
const baseDeps = Object.fromEntries(spec.changedRuntimeFiles.map(file => [file, sha(bytes(file))]));
for (const definition of spec.caseUpdates) {
    const c = ledger.cases.find(c => c.id === definition.id);
    if (!c) throw Error('Missing case ' + definition.id);
    Object.assign(c, definition, { candidateId: spec.candidateId, observedUtc: spec.liveThroughUtc, method: 'live', dependencyHashes: { ...baseDeps, ...Object.fromEntries(spec.errorSourceFiles.map(file => [file, sha(bytes(file))])) }, requiresLive: true,
        evidenceIds: ['S1-EV-7'], sideEffects: spec.sideEffects });
}
for (const definition of spec.newCases) ledger.cases.push({ ...definition, candidateId: spec.candidateId,
    observedUtc: spec.liveThroughUtc, method: 'live', requiresLive: true, dependencyHashes: baseDeps,
    evidenceIds: ['S1-EV-6', 'S1-EV-8'], sideEffects: spec.sideEffects });
const availability = ledger.requirements.find(r => r.id === 'B2-03');
availability.caseIds = availability.caseIds.map(id => id === 'B2-03-S13-4' ? 'S14-F001-empty' : id);
availability.status = 'partial';
for (const id of ['A4-02', 'A4-04']) ledger.requirements.find(r => r.id === id).status = 'passed';
const finding = ledger.currentFindings.find(f => f.id === 'S1-F001');
Object.assign(finding, { status: 'verified', fixApplied: true, verifiedUtc: spec.utc, verifiedCandidateId: spec.candidateId,
    fixEvidenceIds: ['S1-EV-6', 'S1-EV-8', 'S1-EV-12'], retestCaseIds: ['S14-F001-empty', 'S14-F001-positive'] });
for (const [id, name] of spec.evidenceFiles) ledger.evidence.push({ id, path: `${run}/${name}`, sha256: sha(bytes(`${run}/${name}`)) });
ledger.updatedUtc = spec.utc;
Object.assign(ledger.nextBatch, { status: 'S1_fix_verified_config_followup_active', deadlineUtc: '2026-10-18T12:40:00Z',
    authorization: 'User explicitly authorizes fixing S1-F001, live retest and continued S1 work until18:40Bishkek18Oct2026. Domain deferred to end.',
    objective: 'Continue missing/invalid local configuration and remaining S1 variants; report each subpackage. No deadline extension or automatic S2.' });

function emitPatch(file, value) {
    const result = spawnSync('git', ['-c', 'core.safecrlf=false', 'diff', '--no-index', '--no-ext-diff', '--unified=80', '--', file, '-'],
        { cwd: root, input: JSON.stringify(value, null, 2) + '\n', encoding: 'utf8', windowsHide: true });
    if (result.status !== 1) throw Error(result.stderr || 'No expected patch');
    const lines = result.stdout.split('\n');
    const start = lines.findIndex(line => line.startsWith('@@'));
    return `*** Update File: ${root}/${file}\n` + lines.slice(start).filter(line => !line.startsWith('\\ No newline')).map(line => line.startsWith('@@') ? '@@' : line).join('\n').trimEnd() + '\n';
}
const progressPath = `${run}/progress.json`;
const progress = JSON.parse(bytes(progressPath));
progress.candidate = ledger.candidate;
progress.deadlineUtc = '2026-10-18T12:40:00Z';
progress.status = 'in_progress';
progress.activePackage = 'S1.1-config-followup';
progress.acceptedNow = ledger.requirements.filter(r => r.status === 'passed').length;
progress.remainingOverall = 316 - progress.acceptedNow;
for (const pack of progress.packagePlans) {
    for (const r of pack.requirements) {
        const current = ledger.requirements.find(x => x.id === r.id);
        r.expectedVariants = current.expectedVariants; r.caseIds = current.caseIds;
    }
    pack.acceptedRequirementIds = pack.requirements.filter(r => ledger.requirements.find(x => x.id === r.id).status === 'passed').map(r => r.id);
    pack.remaining = pack.requirements.length - pack.acceptedRequirementIds.length;
}
progress.remainingS1 = progress.packagePlans.reduce((n, p) => n + p.remaining, 0);
progress.runtimeFixes = 1; progress.newOpenFindings = 0;
progress.checkpoints.push({ utc: spec.utc, package: 'S1.3-F001', fixedFindingIds: ['S1-F001'], acceptedDelta: 0, acceptedOverall: 9, remainingOverall: 307, evidence: 's14-fix-result.json', note: 'B2-03 remains partial; inactive variants not silently closed' });
progress.checkpoints.push({ utc: spec.utc, package: 'S1.2-errors', acceptedDelta: 2, acceptedOverall: progress.acceptedNow, remainingOverall: progress.remainingOverall, remainingS1: progress.remainingS1, acceptedIds: ['A4-02', 'A4-04'], evidence: 's14-error-result.json', blockers: ['successful retry after fault removal remains open'] });
progress.nextWork = ledger.nextBatch.objective;
progress.ordinaryAuthTransitions.push('10:25UTC owner logout for changed-home guest regression', '10:28UTC Google owner restored; business2 still current, no business selection');
process.stdout.write('*** Begin Patch\n' + emitPatch(ledgerPath, ledger) + emitPatch(progressPath, progress) + '*** End Patch\n');
