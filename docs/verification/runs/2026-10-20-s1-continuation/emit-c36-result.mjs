import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {updateJson} from './json-evidence-patch.mjs';
const run='docs/verification/runs/2026-10-20-s1-continuation',read=p=>fs.readFileSync(p),j=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex'),utc=process.argv[2];
if(!utc)throw Error('ActualUTC required');
const l=j('docs/WEB_VERIFICATION_LEDGER.json'),p=j(run+'/progress.json'),r=j(run+'/c36-result.json'),s=j('docs/WEB_GLOBAL_READINESS_STATE.json'),d=j(run+'/nonfinal-draft.json');
if(l.evidence.some(e=>e.id==='S1-EV-260'))throw Error('Already applied');
l.evidence.push(...[[260,'c36-owner-entry-plan.json'],[261,'c36-result.json']].map(([n,f])=>({id:'S1-EV-'+n,path:run+'/'+f,sha256:sha(read(run+'/'+f))})));
for(const row of r.cases){
  const c=l.cases.find(c=>c.id==='S21-F402-'+row.key);
  if(!c||c.status!=='not_run')throw Error('Unexpected target '+row.key);
  const deps=l.cases.find(b=>b.id===c.sourceDirectCaseId).dependencyHashes;
  for(const[f,h]of Object.entries(deps))if(sha(read(f))!==h)throw Error('Changed dependency '+f);
  Object.assign(c,{status:'passed',actual:row.actual,observedUtc:row.beforeUtc,observationWindowUtc:[row.afterUtc,row.beforeUtc],method:'live',steps:['Ordinary known-owner Google login and actual owner/alias controls, no business selection','Execute planned '+row.key+' via ordinary document navigation/reload','Inspect explicit denial/no privileged workspace; close owncase tab, restore known-SA'],sideEffects:r.effects,dependencyHashes:deps,evidenceIds:[...c.evidenceIds,'S1-EV-260','S1-EV-261']});
}
const req=l.requirements.find(q=>q.id==='F4-02'),rows=req.caseIds.map(id=>l.cases.find(c=>c.id===id));
if(rows.filter(c=>c.status==='passed').length!==43||rows.filter(c=>c.status==='not_run').length!==5||rows.filter(c=>c.status==='blocked').length!==16)throw Error('Unexpected matrix');
l.updatedUtc=utc;l.nextBatch.objective=r.next;
Object.assign(p,{activeSubpackage:'C36owner5newPASS43of64partial',casePlan:'c36-owner-entry-plan.json',lastCheckpoint:r.next,checkpointAfterClockUtc:utc});
p.S2.entryModeMatrix={requirement:'F4-02',...r.matrix,note:'15 reused originalUTC actions;3new C33+12new C34+8new C35+5new C36. OverlapF4-01/M1-02, not43new executions.'};
p.browser.page='/admin';p.browser.actualRole='C36knownSA restored ordinaryGoogle; actual Admin-panel/Anonymized/admin overview; only original user2root/5admin';
Object.assign(s.progressAccounting,{latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c36-result.json'});
d.draftRefreshedUtc=utc;d.latestCompleted='C36 five NEW owner entrymodecases PASS. F4-02 43PASS16BLOCKED5notrun/64; no new accepted requirements/fixes. Known-SA restored.';d.completed.push(d.latestCompleted);d.currentActualBrowser={tab:'5',role:'knownSAkezekkg',path:'/admin',state:'restoredafterC36; owncaseTabs14/15closed',secondaryTab:'2root sharedsession'};
process.stdout.write('*** Begin Patch\n'+updateJson('docs/WEB_VERIFICATION_LEDGER.json',l,3,true)+updateJson(run+'/progress.json',p,3,true)+updateJson('docs/WEB_GLOBAL_READINESS_STATE.json',s,3,true)+updateJson(run+'/nonfinal-draft.json',d,3,true)+'*** End Patch\n');
