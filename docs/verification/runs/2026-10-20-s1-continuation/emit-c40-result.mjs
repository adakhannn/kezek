import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {updateJson} from './json-evidence-patch.mjs';
import {summarize} from '../../../../scripts/web-verification-report.mjs';
import {closureSummary} from '../../../../scripts/web-closure-plan.mjs';
const run='docs/verification/runs/2026-10-20-s1-continuation',read=f=>fs.readFileSync(f),j=f=>JSON.parse(read(f)),sha=b=>createHash('sha256').update(b).digest('hex'),utc=process.argv[2];
if(!utc)throw Error('Actual UTC required');
const l=j('docs/WEB_VERIFICATION_LEDGER.json'),p=j(run+'/progress.json'),d=j(run+'/nonfinal-draft.json'),s=j('docs/WEB_GLOBAL_READINESS_STATE.json'),r=j(run+'/c40-result.json'),plan=j('docs/WEB_CLOSURE_PLAN.json');
if(l.candidate.id!==r.candidate||l.evidence.some(e=>e.id==='S1-EV-277'))throw Error('Wrong candidate/already applied');
const paths=j(l.candidate.sourceBoundary.pathsFile),fp=sha(JSON.stringify(paths.map(f=>[f,sha(read(f))])));
if(fp!==r.sourceFingerprint)throw Error('Source changed');
const changed='apps/web/src/app/auth/sign-in/useExistingSessionRedirect.ts';
for(const row of r.cases.filter(x=>x.status==='passed')){
 const c=l.cases.find(c=>c.id===row.id);if(c?.status!=='stale')throw Error('Wrong stale target');
 for(const [f,h] of Object.entries(c.dependencyHashes))if(f!==changed&&sha(read(f))!==h)throw Error('Unexpected dependency '+f);
 c.certificationHistory=[...(c.certificationHistory??[]),{candidateId:c.candidateId,status:c.status,observedUtc:c.observedUtc,actual:c.actual,evidenceIds:c.evidenceIds,dependencyHashes:c.dependencyHashes,staleReason:c.staleReason}];
 c.status='passed';c.candidateId=r.candidate;c.observedUtc=row.observationWindowUtc[1];c.observationWindowUtc=row.observationWindowUtc;c.actual=row.actual;c.steps=row.steps;c.sideEffects=r.effects;c.dependencyHashes={...c.dependencyHashes,[changed]:sha(read(changed))};c.evidenceIds=[...c.evidenceIds,'S1-EV-277','S1-EV-278'];c.currentCandidateReviewEvidenceId='S1-EV-278';delete c.staleSinceCandidate;delete c.staleReason;
}
for(const id of ['A1-03','A1-04','A1-05']){const q=l.requirements.find(q=>q.id===id);if(!q.caseIds.every(id=>l.cases.find(c=>c.id===id)?.status==='passed'))throw Error('Incomplete parent '+id);q.status='passed';q.currentAcceptanceNote='C40 targeted owner regression passed after C39; other original observations/dependencies retained at original dates. Actual selector reload, no no-flash/visual/cold-cache claim.';}
l.requirements.find(q=>q.id==='A1-01').currentAcceptanceNote='C40 two related owner regressions passed; S12-cold-2 remains stale pending current human Disable-cache/DevTools-open condition, not executed/credited.';
l.evidence.push(...[[277,'c40-owner-regression-plan.json'],[278,'c40-result.json']].map(([n,f])=>({id:'S1-EV-'+n,path:run+'/'+f,sha256:sha(read(run+'/'+f))})));
l.updatedUtc=utc;l.nextBatch.objective=r.next;
const sum=summarize(l,read),closure=closureSummary(plan,l,sum);if(!sum.valid||!closure.valid)throw Error(JSON.stringify([sum.errors,closure.errors]));
const s1ids=new Set(plan.phases[0].requirementIds),cases=l.cases.filter(c=>c.requirementIds.some(id=>s1ids.has(id))&&!['S14-F001-empty','S14-F001-positive'].includes(c.id)),passed=cases.filter(c=>c.status==='passed').length;
if(cases.length!==79||passed!==61||closure.phases[0].actualAccepted!==16||closure.actualAccepted!==17)throw Error('Unexpected counts '+JSON.stringify({total:cases.length,passed,phase:closure.phases[0].actualAccepted,product:closure.actualAccepted}));
Object.assign(p,{acceptedS1:16,remainingS1:9,passedCases:61,remainingCases:18,activeSubpackage:'C40owner2regressionsPASS1coldSTALE',casePlan:'c40-owner-regression-plan.json',lastCheckpoint:r.next,checkpointAfterClockUtc:utc});p.packageCounts.find(x=>x.id==='S1.2').accepted=7;p.browser.actualRole='C40 ordinaryGoogle restored knownSAkezekkg/Admin-panel/Anonymized, originaluser2root/5admin';p.S1CaseScope='Primary79 S1 cases: excludes BOTH passed supplemental S14-F001-empty/positive. C40 corrected prior checkpoint +1 overcount; raw ledger evidence preserved.';
Object.assign(s.progressAccounting,{acceptedRequirements:17,remainingRequirements:299,acceptedS1:16,remainingS1:9,latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c40-result.json'});
Object.assign(d,{draftRefreshedUtc:utc,acceptedS1:16,remainingS1:9,passedCases:61,remainingCases:18,productAccepted:17,productRemaining:299,latestCompleted:'C40 two dependency owner regressions PASS;3 parentrequirements restored; cold-cache owner case remainsSTALE pending current condition. No new fix/source change.',acceptanceCorrection:'C39 had made3 owner cases stale; C40 restores2 via actual UI. 3parents restored13->16 S1/14->17 product; cold parent remainspartial. Primary case checkpoint had+1overcount: both supplemental casesPASS excluded,59before+2=61/79,18remaining; history preserved.'});d.packageCounts['S1.2']='7/9';d.completed.push(d.latestCompleted);d.currentActualBrowser={tab:'5',role:'knownSAkezekkg',path:'/admin',state:'ordinaryGoogle restored afterC40',secondaryTab:'2root samecookie'};
d.notCompleted=d.notCompleted.map(x=>x.includes('F007ratingsactionrenderer open')?'Current candidate unbuilt/assetsunexecuted; priorC15FontsFAIL retained and permissionexpired. F007 render-only fixedC27, recalculation not executed.':x);
process.stdout.write('*** Begin Patch\n'+updateJson('docs/WEB_VERIFICATION_LEDGER.json',l,3,true)+updateJson(run+'/progress.json',p,3,true)+updateJson('docs/WEB_GLOBAL_READINESS_STATE.json',s,3,true)+updateJson(run+'/nonfinal-draft.json',d,3,true)+'*** End Patch\n');
