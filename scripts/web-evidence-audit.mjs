// Read-only historical migration builder. Output is applied separately with apply_patch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './web-verification-report.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const posix = p => p.replaceAll('\\', '/');
export function unfence(text) {
  let fenced = false;
  return text.split(/\r?\n/).map(line => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return ''; }
    return fenced ? '' : line;
  }).join('\n');
}
export function bugBlocks(text) {
  const lines = unfence(text).split('\n'), starts = [];
  lines.forEach((line, i) => { if (/^### WB-\d+/.test(line)) starts.push(i); });
  return starts.flatMap((start, i) => {
    const end = starts[i + 1] ?? lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    return [...lines[start].matchAll(/WB-(\d+)/g)].map(m => ({
      originalId: `WB-${m[1].padStart(3, '0')}`, startLine: start + 1, endLine: end,
      heading: lines[start].slice(4), body,
    }));
  });
}
function walk(p) {
  return fs.readdirSync(path.join(root, p), { withFileTypes: true }).flatMap(e => {
    const f = `${p}/${e.name}`; return e.isDirectory() ? walk(f) : [f];
  });
}
function field(body, key) {
  return body.match(new RegExp(`(?:^|[;\\n])\\s*-?\\s*${key}:\\s*([^\\n;]+)`, 'im'))?.[1]?.replaceAll('`', '').trim() ?? null;
}
export function referencePaths(text) {
  return [...new Set([...text.matchAll(/apps[\\/]web[\\/]test-results[\\/][^\s`"'<>\]\[(){};,]+/g)]
    .map(m => posix(m[0]).replace(/[.:]+$/, '')))];
}
function classifyFile(p) {
  const n = path.basename(p);
  if (/\.(png|jpe?g|webp)$/i.test(n)) return 'image_not_newly_visually_reviewed';
  if (/^(stage-|.*-stage\.json)/.test(n)) return 'stage_manifest';
  if (/^(progress|final-report)/.test(n)) return 'run_summary';
  if (/draft|checkpoint|verification|fingerprint|preflight|inventory|git-status/i.test(n)) return 'administrative_or_integrity';
  if (/jest|coverage|lcov|lint|typecheck|tsc|unit|build|test-results/i.test(n)) return 'automated_or_build_support';
  if (/\.(mjs|js|ts|tsx|cjs|ps1|sql)$/i.test(n)) return 'support_script_not_execution_proof';
  if (/\.(txt|log|json)$/i.test(n)) return 'raw_observation_or_diagnostic';
  return 'other_support';
}
function leaves(value, pointer = '') {
  if (typeof value === 'string') return [{ pointer: pointer || '/', text: value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => leaves(v, `${pointer}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`));
}
const nonLiveGlobal = new Set([1,2,3,10,12,17,22,25,28,31,33,34,35,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,61,64,81,82,83,103,104,119,128,132,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155]);
function stageKind(p) {
  const g = path.basename(p).match(/^stage-G(\d+)/i);
  if (g) return nonLiveGlobal.has(+g[1]) ? 'support_blocked_or_administrative_not_live_pass' : 'bounded_historical_live_record';
  if (/stage-0(?:37|51)-/.test(path.basename(p))) return 'blocked_not_live_pass';
  return 'historical_stage_record_mixed_assertions';
}
export function build() {
  const files = walk('apps/web/test-results').sort();
  const inventory = files.map(p => {
    const bytes = fs.readFileSync(path.join(root, p));
    let jsonState = null;
    if (p.endsWith('.json')) { try { JSON.parse(bytes); jsonState = 'valid'; } catch { jsonState = 'invalid_preserved'; } }
    return { id: `AF-${digest(p).slice(0, 16)}`, path: p, bytes: bytes.length, sha256: digest(bytes), category: classifyFile(p), ...(jsonState ? { jsonState } : {}) };
  });
  const byPath = new Map(inventory.map(x => [x.path, x]));
  const stageTexts = new Map(inventory.filter(a => a.category === 'stage_manifest' && a.jsonState === 'valid').map(a => [a.path, read(a.path)]));
  const byName = new Map();
  inventory.forEach(a => { const name=path.basename(a.path); byName.set(name, [...(byName.get(name)||[]), a.path]); });
  const sourceDocs = ['docs/WEB_BUG_REGISTRY.md', 'docs/WEB_LIVE_TESTING_AREAS_CATALOG.md', 'docs/MANUAL_TESTING_TRACKER.md', 'docs/WEB_GLOBAL_READINESS_PLAN.md', 'docs/WEB_GLOBAL_READINESS_STATE.json'];
  const snapshots = sourceDocs.map(p => ({ path: p, sha256: digest(fs.readFileSync(path.join(root,p))), bytes: fs.statSync(path.join(root,p)).size }));
  const sourceLines=sourceDocs.flatMap(p=>read(p).split('\n').map((text,i)=>({path:p,line:i+1,text})));
  const bugs = bugBlocks(read(sourceDocs[0]));
  const duplicates = new Set(bugs.filter((b, i) => bugs.findIndex(x => x.originalId === b.originalId) !== i).map(b => b.originalId));
  const records = bugs.map(b => {
    const id = duplicates.has(b.originalId) ? `${b.originalId}@${/public.*link|public_links|slug/i.test(b.body.slice(0,1000)) ? 'public-links' : 'admin-access'}` : b.originalId;
    const n = +b.originalId.slice(3);
    const title = field(b.body, 'title') || b.heading.replace(/^WB-\d+(?: \/ WB-\d+)?\s*[—-]?\s*/, '');
    const refs = referencePaths(b.body);
    const declaredStatus = field(b.body, 'status') || 'see exact source excerpt';
    const status = [12,15,48,49,54,55,70,177].includes(n) ? 'historical_open_or_reopened'
      : n === 21 ? 'retired_social_only'
      : (n >= 83 || [1,2,3,4,5,6,7,8,9,10,11,13,14,16,17,18,19,20,22,23,24,25,26,27,45,46,50,51,53,56,77].includes(n)) ? 'declared_targeted_verified'
      : 'fixed_pending_verification';
    // Match explicit WB references in stage manifests too; references are associations, not automatic proof.
    const linkedStages = [...stageTexts].filter(([, body]) => new RegExp(`WB[- ]?0*${n}(?!\\d)`, 'i').test(body)).map(([p]) => p);
    const bareNames = [...b.body.matchAll(/(?<![\w-])([\w.-]+\.(?:json|jpg|png|txt|log))(?![\w.])/g)].map(m=>m[1]);
    const resolvedBare = [...new Set([...bareNames, ...[...byName.keys()].filter(name=>b.body.includes(name))])].flatMap(name => {
      const matches = inventory.filter(a=>path.basename(a.path)===name);
      return matches.length===1 ? [matches[0].path] : [];
    });
    const stageNumbers = [...b.body.matchAll(/stage[- ]?(G?)(\d{3})(?!\d)/gi)];
    const resolvedStages = stageNumbers.flatMap(m => inventory.filter(a => a.category==='stage_manifest' && new RegExp(`^stage-${m[1] ? 'G' : ''}${m[2]}(?:-|\\.)`, 'i').test(path.basename(a.path))).map(a=>a.path));
    if (n===115) resolvedStages.push('apps/web/test-results/night-2026-10-09/progress.json'); // explicit night-web-001/progress.liveResults reference
    const direct = [...new Set([...refs.filter(p => byPath.has(p)), ...resolvedBare, ...resolvedStages])];
    const present = [...new Set([...direct, ...linkedStages])];
    return { id, originalId: b.originalId, title, severity: field(b.body, 'severity') || b.body.match(/\bP[012]\b/)?.[0] || 'unspecified', declaredStatus, status,
      evidenceGrade: direct.some(p => ['stage_manifest','run_summary'].includes(byPath.get(p)?.category)) ? 'direct_archived_primary_record' : direct.length ? 'direct_archived_support_only' : 'documented_only_primary_not_located',
      source: { path: sourceDocs[0], startLine: b.startLine, endLine: b.endLine, excerptSHA256: digest(b.body) },
      exactHistoricalRecord: b.body, evidenceIds: present.map(p => byPath.get(p).id), directEvidenceIds: direct.map(p => byPath.get(p).id), contextualStageIds: linkedStages.map(p=>byPath.get(p).id), declaredMissingPaths: refs.filter(p => !byPath.has(p)),
      currentCertification: false, countedAsNewFix: false,
      limitation: 'Historical bounded claim only. Linked stage may mention this WB as a follow-up or inherited context; no whole-area/current-candidate PASS inferred.' };
  });
  const stages = inventory.filter(a => ['stage_manifest','run_summary'].includes(a.category) && a.jsonState === 'valid').map(a => {
    const obj = JSON.parse(read(a.path));
    const claimPointers = Object.entries(obj).filter(([key]) => /result|outcome|status|checks|after|before|actual|expected|retest|live|limit|block|scope|observation|remaining|evidence|fix|bug/i.test(key))
      .map(([key,value]) => ({ pointer: '/'+key.replaceAll('~','~0').replaceAll('/','~1'), valueSHA256: digest(JSON.stringify(value)) }));
    return { id: `HS-${digest(a.path).slice(0,16)}`, fileId: a.id, path: a.path, kind: a.category==='run_summary' ? 'historical_summary_not_additive' : stageKind(a.path),
      stage: obj.stage || obj.id || path.basename(a.path, '.json'),
      result: [obj.result,obj.status,obj.outcome].find(v=>typeof v==='string') || null,
      claimPointers, bugsMentioned: [...new Set([...JSON.stringify(obj).matchAll(/WB[- ]?(\d{1,3})(?!\d)/g)].map(m => `WB-${m[1].padStart(3,'0')}`))],
      currentCertification: false, countAsAtomicTest: false };
  });
  // Exact paths only: no basename guesses, no silent recovery of absent evidence.
  const references = new Map();
  for (const p of [...sourceDocs, ...inventory.filter(a => /\.json$|\.md$/.test(a.path)).map(a=>a.path)]) {
    for (const ref of referencePaths(read(p))) {
      if (!references.has(ref)) references.set(ref, { path: ref, status: byPath.has(ref) ? 'present' : /[*?]/.test(ref) ? 'pattern_not_file' : ref.endsWith('/') ? 'directory_reference' : fs.existsSync(path.join(root, ref)) ? 'directory_or_nonfile_reference' : 'unresolved_literal_reference', sources: [] });
      references.get(ref).sources.push(p);
    }
  }
  const ledger=JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json'));
  const crosswalk=JSON.parse(read('docs/WEB_EVIDENCE_CROSSWALK.json'));
  const resolve = token => {
    if (token.startsWith('WB-')) {
      const found=records.find(r=>r.id===token); if(!found) throw Error(`Unknown/ambiguous bug ${token}`);
      return { token, defectId:found.id, evidenceIds:found.directEvidenceIds, evidenceGrade:found.evidenceGrade };
    }
    const matches=inventory.filter(a=>a.category==='stage_manifest' && (
      token.startsWith('N:') ? a.path===`apps/web/test-results/night-2026-10-09/${token.slice(2)}.json`
      : new RegExp(`^stage-${token.startsWith('G')?'G':''}${token.slice(1)}(?:-|\\.)`).test(path.basename(a.path))
    ));
    if(!matches.length) throw Error(`Unresolved crosswalk ${token}`);
    return {token, evidenceIds:matches.map(a=>a.id), evidenceGrade:token.startsWith('G')&&nonLiveGlobal.has(+token.slice(1)) ? 'support_or_blocked_not_live' : 'historical_stage_mixed_assertions'};
  };
  const reviews = crosswalk.areas.flatMap(a=>{
    const reqs=ledger.requirements.filter(r=>r.areaId===a.id);
    if(reqs.length!==a.refs.length) throw Error(`Crosswalk requirement count mismatch ${a.id}`);
    return reqs.map((r,i)=>{
      const refs=a.refs[i].split(/\s+/).filter(Boolean).map(resolve);
      const assessment=r.status==='excluded'?'excluded':!refs.length?'no_targeted_evidence_located':refs.some(x=>x.evidenceGrade==='historical_stage_mixed_assertions'||x.evidenceGrade==='direct_archived_primary_record')?'bounded_historical_evidence':refs.some(x=>x.evidenceIds.length)?'support_or_blocker_only':'documented_only_primary_missing';
      return {requirementId:r.id,areaId:r.areaId,requirement:r.requirement,assessment,refs,
        knownAreaBoundary:a.known,remainingAreaBoundary:a.remaining,
        acceptanceRemaining: r.status==='excluded'?'Excluded by existing social-only decision':`Not fully accepted: ${r.requirement}`,
        auditComplete:true,currentCertification:false};
    });
  });
  if(reviews.length!==ledger.requirements.length) throw Error('Incomplete crosswalk');
  return { inventory, records, stages, reviews, references: [...references.values()].sort((a,b)=>a.path.localeCompare(b.path)), snapshots, sourceLines };
}
export function pages(rows, limit=48000) {
  const result=[]; let page='',count=0;
  for(const row of rows) { const line=JSON.stringify(row)+'\n'; if(page.length+line.length>limit && page){result.push({text:page,count});page='';count=0;} page+=line;count++; }
  if(page)result.push({text:page,count});return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = build();
  const section = process.argv[2] || 'summary';
  if (section === 'page-counts') process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,pages(v).length]))));
  else if (section === 'summary') process.stdout.write(JSON.stringify({ files: data.inventory.length, bugs: data.records.length, uniqueOriginalIds: new Set(data.records.map(x=>x.originalId)).size, stages: data.stages.length, categories: Object.fromEntries([...new Set(data.inventory.map(x=>x.category))].map(k=>[k,data.inventory.filter(x=>x.category===k).length])), bugStatuses: Object.fromEntries([...new Set(data.records.map(x=>x.status))].map(k=>[k,data.records.filter(x=>x.status===k).length])), grades: Object.fromEntries([...new Set(data.records.map(x=>x.evidenceGrade))].map(k=>[k,data.records.filter(x=>x.evidenceGrade===k).length])), invalidJSON: data.inventory.filter(x=>x.jsonState==='invalid_preserved').map(x=>x.path), unresolved: data.references.filter(x=>x.status==='unresolved_literal_reference').length }, null, 2));
  else if (section==='page') process.stdout.write(JSON.stringify(pages(data[process.argv[3]])[Number(process.argv[4])]));
  else {
    const rows = data[section]; if (!rows) throw Error('Unknown section');
    process.stdout.write(rows.slice(Number(process.argv[3] || 0), Number(process.argv[3] || 0)+Number(process.argv[4] || rows.length)).map(x=>JSON.stringify(x)).join('\n')+'\n');
  }
}
