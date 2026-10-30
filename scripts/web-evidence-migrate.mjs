// Print a deterministic ledger patch; caller applies it explicitly. No filesystem writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=x=>createHash('sha256').update(x).digest('hex');
const jsonl=p=>read(p).trimEnd().split('\n').map(x=>JSON.parse(x));
const ledgerPath='docs/WEB_VERIFICATION_LEDGER.json';
const old=read(ledgerPath),ledger=JSON.parse(old);
const names=['inventory','records','stages','reviews','references','snapshots','sourceLines'];
const sections=Object.fromEntries(names.map(name=>{
  const p=`docs/verification/${name}.jsonl`,bytes=fs.readFileSync(path.join(root,p));
  return [name,{path:p,sha256:hash(bytes),rows:jsonl(p).length}];
}));
const data=Object.fromEntries(names.map(n=>[n,jsonl(sections[n].path)]));
const oldFixes=new Map(ledger.fixes.map(f=>[f.id,f]));
ledger.schemaVersion=2;
ledger.updatedUtc=process.argv[2] || ledger.updatedUtc;
ledger.baseline.historicalImportScope='All available apps/web/test-results artifacts and five historical source documents; 204 real defect records, WB-001..203, including disambiguated WB-045. Full available-history migration, not new execution.';
ledger.archive={id:'WEB-HISTORY-2026-10-18',status:'available_archive_migrated',sections,
  boundaries:['All available files inventoried and integrity checked; screenshots not re-interpreted as fresh visual tests.',
    '109 unresolved literal June/July file paths remain explicit; absent evidence is not fabricated.',
    'Stage and progress/final repetitions are provenance, not additional atomic tests.',
    'Historical observations do not automatically certify a current candidate.'],
  frozenHistoricalFinals:data.inventory.filter(a=>/final-report(?:-1900)?\.json$/.test(a.path)).map(a=>({path:a.path,sha256:a.sha256}))};
const followupPath='apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json';
const followupAsset=data.inventory.find(a=>a.path===followupPath);
ledger.archive.reconciliations=[{id:'WB-082',previousStatus:'fixed_pending_verification',status:'historically_verified_targeted',
  evidenceIds:[followupAsset.id],path:followupPath,pointer:'/historicalFollowup',
  exactValue:'WB082 actual duration value empty -> typed30/persisted30 confirmed; not new fix count',
  scope:'Owner service duration: clear → empty → type 30 → saved 30. G005 explicitly confirms the old fix. No new fix; not whole service/device/production acceptance.'}];
ledger.requirements=ledger.requirements.map(r=>{
  const review=data.reviews.find(x=>x.requirementId===r.id);
  return {...r,status:r.status==='excluded'?'excluded':review.assessment==='bounded_historical_evidence'?'partial':'not_run',
    historicalAssessment:review.assessment,historyReviewId:r.id,historyAuditComplete:true,
    historicalFixIds:[...new Set([...(r.historicalFixIds||[]),...review.refs.filter(x=>x.defectId).map(x=>x.defectId)])]};
});
ledger.fixes=data.records.map(b=>{
  const previous=oldFixes.get(b.id);
  const reconciliation=ledger.archive.reconciliations.find(r=>r.id===b.id);
  const status=reconciliation?.status||(b.status==='declared_targeted_verified'?(b.evidenceGrade==='direct_archived_primary_record'?'historically_verified_targeted':'documented_historical_verified'):b.status);
  return {...previous,id:b.id,originalId:b.originalId,status,severity:b.severity,
    claim:previous?.claim||b.title,
    excludes:reconciliation?.scope||previous?.excludes||'Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.',
    requirementIds:[...new Set([...(previous?.requirementIds||[]),...data.reviews.filter(r=>r.refs.some(x=>x.defectId===b.id)).map(r=>r.requirementId)])],
    evidenceIds:[...new Set([...(previous?.evidenceIds||[]),...b.directEvidenceIds,...(reconciliation?.evidenceIds||[])])],
    historicalRecordId:b.id,evidenceGrade:reconciliation?'archived_explicit_followup':b.evidenceGrade,newInThisAudit:false,currentCertification:false,
    ...(reconciliation?{reconciliation}:{} )};
});
ledger.accountingSemantics={auditCompleteMeans:'All available files/records and all original obligations classified, including absent proof. It does not mean product completion.',not_run:'No current acceptance execution entered; historical evidence or failure may exist. Read historicalAssessment.',historicalTargetedFixes:'Only declared targeted verified with a directly referenced archived stage/progress. Missing-primary declarations separate.',remainingWork:'Full acceptance obligations minus accepted obligations; not remaining development hours or unknown bug count.'};
ledger.workPolicy.automationResumeAuthorized=false;
ledger.nextBatch={status:'not_started_live_tests_paused_by_user',objective:'Agree finite acceptance cases and candidate/dependency reuse for the next risk-prioritized requirement. Historical migration is complete; do not repeat already recorded observations solely to populate this registry.'};
const next=JSON.stringify(ledger,null,2)+'\n';
// Full structured replacement avoids accidentally matching a nested JSON member.
if(process.argv[3] && process.argv[3]!=='all')throw Error('Only complete ledger patches are supported');
let patch='*** Begin Patch\n*** Update File: '+path.join(root,ledgerPath).replaceAll('\\','/')+'\n';
patch+='@@\n'+old.trimEnd().split(/\r?\n/).map(l=>'-'+l).join('\n')+'\n'+next.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';
patch+='*** End Patch';
const offset=Number(process.argv[4]||0),size=Number(process.argv[5]||patch.length);
process.stdout.write(patch.slice(offset,offset+size));
