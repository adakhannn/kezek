// C06 current-candidate transition and pending live finding; emits patch only.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root='C:/projects/kezek',run='docs/verification/runs/2026-10-20-s1-continuation';
const read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ledger=JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json')),from=structuredClone(ledger.candidate);
if(from.id!=='dev-20261020-S1-ed0bdd7faf24')throw Error('Unexpected candidate');
const boundary='apps/web/src/components/ErrorBoundary.tsx',pure='apps/web/src/lib/chunkLoadRecovery.ts',test='apps/web/src/__tests__/components/ErrorBoundaryChunkRecovery.test.tsx';
const prior=read(boundary).toString().replace(/import \{ isRecoverableChunkError \} from '@\/lib\/chunkLoadRecovery';\r?\n/,'').replace(/        if \(isRecoverableChunkError\(this.state.error\)\) \{\r?\n            window.location.reload\(\);\r?\n            return;\r?\n        \}\r?\n/,'');
if(sha(prior)!=='735770cb992eab03565249e3f308a2feb3f6c5b4e2abba4b2f0ed8d93c6f0be3')throw Error('Boundary reverse delta mismatch');
const oldPaths=JSON.parse(read(from.sourceBoundary.pathsFile));
if(sha(JSON.stringify(oldPaths.map(file=>[file,sha(file===boundary?prior:read(file))])))!==from.sourceFingerprint)throw Error('Unexpected other source delta');
const paths=[...oldPaths,pure,test],fingerprint=sha(JSON.stringify(paths.map(file=>[file,sha(read(file))]))),candidateId='dev-20261020-S1-'+fingerprint.slice(0,12),utc='2026-10-20T09:26:24Z';
const pathsFile=run+'/c06-source-paths.json',reviewFile=run+'/c06-candidate-review.json';
const staleIds=['A3-01-S1-01','A3-02-S1-01','A3-02-S1-02','A3-02-S1-03','A3-02-S1-04'];
const review={utc,fromCandidateId:from.id,candidateId,sourceFingerprint:fingerprint,oldFingerprintReconstructed:true,priorBoundarySha:sha(prior),changedRuntimeFiles:[boundary,pure],newTestFile:test,fileCount:paths.length,reopenedCases:staleIds,preservedCaseIds:ledger.cases.filter(c=>c.status==='passed'&&!staleIds.includes(c.id)).map(c=>c.id),preservationBasis:'Exact old1660-file fingerprint reconstructed by reversing ONLY one import and user retry guard; added pure helper/test. No normal render, routing rethrow, monitoring, custom fallback, generic in-place reset, auth, data, commands or CSS change. Declared dependency hashes otherwise unchanged. New tests cover ordinary reset and existing framework-signal/fallback/monitoring controls. Historical observed dates preserved; not fresh live replay of every route.',dependencyMapLimit:'Prior case maps did not list shared ErrorBoundary. This semantic/path review is explicit, not a claim of complete transitive runtime mapping. Build and assets ALWAYS reopened for current output.',sameLive:'C06 real missing-chunk retry failure must pass on fresh current candidate before F004 closes.'};
ledger.candidateHistory.push({...from,currentCertification:false,supersededUtc:utc});
ledger.candidate={...from,id:candidateId,sourceFingerprint:fingerprint,fileCount:paths.length,observedUtc:utc,previousCandidate:{id:from.id,sourceFingerprint:from.sourceFingerprint},sourceBoundary:{pathsFile,sha256:sha(JSON.stringify(paths,null,2)+'\n'),fileCount:paths.length},buildStatus:'STALE_after_F004_chunk_retry_fix; fresh default build/assets and SAME-LIVE pending',certificationReviewEvidenceId:'S1-EV-118'};
for(const c of ledger.cases.filter(c=>c.status==='passed')){if(staleIds.includes(c.id)){c.status='stale';c.staleReason='C06 runtime retry changed; prior output retained, not current build/assets';c.staleSinceCandidate=candidateId;}else{c.candidateId=candidateId;c.currentCandidateReviewEvidenceId='S1-EV-118';}}
for(const id of ['A3-01','A3-02'])ledger.requirements.find(r=>r.id===id).status='partial';
ledger.requirements.find(r=>r.id==='A3-04').status='failed';
const c=ledger.cases.find(c=>c.id==='A3-04-S1-02');
Object.assign(c,{status:'failed',candidateId:from.id,observedUtc:'2026-10-20T09:22:05Z',method:'live',role:'guest on real isolated local production output',environment:'C06 fresh s1chunk-20261020-ed0bdd.localhost:3104; dummy backend; no deployed-domain acceptance',actual:'Real unavailable auth JS chunk produces error. Exact bytes restored09:21:33, UI retry09:21:37 repeats cached rejected load; ordinary browser reload recovers. F004 fixed in source but SAME-LIVE pending.',expected:'Visible user retry recovers after missing chunk bytes are restored, without separate browser-refresh knowledge',steps:JSON.parse(read(run+'/c06-before.json')).steps,sideEffects:'One self-generated isolated JS recoverable rename+verified restoration; own tab closed and own server22768 stopped. No primary source/data/auth/booking mutations during repro. Ordinary telemetry unenumerated.',evidenceIds:['S1-EV-119','S1-EV-123','S1-EV-124','S1-EV-125','S1-EV-126'],dependencyHashes:{[boundary]:sha(Buffer.from(prior))}});
const evidenceFiles=[[119,'c06-before.json'],[120,'c06-checks.json'],[121,'c06-unit-before.txt'],[122,'c06-unit-after.txt'],[123,'c06-lease-raw.txt'],[124,'c06-server-raw.txt'],[125,'c06-chunk-error.jpg'],[126,'c06-reload-control.jpg']];
ledger.evidence.push({id:'S1-EV-118',path:reviewFile,sha256:sha(JSON.stringify(review,null,2)+'\n')},...evidenceFiles.map(([n,file])=>({id:'S1-EV-'+n,path:run+'/'+file,sha256:sha(read(run+'/'+file))})));
ledger.currentFindings.push({id:'S1-F004',status:'fixed_pending_verification',candidateId:from.id,requirementIds:['A3-04'],caseIds:['A3-04-S1-02'],title:'Retry cannot recover after restored Next chunk due cached rejected load',expected:c.expected,actual:c.actual,steps:c.steps,method:'live',observedUtc:c.observedUtc,fixApplied:true,evidenceIds:['S1-EV-119','S1-EV-125','S1-EV-126'],fixEvidenceIds:['S1-EV-120','S1-EV-121','S1-EV-122'],retestCaseIds:['A3-04-S1-02'],sideEffects:c.sideEffects});
ledger.updatedUtc=utc;ledger.nextBatch.objective='C06 F004 real retry failure source fix+17unitPASS/coveragePASS/types0/lint0; SAME-LIVE pending new candidate. Fresh build/assets then exact recovery. Human now confirmed Ctrl0; recheck visual afterward. Domain last.';
const progress=JSON.parse(read(run+'/progress.json'));
Object.assign(progress,{status:'ACTIVE_C06_F004_FIXED_PENDING_SAME_LIVE',candidate:candidateId,acceptedS1:16,remainingS1:9,passedCases:54,remainingCases:25,activeSubpackage:'C06 F004 fresh candidate build and exact live retest',checkpointAfterClockUtc:utc,newLiveFixes:1,pendingLiveFix:'S1-F004',pendingUserHelp:null,userZoomAnswer:'Human confirmed reset100%; fresh actual viewport/image verification deferred until current C06 chain completes',lastCheckpoint:'C06 real UI failure confirmed then minimal Next-chunk-only user-triggered reload fix. Before11cases7PASS4FAIL; after2s17PASS/coverage100,75,100,100/types0/scopedlint0. New runtime candidate reopens2build/asset requirements5cases. Prior current18/25 historical checkpoint retained; now16/25 and54/79 until new build proof. SAME-LIVE not done.',packageCounts:[{id:'S1.1',accepted:1,total:8},{id:'S1.2',accepted:7,total:9},{id:'S1.3',accepted:8,total:8}]});
const state=JSON.parse(read('docs/WEB_GLOBAL_READINESS_STATE.json'));
Object.assign(state.progressAccounting,{currentCandidate:candidateId,acceptedRequirements:16,remainingRequirements:300,acceptedS1:16,remainingS1:9,latestCheckpointUtc:utc,latestCheckpointEvidence:reviewFile});
const ts=createRequire(path.join(root,'apps/web/package.json'))('typescript');
function update(file,value){
  const original=read(file).toString(),before=JSON.parse(original),tree=ts.parseJsonText(file,original),edits=[];
  function visit(node,oldValue,newValue){
    if(JSON.stringify(oldValue)===JSON.stringify(newValue))return;
    if(ts.isObjectLiteralExpression(node)&&Object.keys(oldValue).join('|')===Object.keys(newValue).join('|')){for(const p of node.properties)visit(p.initializer,oldValue[p.name.text],newValue[p.name.text]);}
    else if(ts.isArrayLiteralExpression(node)&&Array.isArray(newValue)&&oldValue.length===newValue.length){node.elements.forEach((p,i)=>visit(p,oldValue[i],newValue[i]));}
    else{const start=node.getStart(tree),line=original.lastIndexOf('\n',start-1)+1,indent=original.slice(line,start).match(/^\s*/)[0].length;edits.push({start,end:node.end,text:JSON.stringify(newValue,null,2).replace(/\n/g,'\n'+' '.repeat(indent))});}
  }
  visit(tree.statements[0].expression,before,value);let after=original;
  for(const e of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,e.start)+e.text+after.slice(e.end);
  if(JSON.stringify(JSON.parse(after))!==JSON.stringify(value))throw Error('Patch model mismatch');
  const r=spawnSync('git',['-c','core.safecrlf=false','diff','--no-index','--no-ext-diff','--unified=3','--',file,'-'],{cwd:root,input:after,encoding:'utf8',windowsHide:true,maxBuffer:12e6});
  if(r.status!==1)throw Error(r.stderr||'No patch');
  const lines=r.stdout.split('\n');return '*** Update File: '+root+'/'+file+'\n'+lines.slice(lines.findIndex(l=>l.startsWith('@@'))).filter(l=>!l.startsWith('\\ No newline')).map(l=>l.startsWith('@@')?'@@':l).join('\n').trimEnd()+'\n';
}
function add(file,value){return '*** Add File: '+root+'/'+file+'\n'+(JSON.stringify(value,null,2)+'\n').trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';}
process.stdout.write('*** Begin Patch\n'+add(pathsFile,paths)+add(reviewFile,review)+update('docs/WEB_VERIFICATION_LEDGER.json',ledger)+update(run+'/progress.json',progress)+update('docs/WEB_GLOBAL_READINESS_STATE.json',state)+'*** End Patch\n');
