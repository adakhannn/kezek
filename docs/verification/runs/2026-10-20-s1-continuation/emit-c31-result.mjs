import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { updateJson } from './json-evidence-patch.mjs';
const run='docs/verification/runs/2026-10-20-s1-continuation',read=p=>fs.readFileSync(p),j=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex'),utc=process.argv[2];
if(!utc)throw Error('ActualUTC required');
const l=j('docs/WEB_VERIFICATION_LEDGER.json'),p=j(run+'/progress.json'),r=j(run+'/c31-result.json'),s=j('docs/WEB_GLOBAL_READINESS_STATE.json'),d=j(run+'/nonfinal-draft.json');
if(l.evidence.some(e=>e.id==='S1-EV-251'))throw Error('Alreadyapplied');
l.evidence.push(...[[251,'c31-plan.json'],[252,'c31-result.json']].map(([n,f])=>({id:'S1-EV-'+n,path:run+'/'+f,sha256:sha(read(run+'/'+f))})));
const deps=l.cases.find(c=>c.id==='S21-F401-client-dashboard').dependencyHashes;
for(const[f,h]of Object.entries(deps))if(sha(read(f))!==h)throw Error('Changeddependency');
for(const row of r.cases){const c=l.cases.find(c=>c.id==='S21-F401-'+row.key);if(!c||c.status!=='not_run')throw Error('Unexpectedtarget');Object.assign(c,{status:'passed',actual:row.actual,observedUtc:row.beforeUtc,observationWindowUtc:[row.afterUtc,row.beforeUtc],method:'live',steps:['Ordinaryknownidentity/currentrolecontrol','DirectplannedwrongroleURL','Inspect settledDOM without commands'],sideEffects:r.effects,dependencyHashes:deps,evidenceIds:[...c.evidenceIds,'S1-EV-251','S1-EV-252']});}
l.updatedUtc=utc;l.nextBatch.objective=r.next;
Object.assign(p,{activeSubpackage:'C31F4availablecontextscomplete12PASS4BLOCKED',casePlan:'c31-plan.json',lastCheckpoint:r.next,checkpointAfterClockUtc:utc});p.S2.protectedWrongRoleMatrix={requirement:'F4-01',...r.matrix,note:'4adminnegativePASS reused withM1-02; not12newexecutions'};p.browser.page='/admin';p.browser.actualRole='C31knownSA restoredafterowner/staffordinaryGoogle, actualAdmin-panel/Anonymized';
Object.assign(s.progressAccounting,{latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c31-result.json'});
d.draftRefreshedUtc=utc;d.latestCompleted='C31F4-01matrix12PASS4BLOCKED/16;8newC30C31+4reused. No newacceptedrequirement. KnownSArestored.';d.completed.push(d.latestCompleted);d.currentActualBrowser={tab:'5',role:'knownSAkezekkg',path:'/admin',state:'restoredafterC31',secondaryTab:'2root sharedsession'};
process.stdout.write('*** Begin Patch\n'+updateJson('docs/WEB_VERIFICATION_LEDGER.json',l,3,true)+updateJson(run+'/progress.json',p,3,true)+updateJson('docs/WEB_GLOBAL_READINESS_STATE.json',s,3,true)+updateJson(run+'/nonfinal-draft.json',d,3,true)+'*** End Patch\n');
