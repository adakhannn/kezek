// One-shot accounting patch emitter. No file writes, app requests or database access.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const root='C:/projects/kezek';
const run='docs/verification/runs/2026-10-20-s1-continuation';
const ledgerPath='docs/WEB_VERIFICATION_LEDGER.json';
const read=file=>fs.readFileSync(path.join(root,file));
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const ledger=JSON.parse(read(ledgerPath));
const from=structuredClone(ledger.candidate);
if(from.id!=='dev-20261018-S1-0cc81561faf0')throw Error('Unexpected candidate; review before applying');
const oldPaths=JSON.parse(read(from.sourceBoundary.pathsFile));
const view='apps/web/src/app/b/[slug]/view.tsx';
const hook='apps/web/src/app/b/[slug]/hooks/useBookingSteps.ts';
const test='apps/web/src/__tests__/components/BookingBranchStepBoundary.test.tsx';
const priorView=read(view).toString().split(/(?<=\n)/).filter(line=>!line.includes('initialBranchValid:')).join('');
const priorHook=read(hook).toString()
    .replace(/    initialBranchValid\?: boolean;\r?\n/,'')
    .replace(', initialBranchValid = true','')
    .replace(/    const \[step, setStep\] = useState<BookingStep>\(initialBranchValid\r?\n        \? Math.min\(5, Math.max\(1, initialStep \?\? 1\)\) as BookingStep : 1\);/,
        '    const [step, setStep] = useState<BookingStep>((Math.min(5, Math.max(1, initialStep ?? 1)) as BookingStep));')
    .replace(/        if \(!branchId\) return false;\r?\n/,'');
const oldBytes=file=>file===view?priorView:file===hook?priorHook:read(file);
if(sha(JSON.stringify(oldPaths.map(file=>[file,sha(oldBytes(file))])))!==from.sourceFingerprint)throw Error('Other source changed or reverse delta not exact');
if(oldPaths.includes(test))throw Error('New test unexpectedly in old boundary');
const sourcePaths=[...oldPaths,test];
const fingerprint=sha(JSON.stringify(sourcePaths.map(file=>[file,sha(read(file))])));
const candidateId=`dev-20261020-S1-${fingerprint.slice(0,12)}`;
const utc='2026-10-20T08:34:48Z';
const pathsFile=`${run}/c01-source-paths.json`;
const reviewPath=`${run}/c01-candidate-review.json`;
const changedDependencies=ledger.cases.filter(c=>c.status==='passed'&&Object.entries(c.dependencyHashes||{}).some(([file,hash])=>sha(read(file))!==hash)).map(c=>c.id);
if(JSON.stringify(changedDependencies)!==JSON.stringify(['B2-03-S13-1']))throw Error('Unreviewed changed acceptance dependency');
const buildStale=['A3-01-S1-01','A3-02-S1-01','A3-02-S1-02','A3-02-S1-03','A3-02-S1-04'];
const review={utc,fromCandidateId:from.id,candidateId,sourceFingerprint:fingerprint,changedRuntimeFiles:[view,hook],newTestFile:test,
    exactOldFingerprintReconstructed:true,originalFingerprint:from.sourceFingerprint,oldFileCount:oldPaths.length,newFileCount:sourcePaths.length,
    changedDependencyCaseIds:changedDependencies,freshLiveRefreshCaseIds:['B2-03-S13-1','B2-03-S13-2','B2-03-S13-3'],
    reopenedBuildAndAssetCases:buildStale,
    preservedCaseIds:ledger.cases.filter(c=>c.status==='passed'&&!buildStale.includes(c.id)&&c.id!=='B2-03-S13-1').map(c=>c.id),
    preservationBasis:'All declared dependencies byte-identical except one hidden-service case freshly checked. Original observation dates retained. New fixture data requires new catalog exact-count oracle, not replay of all unchanged public-content contracts. Build/assets are NOT promoted from old output.',
    lintBaseline:'Exact prior view reconstructed by removing only one new prop; SHA68a4e2b87f852fa5bb0cea59982d5ef947c8f52104a3c25e1094be8122214bdb; same line238 immutability ESLintFAIL. No suppression or unrelated auth change.',
    buildStatus:'STALE_after_runtime_fix; new default build and local assets proof required'};
ledger.candidateHistory.push({...from,currentCertification:false,supersededUtc:utc});
ledger.candidate={...from,id:candidateId,sourceFingerprint:fingerprint,observedUtc:utc,fileCount:sourcePaths.length,
    sourceBoundary:{pathsFile,sha256:sha(json(sourcePaths)),fileCount:sourcePaths.length},
    previousCandidate:{id:from.id,sourceFingerprint:from.sourceFingerprint},buildStatus:review.buildStatus,certificationReviewEvidenceId:'S1-EV-74'};
for(const c of ledger.cases.filter(c=>c.status==='passed')){
    if(buildStale.includes(c.id)){c.status='stale';c.staleReason='Runtime candidate changed; old build/output retained as historical, not current build or asset PASS';c.staleSinceCandidate=candidateId;continue;}
    if(c.id==='B2-03-S13-1'){
        c.certificationHistory=[...(c.certificationHistory||[]),{candidateId:c.candidateId,observedUtc:c.observedUtc,actual:c.actual,evidenceIds:[...c.evidenceIds]}];
        c.observedUtc=utc;c.actual+=' Fresh20Oct changed-dependency retest: validbranch1/staff1bfd/26Octstep4 rejects hiddene215, active515selected1/60min100–300/Nextenabled. No Next/time/slot action.';
        c.evidenceIds=[...new Set([...c.evidenceIds,'S1-EV-75'])];
        c.dependencyHashes[view]=sha(read(view));c.dependencyHashes[hook]=sha(read(hook));
    }
    c.candidateId=candidateId;c.currentCandidateReviewEvidenceId='S1-EV-74';
}
const deps=Object.fromEntries([view,hook,'apps/web/src/app/b/[slug]/booking/page.tsx','apps/web/src/app/b/[slug]/page.tsx','apps/web/src/app/b/[slug]/hooks/useBookingSelectionState.ts'].map(file=>[file,sha(read(file))]));
for(const id of ['B2-03-S13-2','B2-03-S13-3']){
    const c=ledger.cases.find(c=>c.id===id);
    c.previousCertification=structuredClone(c);
    Object.assign(c,{status:'passed',candidateId,observedUtc:utc,method:'live',role:'existing superadmin and ordinary guest',environment:'DEV localhost:3000 RU functional; not device/production/API-RLS acceptance',
        expected:id.endsWith('-2')?'Inactive branch absent from public card/selector; stale ID cannot skip branch selection; active control selectable':'Unapproved business absent catalog and unavailable via public detail/booking even with real active child ID',
        actual:id.endsWith('-2')?'Admininactivefa5f andactive0574 confirmed. PublicAonlyactive1; staleinactive&step2 afterfix=>step1/branchunselected/Nextdisabled foradmin+guest. ActiveURLretainsstep2; guest canselectactiveandNext. No time/create.':'AdminBmoderationwithactivee1childconfirmed. Catalog3approved excludesB. Bothadminpublic+guest publicdetail andbookingwithactivechild=>Бизнес не найден/noform; not networkfailure.',
        steps:id.endsWith('-2')?['Confirm adminbranch oracle','Inspect public detail and booking selector','Reproduce stalebranch&step2 beforefix','Repeat same URL afterfix admin+guest','Compare activebranch directstep2 and guest selection->Next','Restore admin session/list']:['Confirm adminhiddenbusiness and activechild','Inspect publiccatalog authenticated+guest','Open hidden publicdetail','Open directbookingwithrealactivechild','Compare approvedA and restoreadmin'],
        sideEffects:'Read-only public/selector transitions, ordinarylogout/Googlekezekkgrestore/authtelemetry unenumerated. No business/branch/staff/service/booking/hold/pay/delete/grant command. All fixtures retained.',
        dependencyHashes:deps,evidenceIds:['S1-EV-74','S1-EV-75','S1-EV-76','S1-EV-77'],currentCandidateReviewEvidenceId:'S1-EV-74'});
}
ledger.requirements.find(r=>r.id==='B2-03').status='passed';
for(const id of ['A3-01','A3-02'])ledger.requirements.find(r=>r.id===id).status='partial';
ledger.currentFindings.push({id:'S1-F003',status:'verified',candidateId:from.id,verifiedCandidateId:candidateId,requirementIds:['B2-03'],caseIds:['B2-03-S13-2'],title:'Stale inactive branch URL skips required branch step',expected:'Reject stalebranchrequestedstep; require branch before Next',actual:'step2andNextstep3 reachable withsummaryBranchNotSelected',steps:['Known inactivebranch URL withstep2','Waitsettled','ClickNext once'],method:'live',observedUtc:'2026-10-20T08:21:50Z',verifiedUtc:utc,fixApplied:true,evidenceIds:['S1-EV-76'],fixEvidenceIds:['S1-EV-75','S1-EV-78','S1-EV-79'],retestCaseIds:['B2-03-S13-2'],sideEffects:'No booking mutation; normal auth/telemetry unenumerated'});
const evidenceFiles=[[75,'c01-result.json'],[76,'c01-stale-branch-before.json'],[77,'c01-hidden-business-observation.json'],[78,'c01-unit-before.txt'],[79,'c01-unit-after.txt'],[80,'c01-typecheck.txt'],[81,'c01-lint.txt'],[82,'c01-coverage-first-result.json'],[83,'c01-fixed-guest.jpg']];
ledger.evidence.push({id:'S1-EV-74',path:reviewPath,sha256:sha(json(review))});
for(const [n,file] of evidenceFiles)ledger.evidence.push({id:`S1-EV-${n}`,path:`${run}/${file}`,sha256:sha(read(`${run}/${file}`))});
ledger.updatedUtc=utc;
Object.assign(ledger.nextBatch,{status:'S1_continuation_active',objective:'Defaultbuild and localassets revalidation afterS1F003; deletedslug pending exacttarget action-time confirmation; domainlast',run:`${run}/progress.json`,authorization:'20Oct2026 user: отлично дальше продолжай до18:30',deadlineUtc:'2026-10-20T12:30:00Z',automationResumeAuthorized:true});
const progressPath=`${run}/progress.json`;
const progress=JSON.parse(read(progressPath));
const oldRun=JSON.parse(read('docs/verification/runs/2026-10-18-s1/progress.json'));
const s1Ids=new Set(oldRun.packagePlans.flatMap(p=>p.requirements.map(r=>r.id)));
const activeCases=new Set(ledger.requirements.filter(r=>s1Ids.has(r.id)).flatMap(r=>r.caseIds));
Object.assign(progress,{candidate:candidateId,checkpointAfterClockUtc:utc,activeSubpackage:'S1.1 freshbuild-and-assets',acceptedS1:ledger.requirements.filter(r=>s1Ids.has(r.id)&&r.status==='passed').length,passedCases:ledger.cases.filter(c=>activeCases.has(c.id)&&c.status==='passed').length,totalCases:activeCases.size,newLiveFixes:1,lastCheckpoint:'c01 finite inactive cases PASS; +1requirement,2build/assetrequirementsreopened; counts verified fromledger afterpatch'});
progress.remainingS1=25-progress.acceptedS1;progress.remainingCases=activeCases.size-progress.passedCases;
progress.packageCounts=oldRun.packagePlans.map(p=>({id:p.id,accepted:p.requirements.filter(r=>ledger.requirements.find(x=>x.id===r.id).status==='passed').length,total:p.requirements.length}));
const statePath='docs/WEB_GLOBAL_READINESS_STATE.json';
const state=JSON.parse(read(statePath));
Object.assign(state.progressAccounting,{currentInteractiveRun:progressPath,currentInteractiveStatus:'active_until20Oct18:30Bishkek',currentCandidate:candidateId,acceptedRequirements:ledger.requirements.filter(r=>r.status==='passed').length,remainingRequirements:316-ledger.requirements.filter(r=>r.status==='passed').length,acceptedS1:progress.acceptedS1,remainingS1:progress.remainingS1,latestCheckpointUtc:utc,latestCheckpointEvidence:`${run}/c01-result.json`,priorInteractiveFinal:{report:state.progressAccounting.currentInteractiveFinalReport,verification:state.progressAccounting.currentInteractiveFinalVerification,finalizedUtc:state.progressAccounting.currentInteractiveFinalizedUtc},autonomousResumeAllowed:true,currentDeadlineUtc:'2026-10-20T12:30:00Z'});
delete state.progressAccounting.currentInteractiveFinalReport;delete state.progressAccounting.currentInteractiveFinalVerification;delete state.progressAccounting.currentInteractiveFinalizedUtc;
const ts=createRequire(path.join(root,'apps/web/package.json'))('typescript');
function update(file,value){
    const original=read(file).toString(), before=JSON.parse(original);
    const tree=ts.parseJsonText(file,original), edits=[];
    function visit(node,oldValue,newValue){
        if(JSON.stringify(oldValue)===JSON.stringify(newValue))return;
        if(ts.isObjectLiteralExpression(node)&&Object.keys(oldValue).join('|')===Object.keys(newValue).join('|')){
            for(const prop of node.properties)visit(prop.initializer,oldValue[prop.name.text],newValue[prop.name.text]);
        }else if(ts.isArrayLiteralExpression(node)&&Array.isArray(newValue)&&oldValue.length===newValue.length){
            node.elements.forEach((item,index)=>visit(item,oldValue[index],newValue[index]));
        }else{
            const start=node.getStart(tree), line=original.lastIndexOf('\n',start-1)+1;
            const indent=original.slice(line,start).match(/^\s*/)[0].length;
            edits.push({start,end:node.end,text:JSON.stringify(newValue,null,2).replace(/\n/g,'\n'+' '.repeat(indent))});
        }
    }
    visit(tree.statements[0].expression,before,value);
    let after=original;
    for(const edit of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,edit.start)+edit.text+after.slice(edit.end);
    if(JSON.stringify(JSON.parse(after))!==JSON.stringify(value))throw Error('Patch model mismatch');
    const r=spawnSync('git',['-c','core.safecrlf=false','diff','--no-index','--no-ext-diff','--unified=3','--',file,'-'],{cwd:root,input:after,encoding:'utf8',windowsHide:true,maxBuffer:12e6});
    if(r.status!==1)throw Error(r.stderr||'No patch');
    return `*** Update File: ${root}/${file}\n`+r.stdout.split('\n').slice(r.stdout.split('\n').findIndex(l=>l.startsWith('@@'))).filter(l=>!l.startsWith('\\ No newline')).map(l=>l.startsWith('@@')?'@@':l).join('\n').trimEnd()+'\n';
}
function add(file,value){return `*** Add File: ${root}/${file}\n`+json(value).trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';}
process.stdout.write('*** Begin Patch\n'+add(pathsFile,sourcePaths)+add(reviewPath,review)+update(ledgerPath,ledger)+update(progressPath,progress)+update(statePath,state)+'*** End Patch\n');
