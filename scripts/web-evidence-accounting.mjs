// Validation and presentation of imported evidence, never product execution.
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const unique = values => new Set(values).size === values.length;
const count = (rows, key) => Object.fromEntries([...new Set(rows.map(r=>r[key]))].map(k=>[k,rows.filter(r=>r[key]===k).length]));
export const reviewLabels = {
  bounded_historical_evidence: 'Узкое историческое свидетельство',
  documented_only_primary_missing: 'Только документ; первичный файл не найден',
  support_or_blocker_only: 'Техническая проверка / блокер, не live PASS',
  no_targeted_evidence_located: 'Целевое свидетельство не найдено',
  excluded: 'Исключено: social-only',
};
export const defectLabels = {
  historically_verified_targeted: 'Исторический узкий SAME-LIVE',
  documented_historical_verified: 'Заявлено verified; первичный файл не найден',
  fixed_pending_verification: 'Исправлено; проверка не завершена',
  historical_open_or_reopened: 'Исторически open/reopened',
  retired_social_only: 'Историческое; вне social-only scope',
};
export function loadArchive(manifest, read, requirements) {
  const errors=[], data={};
  for(const [name, spec] of Object.entries(manifest.sections)) {
    try {
      const bytes=read(spec.path);
      if(sha(bytes)!==spec.sha256) errors.push(`Archive section hash mismatch: ${name}`);
      data[name]=bytes.toString('utf8').trimEnd().split('\n').filter(Boolean).map(line=>JSON.parse(line));
      if(data[name].length!==spec.rows) errors.push(`Archive row count mismatch: ${name}`);
    } catch { errors.push(`Unreadable archive section: ${name}`); data[name]=[]; }
  }
  for(const required of ['inventory','records','stages','reviews','references','snapshots','sourceLines']){
    if(!Object.hasOwn(data,required)){data[required]=[];errors.push(`Missing archive section: ${required}`);}
  }
  const {inventory=[],records=[],stages=[],reviews=[],references=[],snapshots=[],sourceLines=[]}=data;
  for(const [name,rows,key] of [['inventory',inventory,'id'],['paths',inventory,'path'],['defects',records,'id'],['stages',stages,'id'],['reviews',reviews,'requirementId']])
    if(!unique(rows.map(r=>r[key])))errors.push(`Duplicate archive identity: ${name}`);
  const assets=new Map(inventory.map(a=>[a.id,a]));
  for(const a of inventory) if(!a.path.startsWith('apps/web/test-results/') || a.path.split('/').includes('..')) errors.push(`Invalid archive path: ${a.id}`);
  const byReq=new Map(requirements.map(r=>[r.id,r]));
  if(reviews.length!==requirements.length)errors.push('Archive requirement audit incomplete');
  for(const review of reviews) {
    const r=byReq.get(review.requirementId);
    if(!r||r.requirement!==review.requirement||r.areaId!==review.areaId)errors.push(`Review scope mismatch: ${review.requirementId}`);
    if(r?.historicalAssessment&&r.historicalAssessment!==review.assessment)errors.push(`Review/ledger drift: ${review.requirementId}`);
    if(!reviewLabels[review.assessment]||!review.auditComplete||review.currentCertification!==false)errors.push(`Invalid historical assessment: ${review.requirementId}`);
    if(review.assessment==='bounded_historical_evidence'&&!review.refs.some(ref=>['historical_stage_mixed_assertions','direct_archived_primary_record'].includes(ref.evidenceGrade)&&ref.evidenceIds.some(id=>['stage_manifest','run_summary'].includes(assets.get(id)?.category))))errors.push(`Unsupported historical mapping: ${review.requirementId}`);
    for(const ref of review.refs) {
      if(ref.evidenceIds.some(id=>!assets.has(id)))errors.push(`Missing mapped evidence: ${review.requirementId}`);
      if(ref.defectId&&!records.some(b=>b.id===ref.defectId))errors.push(`Unknown mapped defect: ${ref.defectId}`);
    }
  }
  for(const b of records) {
    if(b.currentCertification||b.countedAsNewFix)errors.push(`Historical defect promoted: ${b.id}`);
    if(sha(b.exactHistoricalRecord)!==b.source.excerptSHA256)errors.push(`Defect excerpt changed: ${b.id}`);
    if([...b.evidenceIds,...b.directEvidenceIds,...b.contextualStageIds].some(id=>!assets.has(id)))errors.push(`Unknown defect evidence: ${b.id}`);
    if(b.evidenceGrade==='direct_archived_primary_record'&&!b.directEvidenceIds.some(id=>['stage_manifest','run_summary'].includes(assets.get(id)?.category)))errors.push(`No direct primary record: ${b.id}`);
  }
  for(const s of snapshots) {
    const lines=sourceLines.filter(l=>l.path===s.path);
    if(lines.some((l,i)=>l.line!==i+1)||sha(lines.map(l=>l.text).join('\n'))!==s.sha256)errors.push(`Source snapshot mismatch: ${s.path}`);
  }
  for(const stage of stages) {
    if(!assets.has(stage.fileId)||stage.currentCertification||stage.countAsAtomicTest)errors.push(`Invalid historical stage: ${stage.id}`);
  }
  for(const r of manifest.reconciliations||[]) {
    try {
      const record=records.find(b=>b.id===r.id),asset=assets.get(r.evidenceIds[0]);
      const observed=JSON.parse(read(r.path).toString('utf8'))[r.pointer.slice(1)];
      if(!record||record.status!==r.previousStatus||asset?.path!==r.path||observed!==r.exactValue||!r.scope||r.status!=='historically_verified_targeted')throw Error('invalid');
    }catch{errors.push(`Invalid explicit follow-up: ${r.id}`);}
  }
  const active=reviews.filter(r=>r.assessment!=='excluded');
  return {data,errors,metrics:{
    files:inventory.length,bytes:inventory.reduce((n,a)=>n+a.bytes,0),sourceDocuments:snapshots.length,
    stageAndSummaryRecords:stages.length,defectRecords:records.length,uniqueOriginalDefectIds:new Set(records.map(r=>r.originalId)).size,
    requirementsReviewed:active.length,reviewCounts:count(active,'assessment'),
    missingLiteralFileReferences:references.filter(r=>r.status==='unresolved_literal_reference').length,
    fileCategories:count(inventory,'category'),
    rawJSONFiles:inventory.filter(a=>a.jsonState).length,invalidRawJSON:inventory.filter(a=>a.jsonState==='invalid_preserved').length,
    currentHistoricalPassPromotions:0,
  }};
}
const cell = s => String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
export function archiveMarkdown(ledger,s) {
  const a=s.archive, counts=s.defectCounts;
  return `# WEB: проверяемый прогресс\n\nСрез учёта: ${ledger.updatedUtc}. База ${ledger.baseline.id}. Импорт истории сохранён отдельно от новых случаев текущего кандидата. Этот генератор ничего не тестирует и не изменяет.\n\n`+
    `## Текущая приёмка\n\nПринято **${s.counts.passed}/${s.applicable} (${s.acceptancePercent ?? 'INVALID'}%)**, осталось **${s.applicable-s.counts.passed}**. Это приёмка исходных требований, не процент написанного продукта. Текущие caseIds, шаги, среда, evidence и ограничения находятся в реестре. Процент исполнения атомарной матрицы: **${s.executionPercent ?? 'не определён: матрица ещё не завершена'}**.\n\n`+
    `Новые находки текущего реестра: **${s.currentFindings?.total || 0}**, открыты **${s.currentFindings?.open || 0}**, исправление и повторная проверка подтверждены **${s.currentFindings?.verified || 0}**. Они не смешиваются с импортом старых WB.\n\n`+
    (ledger.currentFindings || []).map(f => `- ${f.id}: ${f.title} — ${f.status}; требования ${f.requirementIds.join(', ')}; evidence ${f.evidenceIds.join(', ')}.\n`).join('')+
    `\n## Результат разбора\n\n`+
    `- **${a.files}/${a.files} файлов** доступного архива внесены в опись с SHA-256; ${a.stageAndSummaryRecords} stage/final/progress JSON-записей проиндексированы, включая проверки без исправлений, FAIL и служебные стадии. Это не число тестов.\n`+
    `- **${a.requirementsReviewed}/${s.applicable} применимых обязательств классифицированы — 100% разбора**. 5 пунктов C2 исключены существующим social-only решением. Ни один блокер не удалён из знаменателя.\n`+
    `- **${a.defectRecords} записей дефектов**, ${a.uniqueOriginalDefectIds} исходных WB-номера: две разные WB-045 получили уточняющие суффиксы, пример WB-001 исключён; WB-165/166 разделены.\n`+
    `- **${a.missingLiteralFileReferences} точных ссылок на файлы июня/июля не разрешаются** в рабочем архиве. Старые утверждения сохранены, но первичные доказательства не выдуманы.\n\n`+
    `## Что исправлено\n\n| Состояние исторической записи | Количество |\n| --- | ---: |\n`+
    Object.entries(defectLabels).map(([key,label])=>`| ${label} | ${counts[key]||0} |`).join('\n')+
    `\n\n${counts.historically_verified_targeted} — подтверждённые **узкие исторические исправления**, а не столько полностью готовых функций. В карточках сохранены исходные шаги, ожидание/факт, retest, ограничения и IDs. Включён WB-082: последующий G005 явно подтвердил clear→30→persist, хотя старый баг-реестр остался в fixed locally. Это уточнение истории, не новый фикс. ${counts.documented_historical_verified} старых verified без первичных файлов в это число не включены. Исторически открытое не объявляется свежевоспроизведённым. По дефектам остаются **${counts.fixed_pending_verification+counts.historical_open_or_reopened} незавершённых цепочек** (${counts.fixed_pending_verification} ретестов/границ и ${counts.historical_open_or_reopened} open/reopened), плюс ${counts.documented_historical_verified} вопросов восстановления доказательств.\n\n`+
    `## Что осталось проверить\n\n| Сопоставление обязательств | Количество | Доля от ${s.applicable} |\n| --- | ---: | ---: |\n`+
    Object.entries(reviewLabels).filter(([key])=>key!=='excluded').map(([key,label])=>`| ${label} | ${a.reviewCounts[key]||0} | ${((a.reviewCounts[key]||0)/s.applicable*100).toFixed(1)}% |`).join('\n')+
    `\n\nЭти группы не являются PASS/FAIL тестами: даже у пункта с доказательствами могут оставаться непроверенные варианты. **${s.applicable-s.counts.passed}/${s.applicable} обязательств ещё не имеют полной приёмки текущего кандидата**; это не «100% приложения нужно написать заново». Для каждого пункта указан собственный остаток в [подробном разборе](./WEB_EVIDENCE_REVIEW.md). Общий процент оставшейся разработки и часов из этой истории вывести нельзя.\n\n`+
    `Ближайшая измеримая работа — принимать конечные наборы случаев по одному требованию. Исторические успешные случаи сохраняются; повторять их без изменения зависимости/среды не требуется. Точный процент исполнения атомарных тестов появляется после утверждения их конечной матрицы, а не из количества стадий или найденных багов.\n\n`+
    `## Что препятствует выпуску\n\n`+ledger.releaseGates.map(g=>`- ${g.id}: ${g.description} — ${g.status}.`).join('\n')+
    `\n\nОтдельно: G141 и G145 содержат суммарно 6 красных UNIT assertions, не 6 подтверждённых live-багов. Матрица устройств и screen reader не закрыта. Прежние baseline/coverage/lint FAIL сохранены; scoped PASS их не отменяет. Никакого нового GO: **${s.releaseReady?'READY_FOR_REVIEW':'NOT_READY'}**.\n\n`+
    `Источник: [единый реестр](./WEB_VERIFICATION_LEDGER.json), [проверки и остаток по каждому требованию](./WEB_EVIDENCE_REVIEW.md), [204 карточки дефектов](./WEB_HISTORICAL_DEFECTS.md), [метод](./WEB_VERIFICATION_METHOD.md). Первичные файлы не перемещались и не изменялись. Старые изображения инвентаризированы, но не выдаются за заново просмотренные visual/device PASS.\n\n`+
    `Проверка целостности и учёта: **${s.valid?'PASS':'FAIL: '+s.errors.join('; ')}** — не проверка приложения. Автоматизация этим отчётом не возобновляется.\n`;
}
export function reviewMarkdown(ledger,archive) {
  let out='# WEB: доказательства и точный остаток\n\nВсе 321 исходное обязательство сохранены; 316 применимы. Ни одна строка ниже не является полной текущей приёмкой. «Не найдено» означает результат аудита доступных файлов, а не утверждение, что никто никогда этого не проверял. Ссылки G/L/N ведут к неизменённым исходным stage; before/after и failed-прототипы не удалены.\n\n';
  const assets=new Map(archive.inventory.map(a=>[a.id,a]));
  for(const area of [...new Set(archive.reviews.map(r=>r.areaId))]) {
    const rows=archive.reviews.filter(r=>r.areaId===area);
    out+=`## ${area}\n\nНайденная граница: ${rows[0].knownAreaBoundary}\n\nОстаток: **${rows[0].remainingAreaBoundary}**\n\n| ID и исходное обязательство | Результат разбора | Источники |\n| --- | --- | --- |\n`;
    out+=rows.map(r=>`| ${r.requirementId}: ${cell(r.requirement)} | ${reviewLabels[r.assessment]} | ${r.refs.map(ref=>ref.defectId?`[${ref.defectId}](./WEB_HISTORICAL_DEFECTS.md#${ref.defectId.toLowerCase().replace('@','')})`:ref.evidenceIds.map((id,i)=>`[${ref.token}${ref.evidenceIds.length>1?'/'+(i+1):''}](../${assets.get(id).path})`).join(', ')).join('; ')||'—'} |`).join('\n')+'\n\n';
  }
  return out.trimEnd()+'\n';
}
export function defectsMarkdown(ledger,archive) {
  const assets=new Map(archive.inventory.map(a=>[a.id,a]));
  let out='# WEB: исторические карточки дефектов\n\n204 реальные записи / 203 исходных WB-номера. Это импорт, не новые исправления. Две WB-045 — разные дефекты; объединённая WB-165/166 разделена, шаблон WB-001 исключён. Точный текст каждой карточки со всеми шагами/ожиданием/фактом/ограничениями сохранён в records.jsonl; исходный баг-реестр не переписывался.\n\n';
  for(const b of [...archive.records].sort((a,b)=>a.id.localeCompare(b.id))) {
    const f=ledger.fixes.find(x=>x.id===b.id);
    out+=`## ${b.id}\n\n${cell(b.title)}\n\n- Уровень: ${b.severity}; состояние: **${defectLabels[f.status]}**.\n- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#${b.originalId.toLowerCase()}); сохранённый диапазон строк ${b.source.startLine}–${b.source.endLine}; SHA-256 фрагмента: ${b.source.excerptSHA256}.\n- [Архивный снимок карточки ${archive.records.indexOf(b)+1}](./verification/records.jsonl) содержит полный текст, включая ограничения.\n`;
    const proofIds=[...new Set([...b.directEvidenceIds,...(f.reconciliation?.evidenceIds||[])])];
    out+=proofIds.length?`- Прямо названные найденные доказательства: ${proofIds.map(id=>`[${pathLabel(assets.get(id).path)}](../${assets.get(id).path})`).join(', ')}.\n`:'- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.\n';
    if(f.reconciliation)out+=`- Уточнение старого статуса отдельным follow-up: ${f.reconciliation.scope} Исходная карточка сохранена без перезаписи.\n`;
    out+=`- Граница: ${cell(f.excludes||b.limitation)}\n\n`;
  }
  return out.trimEnd()+'\n';
}
function pathLabel(p){return p.split('/').at(-1);}
