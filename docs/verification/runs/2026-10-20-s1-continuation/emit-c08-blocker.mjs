// C08 changed-state blocker update, read-only emitter.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const root='C:/projects/kezek',run='docs/verification/runs/2026-10-20-s1-continuation',read=file=>fs.readFileSync(path.join(root,file)),sha=b=>createHash('sha256').update(b).digest('hex'),utc='2026-10-20T09:35:58Z';
const ledger=JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json'));if(ledger.evidence.some(e=>e.id==='S1-EV-154'))throw Error('Already applied');
ledger.updatedUtc=utc;ledger.evidence.push({id:'S1-EV-154',path:run+'/c08-result.json',sha256:sha(read(run+'/c08-result.json'))});
ledger.cases.find(c=>c.id==='S12-INITIAL-VISUAL').actual+=' C08: humanCtrl0 confirmed; ONE new preflight gives2661x2096DPR0.375 and capturefailed. Zoom cause NOT confirmed. Matrix stopped0closures, user manually-opened-new-DEV-tab repair requested once, no agent replacement. See S1-EV-154.';
ledger.nextBatch.objective='C06/C07 F004 verified and fresh build/assets currentBBC. C08 afterhumanCtrl0 capturestillfails;0closures. Await human manuallyopenedDEVtab/newstate; no agent replacement/unchanged retry/repeatedCtrl0. S118/25 and60/79cases,19remain; domainlast. SSR/coldcache/originaltransient diagnostic blockers separate.';
const progress=JSON.parse(read(run+'/progress.json'));Object.assign(progress,{checkpointAfterClockUtc:utc,lastCheckpoint:ledger.nextBatch.objective,userZoomAnswer:'Human reset100% confirmed; C08 actualviewport2661x2096DPR0.375/capturefailed; zoom explanation NOT established. New manualDEVtab repair requested once.'});
const state=JSON.parse(read('docs/WEB_GLOBAL_READINESS_STATE.json'));Object.assign(state.progressAccounting,{latestCheckpointUtc:utc,latestCheckpointEvidence:run+'/c08-result.json'});
const draft=JSON.parse(read(run+'/nonfinal-draft.json'));Object.assign(draft,{currentCandidate:ledger.candidate.id,passedCases:60,remainingCases:19,newConfirmedLiveFixes:['S1-F003','S1-F004'],latestCompleted:'C06/C07 F004 chunkretry fix+SAME-LIVE PASS,17targetedunitPASS/scopedcoverage75branches/types0/lint0. Fresh default cold1662-fileBBC build0/35.3scompile/36prerenders/assets21exports0failures. OwnPID30140 stopped/chunkrestored/mainusertabpreserved. Prior C04timeout/C06retryFAIL retained.',notCompleted:['C08 one preflight afterhumanCtrl0 stillcapturefailed/2661x2096DPR0.375;await manuallyopenednewDEVtab, not repeatedCtrl0','Eight cold-cache cases and original prehydration SSR proof blocked','One original transient failed-request classification remains','Eight deployed-domain cases deferred, not excluded']});
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
process.stdout.write('*** Begin Patch\n'+update('docs/WEB_VERIFICATION_LEDGER.json',ledger)+update(run+'/progress.json',progress)+update('docs/WEB_GLOBAL_READINESS_STATE.json',state)+update(run+'/nonfinal-draft.json',draft)+'*** End Patch\n');
