// Read-only narrow accounting emitter, never starts app/tests/network or writes files.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root='C:/projects/kezek', run='docs/verification/runs/2026-10-20-s1-continuation';
const read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ledger=JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json'));
if(ledger.candidate.id!=='dev-20261020-S1-ed0bdd7faf24'||ledger.evidence.some(e=>e.id==='S1-EV-85'))throw Error('Already applied or candidate changed');
const result=JSON.parse(read(run+'/c04-result.json'));
if(result.completedBuild.exitCode!==0)throw Error('No completed build');
const utc=result.observedUtc;
const files=['c04-result.json','c04-build-raw.txt','c04-warm-build-raw.txt','c04-cold-types-raw.txt','c04-server-raw.txt','c04-copy-audit.json','c04-production-assets.jpg',...fs.readdirSync(path.join(root,run,'c04-assets')).sort().map(f=>'c04-assets/'+f)];
ledger.evidence.push(...files.map((file,index)=>({id:'S1-EV-'+(85+index),path:run+'/'+file,sha256:sha(read(run+'/'+file))})));
const newEvidence=files.map((_,index)=>'S1-EV-'+(85+index));
const actuals=['Current1660-file exact source defaultTurbopack build warm followup exit0/39.2scompile/type gate enabled/36prerenders. Actual nextstart Ready3.6s and privacy document/reload live PASS. First cold-build timeout retained, not cold-build PASS.', 'Fresh local origin2CSS exported, CSSOM17/112rules; asset bytes retained. Not all-route controllable browser cold-cache proof.', 'Fresh local origin3real WOFF2 resources exported successfully; loaded font status. No fontmock; not selected-face typography proof.', 'Fresh local origin13script resources/14DOMscripts; actual Menu expansion and Close proves current bundle hydration. Not every route/chunk.', 'Fresh local origin logo complete/decoded320x86;3externalimages+15inlineSVG exports. No device-matrix promotion.'];
const ids=['A3-01-S1-01','A3-02-S1-01','A3-02-S1-02','A3-02-S1-03','A3-02-S1-04'];
ids.forEach((id,index)=>{const c=ledger.cases.find(c=>c.id===id);if(c.status!=='stale')throw Error('Not stale: '+id);c.certificationHistory=[...(c.certificationHistory||[]),{candidateId:c.candidateId,observedUtc:c.observedUtc,actual:c.actual,evidenceIds:[...c.evidenceIds],status:'superseded_build_output'}];Object.assign(c,{status:'passed',candidateId:ledger.candidate.id,observedUtc:utc,method:'live',role:'guest on isolated local production output',environment:'Fresh origin s1assets-20261020-ed0bdd.localhost:3104/privacy; exact current source, dummy backend/Node data network denied; not deployed production',actual:actuals[index],steps:['Verify exact1660-source bytes/fingerprint; retain failed first attempt','Independent cold tsc0 and one warm-cache default next build0 without skipped gates/fontmock','Start owned isolated nextstart3104, open fresh-origin privacy page via CUA','Read CSSOM, decoded logo, observed assets and bundle23/23','Actual menu expand/close; reload retains document','Restore mainDEV guest catalogue then stop exact owned temporary server'],sideEffects:'Generated isolated output/assets, temporary process, read-only privacy/menu/reload. No real credentials/DEV DB/Sentry to isolated process. Ordinary telemetry unenumerated; isolated FrontendMetrics errors retained. Primary source/config untouched.',staleReason:null,staleSinceCandidate:null,evidenceIds:[...new Set([...c.evidenceIds,...newEvidence])]});for(const file of Object.keys(c.dependencyHashes))c.dependencyHashes[file]=sha(read(file));});
for(const id of ['A3-01','A3-02'])ledger.requirements.find(r=>r.id===id).status='passed';
ledger.candidate.buildStatus='PASS_default_Turbopack_warm_followup_20Oct09:07:33UTC; cold_timeout_retained; isolated_dummy_config_not_deployed';
ledger.updatedUtc=utc;
ledger.nextBatch.objective='C03 and C04 complete. S1remaining7requirements/20cases: browser cold/SSR/initialvisual10, stalechunk recovery diagnostic1, domain9. Current capture geometry changed; only a NEW bounded capability case may reassess after actual state proof, no unchanged loops. Domainlast.';
const progress=JSON.parse(read(run+'/progress.json'));
Object.assign(progress,{status:'ACTIVE_S1_C04_COMPLETE',acceptedS1:18,remainingS1:7,passedCases:59,remainingCases:20,activeSubpackage:'S1.1/S1.2 remaining browser proof and diagnostic blockers',checkpointAfterClockUtc:utc,lastCheckpoint:'C03complete S1.3=8/8. C04 default warm build exit0/36prerenders, fresh-origin CSS/font/chunk/image delivery and reload PASS;firstcoldtimeout retained. Main tab guest catalogue; isolatedPID23604 stopped. New actualCSS451x413DPR1.8 and screenshot works; not device/initial-paint PASS. No new product fixes beyondC01F003.',packageCounts:[{id:'S1.1',accepted:3,total:8},{id:'S1.2',accepted:7,total:9},{id:'S1.3',accepted:8,total:8}]});
Object.assign(progress.browser,{page:'/',actualRole:'actual guest after C03 logout',screenshotRecovered:true,cssViewport:'451x413 at isolated origin',dpr:1.8000000715255735,rawScreenshot:'c04-production-assets.jpg current qualitative proof; not device matrix'});
const state=JSON.parse(read('docs/WEB_GLOBAL_READINESS_STATE.json'));
Object.assign(state.progressAccounting,{acceptedRequirements:18,remainingRequirements:298,acceptedS1:18,remainingS1:7,latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c04-result.json'});
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
process.stdout.write('*** Begin Patch\n'+update('docs/WEB_VERIFICATION_LEDGER.json',ledger)+update(run+'/progress.json',progress)+update('docs/WEB_GLOBAL_READINESS_STATE.json',state)+'*** End Patch\n');
