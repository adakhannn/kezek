import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {updateJson} from './json-evidence-patch.mjs';
const run='docs/verification/runs/2026-10-20-s1-continuation',read=p=>fs.readFileSync(p),j=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex'),utc=process.argv[2];
if(!utc)throw Error('ActualUTC required');
const l=j('docs/WEB_VERIFICATION_LEDGER.json'),p=j(run+'/progress.json'),r=j(run+'/c33-result.json'),s=j('docs/WEB_GLOBAL_READINESS_STATE.json'),d=j(run+'/nonfinal-draft.json');
if(l.evidence.some(e=>e.id==='S1-EV-254'))throw Error('Alreadyapplied');
l.evidence.push(...[[254,'c33-entry-modes-plan.json'],[255,'c33-result.json']].map(([n,f])=>({id:'S1-EV-'+n,path:run+'/'+f,sha256:sha(read(run+'/'+f))})));
const req=l.requirements.find(q=>q.id==='F4-02'),baseReq=l.requirements.find(q=>q.id==='F4-01'),base=baseReq.caseIds.map(id=>l.cases.find(c=>c.id===id)),added=[];
for(const c of base){for(const[f,h]of Object.entries(c.dependencyHashes??{}))if(c.status==='passed'&&sha(read(f))!==h)throw Error('Changedbase dependency');if(!c.requirementIds.includes(req.id))c.requirementIds.push(req.id);}
for(const c of base)for(const mode of ['reload','newtab','copied-address']){
  const reusedReload=mode==='reload'&&['S21-M102-owner-root','S21-M102-client-root','S21-M102-staff-root'].includes(c.id);
  const observed=c.id===r.baseCaseId?r.cases.find(x=>x.mode===mode):null;
  const clone={id:'S21-F402-'+c.id.replace(/^S21-(M102|F401)-/,'')+'-'+mode,requirementIds:[req.id],status:c.status==='blocked'?'blocked':reusedReload||observed?'passed':'not_run',requiresLive:true,requiresVisual:false,variants:[c.variants[0]+':'+mode],expected:'Sameprotectedpageguardunder'+mode+'; no foreignworkspace in settledDOM',actual:c.status==='blocked'?'Missingallowedbusinessadmin/managerfixture; blockedpairnotremoved':observed?.actual??(reusedReload?'ReusedC11documentreload: '+c.actual:'Plannedentrymode notexecuted'),role:c.role,environment:'DEV localhost3000 RU sameIABsession',candidateId:r.candidate,method:reusedReload||observed?'live':'not_executed',sourceDirectCaseId:c.id,evidenceIds:reusedReload?[...c.evidenceIds,'S1-EV-254','S1-EV-255']:['S1-EV-254',...(observed?['S1-EV-255']:[])]};
  if(reusedReload){Object.assign(clone,{observedUtc:c.observedUtc,dependencyHashes:c.dependencyHashes,sideEffects:c.sideEffects,steps:c.steps,reusedNotNewExecution:true});}
  if(observed){Object.assign(clone,{observedUtc:observed.beforeUtc,observationWindowUtc:[observed.afterUtc,observed.beforeUtc],dependencyHashes:c.dependencyHashes,sideEffects:r.effects,steps:['CurrentknownSA/sharedsessioncontrol',mode+' scopedprotectedpage','Inspect explicitdenial/no commands; closeownTab6']});}
  added.push(clone);
}
l.cases.push(...added);Object.assign(req,{status:'partial',casePlanComplete:true,caseIds:[...base,...added].map(c=>c.id),expectedVariants:[...base,...added].flatMap(c=>c.variants)});
l.updatedUtc=utc;l.nextBatch.objective=r.next;
Object.assign(p,{activeSubpackage:'C33F4entrymodes3newPASS18of64partial',casePlan:'c33-entry-modes-plan.json',lastCheckpoint:r.next,checkpointAfterClockUtc:utc});p.S2.entryModeMatrix={requirement:'F4-02',...r.matrix,note:'15reusedproofactions atoriginaldates,3newC33; overlapF4-01/M1-02, do notsumasnewexecutions'};p.browser.page='/admin';p.browser.actualRole='C32freshknownSAadmincontrol/C33same-sessiontemporarydenialtabclosed; user5admin preserved';p.automation.latestReadbackCheckpoint='C32new21Oct11:00Bishkekdeadline prompt exact ACTIVE rrul15 targetunchanged';
Object.assign(s.progressAccounting,{latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c33-result.json'});
d.draftRefreshedUtc=utc;d.latestCompleted='C33F4-02threeNEWmodecasesPASS,15reused=18PASS16BLOCKED30notrun/64. No acceptedrequirementdelta;21Oct05UTCdeadline.';d.completed.push(d.latestCompleted);d.currentActualBrowser={tab:'5',role:'knownSAkezekkg',path:'/admin',state:'preservedC33ownTab6closed',secondaryTab:'2root samecookie'};
process.stdout.write('*** Begin Patch\n'+updateJson('docs/WEB_VERIFICATION_LEDGER.json',l,3,true)+updateJson(run+'/progress.json',p,3,true)+updateJson('docs/WEB_GLOBAL_READINESS_STATE.json',s,3,true)+updateJson(run+'/nonfinal-draft.json',d,3,true)+'*** End Patch\n');
