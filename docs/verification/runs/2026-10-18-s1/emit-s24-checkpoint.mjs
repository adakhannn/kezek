// Prints reviewable apply_patch only. No file writes, network, app or DB commands.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = 'C:/projects/kezek';
const run = 'docs/verification/runs/2026-10-18-s1';
const read = file => fs.readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(read(file));
const result = json(`${run}/s24-loading-result.json`);
const ledger = json('docs/WEB_VERIFICATION_LEDGER.json');
if (ledger.candidate.id !== 'dev-20261018-S1-8734fceeb50b') throw Error('Unexpected ledger base');
const paths = json(`${run}/s14-source-paths.json`);
for (const file of ['apps/web/src/app/loading.tsx', 'apps/web/src/__tests__/components/RouteLoading.test.tsx']) {
  if (paths.includes(file)) throw Error('Source already registered');
  paths.push(file);
}
// Match mechanical copy ordering:17 top-level selections, sorted recursively within each directory.
const selection = ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','apps/web/package.json','apps/web/pnpm-lock.yaml','apps/web/tsconfig.json','apps/web/next.config.ts','apps/web/postcss.config.mjs','apps/web/next-env.d.ts','apps/web/src','apps/web/public','packages/core-domain/package.json','packages/core-domain/tsconfig.json','packages/core-domain/src','packages/shared-client/package.json','packages/shared-client/tsconfig.json','packages/shared-client/src'];
const ordered = [];
function enumerate(file) {
  const stat = fs.lstatSync(path.join(root,file));
  if (stat.isDirectory()) for (const child of fs.readdirSync(path.join(root,file)).sort()) enumerate(file+'/'+child);
  else if (stat.isFile() && !stat.isSymbolicLink()) ordered.push(file);
  else throw Error('Unexpected source path');
}
for (const item of selection) enumerate(item);
if (ordered.length !== 1659 || new Set(ordered).size !== 1659) throw Error('Invalid source selection');
const fingerprint = sha(JSON.stringify(ordered.map(file => [file, sha(read(file))])));
if (fingerprint !== '0cc81561faf0c47d8dbd4b993204d9cfb40e5e2ac339473a21121310c479364e') throw Error('Source drift');
const pathsFile = `${run}/s24-source-paths.json`;
const pathsBytes = JSON.stringify(ordered, null, 2) + '\n';
const previous = structuredClone(ledger.candidate);
ledger.candidateHistory.push({ ...previous, currentCertification: false, supersededUtc: result.recordedUtc });
ledger.candidate = { ...previous, id: 'dev-20261018-S1-0cc81561faf0', sourceFingerprint: fingerprint,
  observedUtc: result.recordedUtc, fileCount: ordered.length,
  sourceBoundary: { pathsFile, sha256: sha(pathsBytes), fileCount: ordered.length },
  previousCandidate: { id: previous.id, sourceFingerprint: previous.sourceFingerprint },
  buildStatus: 'default_build_failed_external_fonts; instrumented functional result is not build/assets certification' };
for (const c of ledger.cases.filter(c => c.status === 'passed')) {
  for (const [file, hash] of Object.entries(c.dependencyHashes)) if (sha(read(file)) !== hash) throw Error(`Changed dependency ${c.id}: ${file}`);
  c.certificationHistory = [...(c.certificationHistory || []), { candidateId: c.candidateId, observedUtc: c.observedUtc, actual: c.actual, evidenceIds: c.evidenceIds }];
  c.candidateId = ledger.candidate.id;
  c.certificationReview = { utc: result.recordedUtc, fromCandidateId: previous.id,
    basis: 'Only loading.tsx and its unit test added; declared settled-content/auth/query/data dependencies byte-identical. Existing observation dates preserved, not represented as new live runs. Build/assets gates explicitly reopened.', evidenceId: 'S1-EV-38' };
  if (c.id === 'A3-01-S1-01' || c.id.startsWith('A3-02-S1-')) {
    c.status = 'stale';
    c.actual += ' S24: previous proof retained historically; new default-compiler build failed fetching Google fonts. Functional webpack/font-fixture build does NOT recertify this build/assets gate.';
    c.blockedBy = 'CURRENT_DEFAULT_BUILD_AND_ASSETS_PENDING';
  }
}
for (const id of ['A3-01', 'A3-02']) ledger.requirements.find(r => r.id === id).status = 'blocked';
const classification = ledger.cases.find(c => c.id === 'A2-04-S1-01');
Object.assign(classification, { status: 'blocked', method: 'live', candidateId: ledger.candidate.id,
  observedUtc: result.recordedUtc, actual: 'S22 classified captured origins/isolated failures but original transient primary-service request lacks response/timing evidence. No invented CORS/TLS diagnosis.', blockedBy: 'ORIGINAL_TRANSIENT_FAILED_REQUEST_NOT_CAPTURED', evidenceIds: ['S1-EV-36'] });
const loading = ledger.cases.find(c => c.id === 'B1-04-S13-1');
Object.assign(loading, { candidateId: ledger.candidate.id, observedUtc: result.liveThroughUtc,
  status: result.loadingLiveVerified ? 'passed' : 'blocked', method: 'live',
  actual: result.actual, expected: 'Observable localized route-waiting status while home data is pending, then correct settled catalogue without stale status',
  role: result.role, environment: result.environment, steps: result.steps, sideEffects: result.sideEffects,
  evidenceIds: ['S1-EV-37','S1-EV-38','S1-EV-39'],
  dependencyHashes: Object.fromEntries(['apps/web/src/app/loading.tsx','apps/web/src/app/layout.tsx','apps/web/src/app/page.tsx','apps/web/src/app/_components/i18n/LanguageProvider.tsx'].map(file => [file,sha(read(file))])) });
ledger.requirements.find(r => r.id === 'B1-04').status = result.loadingLiveVerified ? 'passed' : 'partial';
ledger.currentFindings.push({ id: 'S1-F002', status: result.loadingLiveVerified ? 'verified' : 'fixed_pending_verification',
  candidateId: previous.id, requirementIds: ['B1-04'], caseIds: ['B1-04-S13-1'],
  title: 'No explicit waiting indicator during delayed home transition', expected: loading.expected,
  actual: 'S23 actual10s pending home GET retained privacy with no loading signals; eventual catalogue correct. User explicitly approved localized indicator.',
  steps: ['Load privacy', 'Click visible home link during controlled10s public business-data delay', 'Read pending and settled UI'],
  evidenceIds: ['S1-EV-37'], method: 'live', observedUtc: '2026-10-18T11:58:23.714Z', sideEffects: result.sideEffects,
  fixApplied: true, retestCaseIds: ['B1-04-S13-1'], verifiedUtc: result.loadingLiveVerified ? result.liveThroughUtc : null,
  verifiedCandidateId: result.loadingLiveVerified ? ledger.candidate.id : null, fixEvidenceIds: ['S1-EV-38','S1-EV-39'] });
const evidenceFiles = [['S1-EV-36','s22-dev-network-classification.json'],['S1-EV-37','s23-loading-before.json'],['S1-EV-38','s24-loading-result.json'],['S1-EV-39','s24-tests-after.txt'],['S1-EV-40','s24-build-console.txt'],['S1-EV-41','s24-test-before.txt'],['S1-EV-42','s24-source-paths.json']];
for (const [id,name] of evidenceFiles) ledger.evidence.push({ id,path:`${run}/${name}`,sha256: name === 's24-source-paths.json' ? sha(pathsBytes) : sha(read(`${run}/${name}`)) });
ledger.updatedUtc = result.recordedUtc;
ledger.purpose = 'Evidence-backed WEB acceptance; historical import retained; S1 interactive live execution authorized until18:40Bishkek18Oct2026; no automation resume';
Object.assign(ledger.nextBatch, { status: 'S1_loading_checkpoint', objective: 'Complete safe S1 follow-up and finalize by12:40UTC; default build/assets, cold-cache/SSR/device, deployed checks and absent negative fixtures remain explicit blockers.' });
const progress = json(`${run}/progress.json`);
progress.candidate = ledger.candidate;
progress.acceptedNow = ledger.requirements.filter(r => r.status === 'passed').length;
progress.remainingOverall = 316 - progress.acceptedNow;
for (const pack of progress.packagePlans) {
  pack.acceptedRequirementIds = pack.requirements.filter(r => ledger.requirements.find(x => x.id === r.id).status === 'passed').map(r => r.id);
  pack.remaining = pack.requirements.length - pack.acceptedRequirementIds.length;
}
progress.remainingS1 = progress.packagePlans.reduce((n,p) => n+p.remaining,0);
progress.runtimeFixes = ledger.currentFindings.filter(f => f.status === 'verified').length;
progress.newOpenFindings = ledger.currentFindings.filter(f => f.status !== 'verified').length;
progress.activePackage = 'S1.3-loading';
progress.checkpoints.push({ utc: result.recordedUtc, package: 'S1.3-loading', evidence: 's24-loading-result.json',
  acceptedDelta: progress.acceptedNow - 15, acceptedOverall: progress.acceptedNow, remainingOverall: progress.remainingOverall, remainingS1: progress.remainingS1,
  newlyAccepted: result.loadingLiveVerified ? ['B1-04'] : [], reopenedOnNewSource: ['A3-01','A3-02'], note: 'Two prior candidate build/assets acceptances retained historically, not falsely promoted from font-fixture functional build.' });
progress.latestLiveCases = 'S19 DEV origins2PASS; S20 original SSR blocked by source-view policy; S21 inactive-service negative/active control PASS; S22 original failed request still blocked; S23/S24 loading before/after';
progress.nextWork = ledger.nextBatch.objective;
progress.handoff = result.handoff;
const state = json('docs/WEB_GLOBAL_READINESS_STATE.json');
Object.assign(state.progressAccounting, { currentCandidate: ledger.candidate.id, acceptedRequirements: progress.acceptedNow, remainingRequirements: progress.remainingOverall, acceptedS1: 25-progress.remainingS1, remainingS1: progress.remainingS1, latestCheckpointUtc: result.recordedUtc, latestCheckpointEvidence: `${run}/s24-loading-result.json`, releaseDecision: 'NOT_READY' });
function patch(file, value, added=false) {
  const text = typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n';
  if(added) return `*** Add File: ${root}/${file}\n` + text.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';
  const diff=spawnSync('git',['-c','core.safecrlf=false','diff','--no-index','--no-ext-diff','--unified=3','--',file,'-'],{cwd:root,input:text,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  if(diff.status!==1)throw Error(diff.stderr||'No expected diff');
  const lines=diff.stdout.split('\n'),start=lines.findIndex(l=>l.startsWith('@@'));
  return `*** Update File: ${root}/${file}\n`+lines.slice(start).filter(l=>!l.startsWith('\\ No newline')).map(l=>l.startsWith('@@')?'@@':l).join('\n').trimEnd()+'\n';
}
const only = process.argv[2];
const changes = [[pathsFile,pathsBytes,true],['docs/WEB_VERIFICATION_LEDGER.json',ledger,false],[`${run}/progress.json`,progress,false]];
process.stdout.write('*** Begin Patch\n'+changes.filter(([file])=>!only||file===only).map(args=>patch(...args)).join('')+'*** End Patch\n');
