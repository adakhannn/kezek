// Read-only plan accounting. Never starts browser, application tests, network or DB work.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from './web-verification-report.mjs';

const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);

export function auditPlan(plan, ledger) {
  const errors = [];
  const active = ledger.requirements.filter(r => r.status !== 'excluded');
  if (plan.baselineId !== ledger.baseline.id || plan.scopeHash !== ledger.baseline.scopeHash) errors.push('Plan baseline mismatch');
  if (plan.applicableCount !== active.length) errors.push('Plan denominator mismatch');
  if (!plan.authorization?.planningOnly || plan.authorization.liveTestsAuthorized !== false || plan.authorization.automationResumeAuthorized !== false || plan.authorization.productChangesAuthorized !== false) errors.push('Plan must not authorize execution');
  if (plan.preparation?.countsAsAcceptedRequirements !== 0) errors.push('Preparation must not count as acceptance');
  const phaseIds = plan.phases.map(p => p.id);
  const packageIds = plan.phases.flatMap(p => p.packages.map(q => q.id));
  if (new Set(phaseIds).size !== phaseIds.length || new Set(packageIds).size !== packageIds.length) errors.push('Duplicate phase/package ID');
  if (!sameSet(plan.phases.flatMap(p => p.requirementIds), active.map(r => r.id))) errors.push('Requirements must be assigned exactly once');
  const blockers = new Set(plan.blockers.map(b => b.id));
  if (blockers.size !== plan.blockers.length) errors.push('Duplicate blocker ID');
  for (const p of plan.phases) {
    if (!sameSet(p.packages.flatMap(q => q.requirementIds), p.requirementIds)) errors.push(`Package partition mismatch: ${p.id}`);
    if (!p.why || !p.entry || !p.exit || p.blockers.some(id => !blockers.has(id))) errors.push(`Incomplete phase contract: ${p.id}`);
    for (const q of p.packages) {
      const expected = active.filter(r => q.areaIds.includes(r.areaId)).map(r => r.id);
      if (!q.caseFamilies || !q.requirementIds.length || !sameSet(q.requirementIds, expected)) errors.push(`Package scope mismatch: ${q.id}`);
    }
  }
  for (const b of plan.blockers) if (!b.owner || !b.exit || b.phaseIds.some(id => !phaseIds.includes(id))) errors.push(`Incomplete blocker: ${b.id}`);
  for (const f of plan.findings) if (!phaseIds.includes(f.phaseId)) errors.push(`Unknown finding phase: ${f.id}`);
  const unfinished = ledger.fixes.filter(f => ['fixed_pending_verification', 'historical_open_or_reopened'].includes(f.status)).map(f => f.id);
  if (!sameSet(plan.initialUnfinishedFixIds, unfinished) || !sameSet(plan.phases.flatMap(p => p.fixIds), unfinished)) errors.push('Initial unfinished defect partition mismatch');
  const provenance = ledger.fixes.filter(f => f.status === 'documented_historical_verified').map(f => f.id);
  if (plan.provenanceTrack.initialCount !== provenance.length || !sameSet(plan.provenanceTrack.ids, provenance)) errors.push('Provenance track mismatch');
  return errors;
}

export function closureSummary(plan, ledger, verification) {
  const errors = auditPlan(plan, ledger);
  if (!verification?.valid) errors.push('Ledger/evidence verification failed; no certified progress may be shown');
  let planned = 0;
  const phases = plan.phases.map(p => {
    const rows = ledger.requirements.filter(r => p.requirementIds.includes(r.id));
    planned += rows.length;
    const passed = rows.filter(r => r.status === 'passed').length;
    return { id: p.id, title: p.title, total: rows.length,
      priorityCounts: Object.fromEntries(['P0', 'P1', 'P2'].map(k => [k, rows.filter(r => r.priority === k).length])),
      actualAccepted: errors.length ? null : passed, actualRemaining: errors.length ? null : rows.length - passed,
      failed: rows.filter(r => r.status === 'failed').length, blocked: rows.filter(r => r.status === 'blocked').length,
      plannedCumulativeAccepted: planned, plannedRemaining: plan.applicableCount - planned,
      initialUnfinishedDefects: p.fixIds.length };
  });
  const accepted = ledger.requirements.filter(r => r.status === 'passed').length;
  return { valid: !errors.length, errors, baselineId: plan.baselineId, applicable: plan.applicableCount,
    actualAccepted: errors.length ? null : accepted, actualRemaining: errors.length ? null : plan.applicableCount - accepted,
    acceptancePercent: errors.length ? null : Math.round(accepted / plan.applicableCount * 1000) / 10,
    atomicExecutionPercent: verification?.executionPercent ?? null,
    initialUnfinishedDefects: plan.initialUnfinishedFixIds.length, provenanceQuestions: plan.provenanceTrack.initialCount,
    liveTestsStartedByPlan: false, releaseReady: !errors.length && verification.releaseReady, phases };
}

export function renderPlan(plan, ledger, s) {
  if (!s.valid) return '# План закрытия: ошибка учёта\n\n' + s.errors.map(e => `- ${e}`).join('\n') + '\n';
  const lines = [
    '# WEB: план закрытия оставшихся проверок', '',
    `План ${plan.id}; база ${plan.baselineId}; составлен 18 октября 2026. Сам план не разрешает и не запускает живые тесты. Фактические результаты ниже читаются из реестра; последующее разрешение на исполнение и текущий запуск указаны в nextBatch реестра. Автоматизация не возобновляется.`, '',
    '## Точка отсчёта', '',
    `- ${s.applicable} применимых исходных требований; 5 C2 исключены прежним решением social-only. Все ID распределены ровно по одному этапу и подпакету.`,
    `- Фактически полностью принято на текущем кандидате: **${s.actualAccepted}/${s.applicable}**; осталось **${s.actualRemaining}**. Это приёмка требований, не процент написанного приложения.`,
    '- 228 требований имеют частичные исторические доказательства; 121 узкое исправление исторически подтверждено. Их не обнуляем и не повторяем без причины, но непроверенные варианты не закрываем.',
    `- Входящий дефектный остаток: **${s.initialUnfinishedDefects} цепочек** (42 fixed/pending + 8 open/reopened), отдельно **${s.provenanceQuestions} вопроса доказательств**. Это не 82 новых бага и не дополнительные требования.`,
    '- Полная атомарная матрица ещё не заполнена: процент её исполнения пока не определён. Ниже конкретные владельцы требований и семейства случаев, а не фиктивные результаты тестов.', '',
    '## 0. Подготовка перед исполнением — не прибавляет PASS', '',
    ...plan.preparation.steps.map((v, i) => `${i + 1}. ${v}`), '',
    '## Очередь и контрольные числа', '',
    '**«Рубеж» — условный план: если все требования этапов до этой строки полностью приняты. Это не обещание закрыть блокеры и не фактический прогресс.** Факт всегда пересчитывается из реестра; промежуточный BLOCKED не позволяет поставить этапу DONE.', '',
    '| Этап | Требований (P0/P1/P2) | Факт принято / осталось в этапе | Плановый рубеж принято / осталось всего | Входящие цепочки WB |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...s.phases.map(p => `| ${p.id}. ${p.title} | ${p.total} (${p.priorityCounts.P0}/${p.priorityCounts.P1}/${p.priorityCounts.P2}) | ${p.actualAccepted} / ${p.actualRemaining} | ${p.plannedCumulativeAccepted} / ${p.plannedRemaining} | ${p.initialUnfinishedDefects} |`), '',
    'Порядок основан на риске и зависимостях, не только на номере P. Исходные приоритеты не изменены. Финальные P0 Q-проверки выполняются после стабилизации. Ошибки доступа, опасные эффекты и финансовые дефекты не откладываются ради косметики.', '',
    '## Содержание этапов', '',
  ];
  for (const p of plan.phases) {
    lines.push(`### ${p.id}. ${p.title}`, '', `**Почему сейчас:** ${p.why}`, '', `**Вход:** ${p.entry}`, '');
    for (const q of p.packages) lines.push(`- **${q.id} — ${q.title} (${q.requirementIds.length}).** Области: ${q.areaIds.join(', ')}. ${q.caseFamilies}`);
    lines.push('', `**Закрытие:** ${p.exit}`, '', `**Входящие незавершённые WB:** ${p.fixIds.length ? p.fixIds.join(', ') : 'нет в исходных 50; это не означает отсутствие непроверенных сценариев'}.`, '', `**Блокеры:** ${p.blockers.join(', ')}; общий UI-блокер применим ко всем живым шагам.`, '');
  }
  lines.push('## Незакрытые зависимости и условия выхода', '', '| ID | Что удерживает проверку | Кто / как снимается |', '| --- | --- | --- |');
  for (const b of plan.blockers) lines.push(`| ${b.id} | ${b.condition} | ${b.owner}. ${b.exit} |`);
  lines.push('', 'С текущими ограничениями нельзя обещать достижение 316/316: недоступные обязательные варианты сохраняются в остатке. Сокращённый пилот возможен только как отдельное согласованное решение, не как скрытое исключение пунктов.', '',
    '## Работа с 50 цепочками и 32 вопросами истории', '',
    'У каждой из 50 цепочек ровно один основной этап закрытия; проверки её влияния могут участвовать в других этапах без повторного счёта дефекта. Список — исходный backlog, не доказательство нового воспроизведения. При закрытии требуется связанное решение с repro, изменением, SAME-LIVE, адресными регрессиями и эффектами; новых находок ведём отдельную дельту.', '',
    plan.provenanceTrack.rule, '', `32 исходных ID: ${plan.provenanceTrack.ids.join(', ')}.`, '',
    'Отдельные находки, не новые подтверждённые WB: ' + plan.findings.map(f => `${f.id} → ${f.phaseId} (${f.basis})`).join('; ') + '.', '',
    '## Как фиксируется результат каждого подпакета', '',
    ...plan.executionRules.map((v, i) => `${i + 1}. ${v}`), '',
    'После каждого подпакета и этапа публикуется одна короткая дельта:', '',
    ...Object.entries(plan.checkpointTemplate).map(([k, v]) => `- ${k}: ${v}.`), '',
    'Пример формата, НЕ результат: «Было 10/316, стало 13/316 (+3), осталось 303. В подпакете принято 3/5, 1 FAIL, 1 BLOCKED. Следующий — S2.1; блокер с владельцем и условием выхода». Failed/blocked не входят в принятые. При признанном stale числитель честно уменьшается.', '',
    '«100% проверено» допустимо только для конкретного требования с конечными вариантами и подтверждёнными доказательствами. Это не гарантия отсутствия неизвестных ошибок. 316/316 отдельно от шести release gates и решения о выпуске.', '',
    '## Первый следующий блок после отдельного разрешения', '',
    'G0 → S1.1: зафиксировать кандидата, выбрать применимые старые доказательства, сформировать конечные случаи окружения/сборки; production-зависимости сразу выделить. Затем S1.2/S1.3 и S2.1. До новых изменяющих данные сценариев подтвердить их caller/role boundary. При недоступном production можно продолжить независимое разрешённое DEV-чтение, но S1 не объявлять полностью закрытым.', '',
    'Живые действия требуют отдельного разрешения пользователя; план сам его не выдаёт. Текущее исполнение сверяйте с nextBatch реестра и progress конкретного запуска. Старые запреты на endpoints, вкладки, credentials, новые fixtures и опасные команды сохраняются.', '',
    '## Источник и проверка счётчиков', '',
    '- [Машинный план с точными ID каждого подпакета](./WEB_CLOSURE_PLAN.json).',
    '- [Реестр результатов](./WEB_VERIFICATION_LEDGER.json) — единственный источник фактических статусов.',
    '- [Остаток и источники по каждому требованию](./WEB_EVIDENCE_REVIEW.md), [история дефектов](./WEB_HISTORICAL_DEFECTS.md), [метод](./WEB_VERIFICATION_METHOD.md).', '',
    '`node scripts/web-closure-plan.mjs --json` проверяет реестр/evidence, полноту распределения 316 ID, отсутствие дублей и распределение 50 цепочек / 32 вопросов. Без `--json` печатает эту сводку. Команда ничего не пишет; сохранение производного Markdown — явным patch. При ошибке evidence числа принятого не публикуются.', '',
    '`node --test scripts/web-closure-plan.test.mjs` проверяет только учёт плана, не Kezek. Исторические primary evidence, финальные отчёты и статусы требований планом не изменены.', ''
  );
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = name => {
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) throw new Error('Path outside repository');
    return fs.readFileSync(file);
  };
  const ledger = JSON.parse(read('docs/WEB_VERIFICATION_LEDGER.json'));
  const plan = JSON.parse(read('docs/WEB_CLOSURE_PLAN.json'));
  const result = closureSummary(plan, ledger, summarize(ledger, read));
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(result, null, 2) + '\n' : renderPlan(plan, ledger, result));
  if (!result.valid) process.exitCode = 1;
}
