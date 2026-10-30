// Read-only exact candidate/evidence updater. Emit parts with one fixed clock; compare expected JSON hash after apply.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {updateJson} from './json-evidence-patch.mjs';
const run='docs/verification/runs/2026-10-20-s1-continuation',read=f=>fs.readFileSync(f),json=f=>JSON.parse(read(f)),sha=b=>createHash('sha256').update(b).digest('hex');
const [specFile,part,utc]=process.argv.slice(2);if(!specFile||!part||!utc)throw Error('spec/part/fixed actualUTC required');
const spec=json(run+'/'+specFile),l=json('docs/WEB_VERIFICATION_LEDGER.json'),from=structuredClone(l.candidate),r=json(run+'/'+spec.resultFile),original=json(run+'/'+spec.originalFile);
if(from.id!==spec.fromCandidate||l.evidence.some(e=>e.id===spec.reviewEvidenceId))throw Error('Unexpected candidate/alreadyapplied');
const paths=json(from.sourceBoundary.pathsFile);
const preserved=l.cases.filter(c=>c.status==='passed'&&!(spec.retestPreviouslyPassedTarget&&c.id===spec.caseId));
if(spec.retestPreviouslyPassedTarget&&!l.cases.some(c=>c.id===spec.caseId&&c.status==='passed'))throw Error('Expected previously passed retest target');
if(sha(JSON.stringify(paths.map(f=>[f,sha(original[f]??read(f))])))!==from.sourceFingerprint)throw Error('Unexpected source delta outside exact saved boundaries');
const nextPaths=[...paths,...spec.newPaths],fp=sha(JSON.stringify(nextPaths.map(f=>[f,sha(read(f))]))),id='dev-20261020-S1-'+fp.slice(0,12),pathsFile=run+'/'+spec.id.toLowerCase()+'-source-paths.json',reviewFile=run+'/'+spec.id.toLowerCase()+'-candidate-review.json';
const review={utc,fromCandidateId:from.id,candidateId:id,sourceFingerprint:fp,fileCount:nextPaths.length,oldFingerprintReconstructed:true,changedExistingFiles:Object.keys(original),newPaths:spec.newPaths,originalBoundaryEvidence:run+'/'+spec.originalFile,preservedCaseIds:preserved.map(c=>c.id),retestedCaseIds:spec.retestPreviouslyPassedTarget?[spec.caseId]:[],basis:spec.reviewBasis,build:'Current newcandidate unbuilt/assetsstale; priorC15genuineFontsconnectionFAILretained, originalfontapprovalexpired/no retry.'};
for(const c of preserved){for(const[f,h]of Object.entries(c.dependencyHashes||{}))if(sha(read(f))!==h)throw Error('Changed passed dependency '+c.id+' '+f);c.candidateId=id;c.currentCandidateReviewEvidenceId=spec.reviewEvidenceId;}
l.candidateHistory.push({...from,currentCertification:false,supersededUtc:utc});
l.candidate={...from,id,sourceFingerprint:fp,fileCount:nextPaths.length,observedUtc:utc,previousCandidate:{id:from.id,sourceFingerprint:from.sourceFingerprint},sourceBoundary:{pathsFile,sha256:sha(JSON.stringify(nextPaths,null,2)+'\n'),fileCount:nextPaths.length},buildStatus:'UNEXECUTED_'+spec.id+'; priorC15FontsFAILunresolved/permissionexpired/no assetsPASS',certificationReviewEvidenceId:spec.reviewEvidenceId};
for(const k of ['A3-01-S1-01','A3-02-S1-01','A3-02-S1-02','A3-02-S1-03','A3-02-S1-04']){const c=l.cases.find(c=>c.id===k);c.status='stale';c.staleSinceCandidate=id;c.staleReason=spec.id+' newruntimecandidate unbuilt; priorC15genuineFontsFAILretained, assetsunexecuted.';}
const c=l.cases.find(c=>c.id===spec.caseId);if(!c)throw Error('Missingtargetcase');
if(spec.retestPreviouslyPassedTarget){c.priorObservations=[...(c.priorObservations??[]),{candidateId:c.candidateId,observedUtc:c.observedUtc,actual:c.actual,evidenceIds:c.evidenceIds,dependencyHashes:c.dependencyHashes}];}
Object.assign(c,{status:'passed',candidateId:id,observedUtc:spec.observationUpperUtc,method:'live',actual:r.sameLive+' Observation time boundary: '+JSON.stringify(r.observationTimeBoundary??r.observationWindowUtc),dependencyHashes:Object.fromEntries(spec.dependencies.map(f=>[f,sha(read(f))])),evidenceIds:[...c.evidenceIds,...spec.caseEvidenceIds],currentCandidateReviewEvidenceId:spec.reviewEvidenceId});
const existing=l.currentFindings.find(f=>f.id===spec.finding.id);
if(spec.updateExistingFinding){
  if(!existing||existing.status!=='open'||!existing.caseIds.includes(c.id))throw Error('Expected existing open finding for exact target');
  Object.assign(existing,{verifiedCandidateId:id,verifiedUtc:utc,status:'verified',fixApplied:true,retestCaseIds:[c.id],fixEvidenceIds:spec.finding.fixEvidenceIds,verificationActual:r.sameLive,sideEffects:r.effects});
}else{
  if(existing)throw Error('Duplicate finding');
  l.currentFindings.push({...spec.finding,candidateId:from.id,verifiedCandidateId:id,verifiedUtc:utc,status:'verified',fixApplied:true,actual:r.before,method:'live',retestCaseIds:[c.id],sideEffects:r.effects});
}
l.evidence.push(...spec.evidence.map(([n,f])=>({id:'S1-EV-'+n,path:run+'/'+f,sha256:sha(read(run+'/'+f))})),{id:spec.reviewEvidenceId,path:reviewFile,sha256:sha(JSON.stringify(review,null,2)+'\n')});l.updatedUtc=utc;l.nextBatch.objective=r.next;
const p=json(run+'/progress.json');Object.assign(p,{candidate:id,newLiveFixes:spec.newFixCount,newDistinctFixIds:spec.verifiedFixIds,activeSubpackage:spec.id+' '+spec.label+' SAME-LIVE verified',casePlan:spec.planFile,lastCheckpoint:r.next,checkpointAfterClockUtc:utc});p.S2.definedCurrentMatrix={id:'C13',...r.matrixAfter};p.browser.page=spec.page;p.browser.actualRole=spec.id+' actual knownSA Admin-panel/Anonymized; '+spec.browserState;
if(r.observationTimeBoundary)p.lastTimeGap=r.observationTimeBoundary;
const s=json('docs/WEB_GLOBAL_READINESS_STATE.json');Object.assign(s.progressAccounting,{currentCandidate:id,latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/'+spec.resultFile});
const d=json(run+'/nonfinal-draft.json');d.draftRefreshedUtc=utc;d.currentCandidate=id;d.newLiveFixes=spec.newFixCount;d.completed.push(spec.completion);d.currentActualBrowser={tab:'5',role:'knownSAkezekkg',path:spec.page,state:spec.browserState,capture:'no screenshotretry'};d.remainingNav=r.matrixAfter;
if(r.observationTimeBoundary)d.latestTimeGap=r.observationTimeBoundary;
const add=(f,v)=>'*** Add File: '+f+'\n'+JSON.stringify(v,null,2).split('\n').map(x=>'+'+x).join('\n')+'\n';
if(part==='expected'){console.log(sha(JSON.stringify(l)));process.exit(0);}
const patch=part==='ledger'?updateJson('docs/WEB_VERIFICATION_LEDGER.json',l,3,true):add(pathsFile,nextPaths)+add(reviewFile,review)+updateJson(run+'/progress.json',p,3,true)+updateJson('docs/WEB_GLOBAL_READINESS_STATE.json',s,3,true)+updateJson(run+'/nonfinal-draft.json',d,3,true);
process.stdout.write('*** Begin Patch\n'+patch+'*** End Patch\n');
