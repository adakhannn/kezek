// Read-only accounting: no browser, network, product tests, or application writes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadArchive, archiveMarkdown, reviewMarkdown, defectsMarkdown, defectLabels } from './web-evidence-accounting.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requirementStatuses = new Set(['unassessed', 'not_run', 'partial', 'failed', 'blocked', 'passed', 'excluded']);

export function summarize(ledger, read) {
  const errors = [];
  const boundary = ledger.candidate.sourceBoundary;
  if (boundary) {
    try {
      const bytes = read(boundary.pathsFile);
      const paths = JSON.parse(bytes);
      if (digest(bytes) !== boundary.sha256 || !Array.isArray(paths) || paths.length !== boundary.fileCount || new Set(paths).size !== paths.length) throw Error('invalid source list');
      const actualFingerprint = digest(JSON.stringify(paths.map(file => [file, digest(read(file))])));
      if (actualFingerprint !== ledger.candidate.sourceFingerprint) throw Error('source changed');
    } catch {
      errors.push('Candidate source boundary changed or missing');
    }
  }
  const ids = new Set();
  const requirements = ledger.requirements;
  const archive = ledger.archive ? loadArchive(ledger.archive, read, requirements) : null;
  if(archive)errors.push(...archive.errors);
  const evidenceRows=[...ledger.evidence,...(archive?.data.inventory||[])];
  const evidence = new Map(evidenceRows.map(item => [item.id, item]));
  if (evidence.size !== evidenceRows.length) errors.push('Duplicate evidence ID');
  const invalidEvidence = new Set();
  for (const item of evidenceRows) {
    try {
      if (digest(read(item.path)) !== item.sha256) throw new Error('hash mismatch');
    } catch {
      invalidEvidence.add(item.id);
      errors.push(`Missing/changed evidence: ${item.id}`);
    }
  }
  const useEvidence = (refs, owner) => {
    if (!refs?.length) { errors.push(`Missing evidence references: ${owner}`); return false; }
    return refs.every(id => {
      if (!evidence.has(id) || invalidEvidence.has(id)) {
        errors.push(`Invalid evidence reference: ${owner} -> ${id}`); return false;
      }
      return true;
    });
  };
  const cases = new Map();
  for (const c of ledger.cases) {
    if (cases.has(c.id)) errors.push(`Duplicate case ID: ${c.id}`);
    cases.set(c.id, c);
    if (!['not_run', 'passed', 'failed', 'blocked', 'stale'].includes(c.status)) errors.push(`Invalid case status: ${c.id}`);
    if (!c.requirementIds?.length || c.requirementIds.some(id => !requirements.some(r => r.id === id))) errors.push(`Unknown case requirement: ${c.id}`);
    if (c.status !== 'passed') continue;
    if (!ledger.candidate.currentCertification) errors.push(`Candidate is not certified: ${c.id}`);
    const mandatory = ['expected', 'actual', 'role', 'environment', 'observedUtc', 'candidateId', 'method', 'sideEffects'];
    if (mandatory.some(key => !c[key]) || !c.steps?.length || !c.variants?.length) errors.push(`Incomplete PASS: ${c.id}`);
    if (c.candidateId !== ledger.candidate.id) errors.push(`Stale candidate: ${c.id}`);
    if (c.requiresLive && c.method !== 'live') errors.push(`Non-live proof cannot close live case: ${c.id}`);
    if (!c.dependencyHashes || !Object.keys(c.dependencyHashes).length) errors.push(`No dependency boundary: ${c.id}`);
    for (const [file, sha] of Object.entries(c.dependencyHashes || {})) {
      try { if (digest(read(file)) !== sha) throw new Error('changed'); }
      catch { errors.push(`Changed/missing dependency: ${c.id} -> ${file}`); }
    }
    useEvidence(c.evidenceIds, c.id);
    if (c.requiresVisual && !(c.viewport?.cssWidth > 0 && c.viewport?.cssHeight > 0 && c.imageEvidenceId && c.evidenceIds?.includes(c.imageEvidenceId))) errors.push(`Missing actual viewport/image: ${c.id}`);
  }
  for (const r of requirements) {
    if (ids.has(r.id)) errors.push(`Duplicate requirement ID: ${r.id}`);
    ids.add(r.id);
    if (!requirementStatuses.has(r.status)) errors.push(`Invalid requirement status: ${r.id}`);
    if (r.status === 'excluded' && !r.exclusionDecision) errors.push(`Unapproved exclusion: ${r.id}`);
    if (r.caseIds.some(id => !cases.has(id))) errors.push(`Unknown child case: ${r.id}`);
    if (r.status === 'passed') {
      if (!r.casePlanComplete || !r.caseIds.length || !r.expectedVariants?.length) errors.push(`Incomplete case plan: ${r.id}`);
      if (r.caseIds.some(id => cases.get(id)?.status !== 'passed' || !cases.get(id)?.requirementIds.includes(r.id))) errors.push(`Unpassed/misassigned child: ${r.id}`);
      const covered = new Set(r.caseIds.flatMap(id => cases.get(id)?.variants || []));
      if (r.expectedVariants?.some(v => !covered.has(v))) errors.push(`Missing acceptance variant: ${r.id}`);
    }
  }
  if (requirements.length !== ledger.baseline.requirementCount) errors.push('Denominator changed without a new baseline');
  const excludedIds = requirements.filter(r => r.status === 'excluded').map(r => r.id).sort();
  if (JSON.stringify(excludedIds) !== JSON.stringify([...ledger.baseline.excludedIds].sort())) errors.push('Excluded scope changed without a new baseline');
  const scopeHash = digest(JSON.stringify(requirements.map(r => [r.id, r.areaId, r.requirement, r.priority])));
  if (scopeHash !== ledger.baseline.scopeHash) errors.push('Frozen scope changed without a new baseline');
  const fixes = new Set();
  for (const fix of ledger.fixes) {
    if (fixes.has(fix.id)) errors.push(`Duplicate fix: ${fix.id}`);
    fixes.add(fix.id);
    if(fix.status==='historically_verified_targeted')useEvidence(fix.evidenceIds, fix.id);
    else if(fix.evidenceIds?.length)useEvidence(fix.evidenceIds, fix.id);
    if (fix.requirementIds.some(id => !ids.has(id))) errors.push(`Unknown fix requirement: ${fix.id}`);
    if (!defectLabels[fix.status]) errors.push(`Unsupported imported fix status: ${fix.id}`);
    if(archive){
      const record=archive.data.records.find(r=>r.id===fix.id);
      if(!record)errors.push(`Missing historical defect record: ${fix.id}`);
      else if(fix.status==='historically_verified_targeted' && !ledger.archive.reconciliations?.some(r=>r.id===fix.id) && (record.status!=='declared_targeted_verified'||record.evidenceGrade!=='direct_archived_primary_record'))errors.push(`Unsupported historical verification: ${fix.id}`);
      if(record&&fix.status==='historically_verified_targeted'){
        const direct=ledger.archive.reconciliations?.find(r=>r.id===fix.id)?.evidenceIds||record.directEvidenceIds;
        if(!direct.some(id=>fix.evidenceIds.includes(id)&&['stage_manifest','run_summary'].includes(evidence.get(id)?.category)))errors.push(`No matching primary proof for fix: ${fix.id}`);
      }
    }
  }
  if(archive && fixes.size!==archive.data.records.length)errors.push('Incomplete defect migration');
  const currentFindings = ledger.currentFindings || [];
  const findingIds = new Set();
  for (const finding of currentFindings) {
    if (!finding.id || findingIds.has(finding.id)) errors.push('Duplicate/missing current finding ID');
    findingIds.add(finding.id);
    if (!['open', 'fixed_pending_verification', 'verified'].includes(finding.status)) errors.push(`Invalid current finding status: ${finding.id}`);
    if (['title', 'expected', 'actual', 'observedUtc', 'candidateId', 'sideEffects'].some(k => !finding[k]) || !finding.steps?.length || finding.method !== 'live') errors.push(`Incomplete live finding: ${finding.id}`);
    if (!finding.requirementIds?.length || finding.requirementIds.some(id => !ids.has(id))) errors.push(`Unknown finding requirement: ${finding.id}`);
    if (!finding.caseIds?.length || finding.caseIds.some(id => !cases.has(id))) errors.push(`Missing finding repro: ${finding.id}`);
    useEvidence(finding.evidenceIds, finding.id);
    if (finding.status === 'verified') {
      if (!finding.fixApplied || !finding.retestCaseIds?.length || finding.retestCaseIds.some(id => cases.get(id)?.status !== 'passed')) errors.push(`Unverified finding closure: ${finding.id}`);
      useEvidence(finding.fixEvidenceIds, finding.id + ' fix');
    } else if (finding.requirementIds?.some(id => requirements.find(r => r.id === id)?.status === 'passed')) errors.push(`Open finding on accepted requirement: ${finding.id}`);
  }
  const active = requirements.filter(r => r.status !== 'excluded');
  const activeCaseIds = new Set(active.flatMap(r => r.caseIds));
  const activeCases = ledger.cases.filter(c => activeCaseIds.has(c.id));
  const counts = Object.fromEntries([...requirementStatuses].map(s => [s, requirements.filter(r => r.status === s).length]));
  const passed = active.filter(r => r.status === 'passed').length;
  const classified = active.filter(r => r.status !== 'unassessed').length;
  const round = n => Math.round(n * 1000) / 10;
  return {
    valid: errors.length === 0, errors, counts,
    total: requirements.length, applicable: active.length,
    historicalTargetedFixes: ledger.fixes.filter(f=>f.status==='historically_verified_targeted').length,
    currentFindings: { total: currentFindings.length, open: currentFindings.filter(f => f.status !== 'verified').length, verified: currentFindings.filter(f => f.status === 'verified').length },
    defectCounts: Object.fromEntries(Object.keys(defectLabels).map(k=>[k,ledger.fixes.filter(f=>f.status===k).length])),
    evidenceFiles: new Set(evidenceRows.map(e=>e.path)).size,
    ...(archive?{archive:archive.metrics}:{}),
    acceptancePercent: errors.length ? null : round(passed / active.length),
    evidenceTriagePercent: round(classified / active.length),
    executionPercent: !errors.length && active.every(r => r.casePlanComplete) && activeCases.length
      ? round(activeCases.filter(c => ['passed', 'failed'].includes(c.status)).length / activeCases.length) : null,
    productRemainingPercent: null,
    releaseReady: errors.length === 0 && currentFindings.every(f => f.status === 'verified') && passed === active.length && ledger.releaseGates.every(g => g.status === 'passed') && ledger.releaseGates.length > 0,
    groups: [...new Set(active.map(r => r.areaId[0]))].map(group => ({
      group, total: active.filter(r => r.areaId[0] === group).length,
      passed: active.filter(r => r.areaId[0] === group && r.status === 'passed').length,
      partial: active.filter(r => r.areaId[0] === group && r.status === 'partial').length,
      unassessed: active.filter(r => r.areaId[0] === group && r.status === 'unassessed').length,
    })),
  };
}

export function markdown(ledger, s) {
  if(ledger.archive)return archiveMarkdown(ledger,s);
  return `# WEB: проверяемый прогресс\n\nСрез учёта: ${ledger.updatedUtc}. База: ${ledger.baseline.id}. Это аудит документов, не новый живой прогон.\n\n` +
    `- Обязательства каталога: **${s.total}**, применимы **${s.applicable}**, исключены **${s.counts.excluded}** (C2, social-only). Это не число атомарных тестов.\n` +
    `- Полностью принятые обязательства: **${s.counts.passed}/${s.applicable} (${s.acceptancePercent ?? 'INVALID'}%)**. Это доля оформленной полной приёмки, не процент готового продукта или оставшихся часов.\n` +
    `- Частичные доказательства сопоставлены: **${s.counts.partial}**; ещё не классифицированы: **${s.counts.unassessed}**. Разбор свидетельств: **${s.evidenceTriagePercent}%**. Непроверенное в реестре не означает, что раньше ничего не тестировали.\n` +
    `- Проверенный импорт исправлений WB-187–203: **${s.historicalTargetedFixes}** уникальных записей; ${s.evidenceFiles} файлов свидетельств контролируются по SHA-256. Старые PASS относятся к указанным в них сценариям и версиям.\n` +
    `- Процент выполнения атомарных тестов: **${s.executionPercent ?? 'пока не определён: матрица вариантов ещё не завершена'}**. Процент оставшейся разработки/времени не вычисляется из числа тестов.\n` +
    `- Решение о выпуске: **${s.releaseReady ? 'READY_FOR_REVIEW' : 'NOT_READY'}**. Автоматизация не запускается этим отчётом.\n\n` +
    `| Группа | Обязательств | Полностью принято | Частично | Ещё не классифицировано |\n| --- | ---: | ---: | ---: | ---: |\n` +
    s.groups.map(g => `| ${g.group} | ${g.total} | ${g.passed} | ${g.partial} | ${g.unassessed} |`).join('\n') +
    `\n\n## Что именно было исправлено\n\nВсе строки ниже — исторически подтверждённые узкие исправления; текущая полная приёмка области из них не следует.\n\n| ID | Проверенная граница | Не покрывает |\n| --- | --- | --- |\n` +
    ledger.fixes.map(f => `| ${f.id} | ${f.claim} | ${f.excludes} |`).join('\n') +
    `\n\n## Незакрытые ворота выпуска\n\n` + ledger.releaseGates.map(g => `- ${g.id}: ${g.description} — ${g.status}.`).join('\n') +
    `\n\nМетод: [WEB_VERIFICATION_METHOD.md](./WEB_VERIFICATION_METHOD.md). Реестр: [WEB_VERIFICATION_LEDGER.json](./WEB_VERIFICATION_LEDGER.json).\n\nПроверка целостности: ${s.valid ? 'PASS (учёт, не продукт)' : 'FAIL: ' + s.errors.join('; ')}.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'docs/WEB_VERIFICATION_LEDGER.json'), 'utf8'));
  const read = file => {
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Evidence outside repository');
    return fs.readFileSync(resolved);
  };
  const result = summarize(ledger, read);
  const archive=ledger.archive?loadArchive(ledger.archive,read,ledger.requirements):null;
  const output=process.argv.includes('--json') ? JSON.stringify(result, null, 2) + '\n'
    : process.argv.includes('--reviews')?reviewMarkdown(ledger,archive.data)
    : process.argv.includes('--defects')?defectsMarkdown(ledger,archive.data)
    : markdown(ledger, result);
  const offsetIndex=process.argv.indexOf('--offset'),lengthIndex=process.argv.indexOf('--length');
  const offset=offsetIndex<0?0:Number(process.argv[offsetIndex+1]),length=lengthIndex<0?output.length:Number(process.argv[lengthIndex+1]);
  process.stdout.write(output.slice(offset,offset+length));
  if (!result.valid) process.exitCode = 1;
}
