import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {updateJson} from './json-evidence-patch.mjs';
const run='docs/verification/runs/2026-10-20-s1-continuation',read=p=>fs.readFileSync(p),j=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex'),utc=process.argv[2];
if(!utc)throw Error('ActualUTC required');
const l=j('docs/WEB_VERIFICATION_LEDGER.json'),p=j(run+'/progress.json'),r=j(run+'/c34-result.json'),s=j('docs/WEB_GLOBAL_READINESS_STATE.json'),d=j(run+'/nonfinal-draft.json');
if(l.evidence.some(e=>e.id==='S1-EV-256'))throw Error('Already applied');
l.evidence.push(...[[256,'c34-guest-entry-plan.json'],[257,'c34-result.json']].map(([n,f])=>({id:'S1-EV-'+n,path:run+'/'+f,sha256:sha(read(run+'/'+f))})));
for(const row of r.cases){
  const c=l.cases.find(c=>c.id==='S21-F402-'+row.key);
  if(!c||c.status!=='not_run')throw Error('Unexpected target '+row.key);
  const deps=l.cases.find(b=>b.id===c.sourceDirectCaseId).dependencyHashes;
  for(const[f,h]of Object.entries(deps))if(sha(read(f))!==h)throw Error('Changed dependency '+f);
  Object.assign(c,{status:'passed',actual:row.actual,observedUtc:row.beforeUtc,observationWindowUtc:[row.afterUtc,row.beforeUtc],method:'live',steps:['Ordinary known-SA logout and guest sign-in control','Execute planned '+row.key+'; redirected reload is actual sign-in landing where applicable','Inspect settled DOM for required denial/login prompt; no commands; close own temporary tab and restore known-SA'],sideEffects:r.effects,dependencyHashes:deps,evidenceIds:[...c.evidenceIds,'S1-EV-256','S1-EV-257']});
}
const req=l.requirements.find(q=>q.id==='F4-02'),rows=req.caseIds.map(id=>l.cases.find(c=>c.id===id));
if(rows.filter(c=>c.status==='passed').length!==30||rows.filter(c=>c.status==='not_run').length!==18||rows.filter(c=>c.status==='blocked').length!==16)throw Error('Unexpected matrix');
l.updatedUtc=utc;l.nextBatch.objective=r.next;
Object.assign(p,{activeSubpackage:'C34guest12newPASS30of64partial',casePlan:'c34-guest-entry-plan.json',lastCheckpoint:r.next,checkpointAfterClockUtc:utc});
p.S2.entryModeMatrix={requirement:'F4-02',...r.matrix,note:'15 reused proof actions at original UTC; 3new C33 +12new C34. Overlaps F4-01/M1-02; not30new executions.'};
p.browser.page='/admin';p.browser.actualRole='C34knownSA restored via ordinary Google; actual Admin-panel/Anonymized and admin overview; only user2root/5admin remain';
Object.assign(s.progressAccounting,{latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c34-result.json'});
d.draftRefreshedUtc=utc;d.latestCompleted='C34 twelve NEW guest entrymodecases PASS. F4-02 30PASS16BLOCKED18notrun/64; no accepted requirement delta or new fixes. Known-SA restored.';d.completed.push(d.latestCompleted);d.currentActualBrowser={tab:'5',role:'knownSAkezekkg',path:'/admin',state:'restored after C34 guest tests; own tabs7-10closed',secondaryTab:'2root sharedsession'};
process.stdout.write('*** Begin Patch\n'+updateJson('docs/WEB_VERIFICATION_LEDGER.json',l,3,true)+updateJson(run+'/progress.json',p,3,true)+updateJson('docs/WEB_GLOBAL_READINESS_STATE.json',s,3,true)+updateJson(run+'/nonfinal-draft.json',d,3,true)+'*** End Patch\n');
