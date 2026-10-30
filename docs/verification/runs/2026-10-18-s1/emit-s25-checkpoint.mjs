// Read-only emitter; apply output with apply_patch. Never starts browser/network/app/DB work.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root='C:/projects/kezek',run='docs/verification/runs/2026-10-18-s1';
const read=f=>fs.readFileSync(path.join(root,f)),json=f=>JSON.parse(read(f)),sha=b=>createHash('sha256').update(b).digest('hex');
const l=json('docs/WEB_VERIFICATION_LEDGER.json'),p=json(`${run}/progress.json`),r=json(`${run}/s25-build-assets-result.json`);
if(l.candidate.id!==r.candidateId||l.evidence.some(e=>e.id==='S1-EV-43'))throw Error('Unexpected base');
l.candidate.buildStatus='defaultTurbopack_build_exit0_and_fresh_origin_shared_assets_live_recertified_S25; not_deployed';
for(const c of l.cases.filter(c=>c.id==='A3-01-S1-01'||c.id.startsWith('A3-02-S1-'))){
 c.certificationHistory.push({candidateId:c.candidateId,status:c.status,observedUtc:c.observedUtc,actual:c.actual,evidenceIds:c.evidenceIds});
 c.status='passed';c.observedUtc=r.recordedUtc;c.environment='Current-source defaultTurbopack local production artifact at fresh s1assets-after-20261018-122521.localhost:3103; dummy backend/all-data-networkblocked';
 c.role='public guest; visible Sign-in menu';
 c.steps=['Default compiler coldbuild same1659-file boundary; actualexit0/types/36pages','Start exactbuiltartifact on loopback3103','Open fresh-origin privacy via CUA; inspect DOM/CSSOM/decodedimage, bundle observedfont/image/CSSbytes','Click real menu to verify relevantJS hydration; reloadprivacy retainsdocument','Return original owner/RU/business2; stop exactownedchild and verify3103absent'];
 c.actual=c.id==='A3-01-S1-01'?'S25 defaultNext16Turbopack coldbuild exit0/34.4scompile/types/36prerenders; actualnextstartready1819ms/privacydocument+reload verified. No fontmock or compilerfallback.':c.id.endsWith('01')?'Fresh-origin2CSS delivered, actualCSSOM17/112rules; bundlebytes retained.':c.id.endsWith('02')?'Fresh-origin3real woff2 font files successfully delivered/exported; CSSfont-face present/documentfontsloaded. Not selected-face typography or screenshot proof.':c.id.endsWith('03')?'Observed13script resources plus actual menu expansion proves relevantcurrentbundle hydration; not everyroute/chunk test.':'Actualdecodedlogo320x86/complete; bundle3externalimages+15inlineSVGexports succeeds; no visual/deviceproof.';
 c.evidenceIds=[...new Set([...c.evidenceIds,'S1-EV-43','S1-EV-44','S1-EV-46'])];
 c.dependencyHashes['apps/web/src/app/loading.tsx']=sha(read('apps/web/src/app/loading.tsx'));
 c.sideEffects=r.sideEffects;delete c.blockedBy;
}
for(const id of ['A3-01','A3-02'])l.requirements.find(x=>x.id===id).status='passed';
for(const [id,file] of [['S1-EV-43','s25-build-assets-result.json'],['S1-EV-44','s25-build-console.txt'],['S1-EV-45','s25-font-build-plan.json'],['S1-EV-46','s25-assets/manifest.json'],['S1-EV-47','s24-functional-build-console.txt'],['S1-EV-48','s24-server-reads.txt']])l.evidence.push({id,path:`${run}/${file}`,sha256:sha(read(`${run}/${file}`))});
let next=49;
for(const file of fs.readdirSync(path.join(root,run,'s25-assets')).sort().filter(f=>f!=='manifest.json'))l.evidence.push({id:`S1-EV-${next++}`,path:`${run}/s25-assets/${file}`,sha256:sha(read(`${run}/s25-assets/${file}`))});
l.updatedUtc=r.recordedUtc;
l.nextBatch.status='S1_default_build_assets_recertified_remaining_blockers';
l.nextBatch.objective='By12:40UTC complete evidence reconciliation and safe final handoff; remaining S1 prerequisites explicit, no automaticS2 or domaindeployment.';
p.candidate=l.candidate;p.acceptedNow=16;p.remainingOverall=300;p.remainingS1=9;
for(const pack of p.packagePlans){pack.acceptedRequirementIds=pack.requirements.filter(x=>l.requirements.find(y=>y.id===x.id).status==='passed').map(x=>x.id);pack.remaining=pack.requirements.length-pack.acceptedRequirementIds.length;}
p.checkpoints.push({utc:r.recordedUtc,package:'S1.1-current-build-assets',evidence:'s25-build-assets-result.json',acceptedDelta:2,acceptedOverall:16,remainingOverall:300,remainingS1:9,acceptedIds:['A3-01','A3-02'],note:'Actual default current build and fresh-origin assets replace S24reopened status; originalfailedattempts retained.'});
p.activePackage='S1-final-evidence-and-blocker-review';p.caseCounts={active:79,passed:56,failed:0,blocked:22,stale:0,not_run:1};p.handoff={...r.cleanup,observedUtc:r.recordedUtc,tab:'IAB2/tab3',page:'localhost:3000/dashboard/settings',role:'owner',language:'RU',business:'c28c8109',markHandoff:true};p.nextWork=l.nextBatch.objective;
function patch(file,value){const d=spawnSync('git',['-c','core.safecrlf=false','diff','--no-index','--no-ext-diff','--unified=3','--',file,'-'],{cwd:root,input:JSON.stringify(value,null,2)+'\n',encoding:'utf8',windowsHide:true,maxBuffer:4e6});if(d.status!==1)throw Error(d.stderr||'No diff');const lines=d.stdout.split('\n'),start=lines.findIndex(s=>s.startsWith('@@'));return `*** Update File: ${root}/${file}\n`+lines.slice(start).filter(s=>!s.startsWith('\\ No newline')).map(s=>s.startsWith('@@')?'@@':s).join('\n').trimEnd()+'\n';}
const file=process.argv[2];process.stdout.write('*** Begin Patch\n'+(!file||file==='progress'?patch(`${run}/progress.json`,p):'')+(!file||file==='ledger'?patch('docs/WEB_VERIFICATION_LEDGER.json',l):'')+'*** End Patch\n');
