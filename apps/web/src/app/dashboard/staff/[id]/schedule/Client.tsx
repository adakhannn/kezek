'use client';

import { useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/pickers/DatePicker';
import DateRangePicker from '@/components/pickers/DateRangePicker';
import TimeRangeList, { TimeRange } from '@/components/pickers/TimeRangeList';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabaseClient';

type Branch = { id: string; name: string };
type WH = { id: string; day_of_week: number; intervals: TimeRange[]; breaks: TimeRange[] };
type Rule = {
    id: string;
    kind: 'weekly' | 'date' | 'range';
    day_of_week: number | null;
    date_on: string | null;
    date_from: string | null;
    date_to: string | null;
    branch_id: string;
    tz: string;
    intervals: TimeRange[];
    breaks: TimeRange[];
    is_active: boolean;
    priority: number;
};
type TimeOff = { id: string; date_from: string; date_to: string; reason: string | null };

const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function intervalsToStr(j: TimeRange[]): string {
    try {
        const arr = Array.isArray(j) ? j : [];
        return arr.map((x) => `${x.start}-${x.end}`).join(', ');
    } catch {
        return '';
    }
}

/* child row (hooks вне циклов) */
function WeekRow({
                     dow, row, saving, onSave,
                 }: {
    dow: number;
    row: WH | undefined;
    saving: boolean;
    onSave: (dow: number, intervals: TimeRange[], breaks: TimeRange[]) => void;
}) {
    const [iv, setIv] = useState<TimeRange[]>(row?.intervals ?? []);
    const [br, setBr] = useState<TimeRange[]>(row?.breaks ?? []);
    useEffect(() => { setIv(row?.intervals ?? []); }, [row?.intervals]);
    useEffect(() => { setBr(row?.breaks ?? []); }, [row?.breaks]);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="font-semibold text-gray-900 dark:text-gray-100">{DOW[dow]}</div>
            <TimeRangeList label="Интервалы рабочего времени" items={iv} onChange={setIv} />
            <TimeRangeList label="Перерывы (опционально)" items={br} onChange={setBr} />
            <Button variant="outline" size="sm" disabled={saving} isLoading={saving}
                    onClick={() => onSave(dow, iv, br)}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
        </div>
    );
}

export default function Client({
                                   bizId, staffId, branches, homeBranchId,
                               }: {
    bizId: string;
    staffId: string;
    branches: Branch[];
    homeBranchId: string; // ← родной филиал сотрудника
}) {
    const [tab, setTab] = useState<'weekly' | 'rules' | 'timeoff'>('weekly');

    // Только чужие филиалы доступны для «правил-исключений»
    const otherBranches = useMemo(
        () => branches.filter((b) => b.id !== homeBranchId),
        [branches, homeBranchId]
    );

    // WEEKLY
    const [wh, setWh] = useState<WH[]>([]);
    const whByDow: Record<number, WH | undefined> = useMemo(() => {
        const map: Record<number, WH | undefined> = {};
        for (const row of wh) map[row.day_of_week] = row;
        return map;
    }, [wh]);
    const [savingWH, setSavingWH] = useState(false);

    // RULES
    const [rules, setRules] = useState<Rule[]>([]);
    const [savingRule, setSavingRule] = useState(false);
    const [formRule, setFormRule] = useState<Partial<Rule>>({
        kind: 'date',
        day_of_week: null, date_on: null, date_from: null, date_to: null,
        branch_id: otherBranches[0]?.id ?? '', // по умолчанию — первый «чужой»
        tz: 'Asia/Bishkek',
        intervals: [], breaks: [], is_active: true, priority: 0,
    });

    // если список филиалов/родной филиал меняются — не позволяем держать родной в состоянии
    useEffect(() => {
        setFormRule((r) => {
            if (!r.branch_id || r.branch_id === homeBranchId) {
                return { ...r, branch_id: otherBranches[0]?.id ?? '' };
            }
            return r;
        });
    }, [otherBranches, homeBranchId]);

    // TIME OFF
    const [timeoff, setTimeoff] = useState<TimeOff[]>([]);
    const [savingTO, setSavingTO] = useState(false);
    const [formTO, setFormTO] = useState<Partial<TimeOff>>({
        date_from: '', date_to: '', reason: '',
    });

    // load all
    useEffect(() => {
        let ignore = false;
        (async () => {
            const [whRes, rulesRes, toRes] = await Promise.all([
                supabase.from('working_hours')
                    .select('id, day_of_week, intervals, breaks')
                    .eq('biz_id', bizId).eq('staff_id', staffId)
                    .order('day_of_week'),
                supabase.from('staff_schedule_rules')
                    .select('id, kind, day_of_week, date_on, date_from, date_to, branch_id, tz, intervals, breaks, is_active, priority')
                    .eq('biz_id', bizId).eq('staff_id', staffId)
                    .order('created_at', { ascending: false }),
                supabase.from('staff_time_off')
                    .select('id, date_from, date_to, reason')
                    .eq('biz_id', bizId).eq('staff_id', staffId)
                    .order('date_from', { ascending: false }),
            ]);
            if (ignore) return;
            setWh(whRes.data ?? []);
            setRules(rulesRes.data ?? []);
            setTimeoff(toRes.data ?? []);
        })();
        return () => { ignore = true; };
    }, [bizId, staffId]);

    /* WEEKLY save */
    async function saveWH(dow: number, intervals: TimeRange[], breaks: TimeRange[]) {
        setSavingWH(true);
        try {
            const existing = whByDow[dow];

            if ((intervals ?? []).length === 0) {
                if (existing?.id) {
                    await supabase.from('working_hours')
                        .delete().eq('id', existing.id).eq('biz_id', bizId).eq('staff_id', staffId);
                }
            } else if (existing?.id) {
                await supabase.from('working_hours').update({
                    intervals, breaks: breaks ?? [],
                }).eq('id', existing.id).eq('biz_id', bizId).eq('staff_id', staffId);
            } else {
                await supabase.from('working_hours').insert({
                    biz_id: bizId, staff_id: staffId, day_of_week: dow, intervals, breaks: breaks ?? [],
                });
            }
            const { data } = await supabase.from('working_hours')
                .select('id, day_of_week, intervals, breaks')
                .eq('biz_id', bizId).eq('staff_id', staffId)
                .order('day_of_week');
            setWh(data ?? []);
        } finally {
            setSavingWH(false);
        }
    }

    /* RULES CRUD */
    async function addRule() {
        setSavingRule(true);
        try {
            if (!formRule.branch_id) {
                alert('Выберите филиал (не родной)');
                return;
            }
            if (formRule.branch_id === homeBranchId) {
                alert('Исключение можно создавать только для другого филиала');
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = {
                biz_id: bizId, staff_id: staffId,
                kind: formRule.kind,
                branch_id: formRule.branch_id,
                tz: formRule.tz || 'Asia/Bishkek',
                intervals: formRule.intervals ?? [],
                breaks: formRule.breaks ?? [],
                is_active: formRule.is_active ?? true,
                priority: formRule.priority ?? 0,
                day_of_week: null, date_on: null, date_from: null, date_to: null,
            };

            if (formRule.kind === 'weekly') {
                payload.day_of_week = formRule.day_of_week;
            } else if (formRule.kind === 'date') {
                payload.date_on = formRule.date_on;
            } else {
                payload.date_from = formRule.date_from;
                payload.date_to = formRule.date_to;
            }

            const { error } = await supabase.from('staff_schedule_rules').insert(payload);
            if (error) return alert(error.message);

            const { data } = await supabase.from('staff_schedule_rules')
                .select('id, kind, day_of_week, date_on, date_from, date_to, branch_id, tz, intervals, breaks, is_active, priority')
                .eq('biz_id', bizId).eq('staff_id', staffId)
                .order('created_at', { ascending: false });
            setRules(data ?? []);
            setFormRule((r) => ({ ...r, intervals: [], breaks: [] }));
        } finally {
            setSavingRule(false);
        }
    }

    async function toggleRule(id: string, isActive: boolean) {
        const { error } = await supabase.from('staff_schedule_rules')
            .update({ is_active: isActive }).eq('id', id).eq('biz_id', bizId).eq('staff_id', staffId);
        if (error) return alert(error.message);
        setRules((rs) => rs.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)));
    }

    async function deleteRule(id: string) {
        const { error } = await supabase.from('staff_schedule_rules')
            .delete().eq('id', id).eq('biz_id', bizId).eq('staff_id', staffId);
        if (error) return alert(error.message);
        setRules((rs) => rs.filter((r) => r.id !== id));
    }

    /* TIME OFF */
    async function addTO() {
        setSavingTO(true);
        try {
            const { error } = await supabase.from('staff_time_off').insert({
                biz_id: bizId, staff_id: staffId,
                date_from: formTO.date_from, date_to: formTO.date_to, reason: formTO.reason || null,
            });
            if (error) return alert(error.message);
            const { data } = await supabase.from('staff_time_off')
                .select('id, date_from, date_to, reason')
                .eq('biz_id', bizId).eq('staff_id', staffId)
                .order('date_from', { ascending: false });
            setTimeoff(data ?? []);
            setFormTO({ date_from: '', date_to: '', reason: '' });
        } finally {
            setSavingTO(false);
        }
    }

    async function deleteTO(id: string) {
        const { error } = await supabase.from('staff_time_off')
            .delete().eq('id', id).eq('biz_id', bizId).eq('staff_id', staffId);
        if (error) return alert(error.message);
        setTimeoff((t) => t.filter((x) => x.id !== id));
    }

    /* UI */
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Расписание сотрудника</h2>
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                {(['weekly', 'rules', 'timeoff'] as const).map((k) => (
                    <button
                        key={k}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            tab === k
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                                : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setTab(k)}
                    >
                        {k === 'weekly' ? 'Еженедельно' : k === 'rules' ? 'Исключения (правила)' : 'Отпуска'}
                    </button>
                ))}
            </div>

            {tab === 'weekly' && (
                <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            Пустой список интервалов = день нерабочий.
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {Array.from({ length: 7 }, (_, i) => i).map((dow) => (
                            <WeekRow key={dow} dow={dow} row={whByDow[dow]} saving={savingWH} onSave={saveWH} />
                        ))}
                    </div>
                </div>
            )}

            {tab === 'rules' && (
                <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Новое правило</h3>

                        <div className="grid sm:grid-cols-3 gap-4 items-start">
                            <select
                                className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                value={formRule.kind}
                                onChange={(e) =>
                                    setFormRule((r) => ({
                                        ...r,
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        kind: e.target.value as any,
                                        day_of_week: null,
                                        date_on: null,
                                        date_from: null,
                                        date_to: null,
                                    }))
                                }
                            >
                                <option value="date">На дату</option>
                                <option value="range">Диапазон дат</option>
                                <option value="weekly">Еженедельно (правило)</option>
                            </select>

                            {formRule.kind === 'weekly' && (
                                <select
                                    className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                    value={formRule.day_of_week ?? ''}
                                    onChange={(e) =>
                                        setFormRule((r) => ({ ...r, day_of_week: Number(e.target.value) }))
                                    }
                                >
                                    <option value="">День недели…</option>
                                    {Array.from({ length: 7 }, (_, i) => i).map((i) => (
                                        <option key={i} value={i}>
                                            {DOW[i]}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {formRule.kind === 'date' && (
                                <DatePicker
                                    className="sm:col-span-2 w-full"
                                    value={formRule.date_on ?? null}
                                    onChange={(v) => setFormRule((r) => ({ ...r, date_on: v }))}
                                />
                            )}

                            {formRule.kind === 'range' && (
                                <DateRangePicker
                                    className="sm:col-span-2 w-full"
                                    from={formRule.date_from ?? null}
                                    to={formRule.date_to ?? null}
                                    onChange={(v) =>
                                        setFormRule((r) => ({ ...r, date_from: v.from, date_to: v.to }))
                                    }
                                />
                            )}

                            {/* ВЫБОР ТОЛЬКО ИЗ "ЧУЖИХ" ФИЛИАЛОВ */}
                            <select
                                className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                                value={formRule.branch_id || ''}
                                onChange={(e) => setFormRule((r) => ({ ...r, branch_id: e.target.value }))}
                                disabled={otherBranches.length === 0}
                                title={otherBranches.length === 0 ? 'Нет других филиалов' : undefined}
                            >
                                {otherBranches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>

                            <input
                                className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                placeholder="TZ"
                                value={formRule.tz || 'Asia/Bishkek'}
                                onChange={(e) => setFormRule((r) => ({ ...r, tz: e.target.value }))}
                            />
                        </div>

                        <TimeRangeList
                            label="Интервалы рабочего времени"
                            items={formRule.intervals ?? []}
                            onChange={(arr) => setFormRule((r) => ({ ...r, intervals: arr }))}
                        />
                        <TimeRangeList
                            label="Перерывы (опционально)"
                            items={formRule.breaks ?? []}
                            onChange={(arr) => setFormRule((r) => ({ ...r, breaks: arr }))}
                        />

                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Приоритет</label>
                                <input
                                    type="number"
                                    className="px-3 py-1.5 w-24 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                    value={formRule.priority ?? 0}
                                    onChange={(e) => setFormRule((r) => ({ ...r, priority: Number(e.target.value) }))}
                                />
                            </div>
                            <label className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formRule.is_active ?? true}
                                    onChange={(e) => setFormRule((r) => ({ ...r, is_active: e.target.checked }))}
                                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Активно</span>
                            </label>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={savingRule || otherBranches.length === 0}
                                onClick={addRule}
                                isLoading={savingRule}
                                title={otherBranches.length === 0 ? 'Нет других филиалов' : undefined}
                            >
                                {savingRule ? 'Сохраняем…' : 'Добавить правило'}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Существующие правила</h3>
                        <div className="space-y-3">
                            {rules.map((r) => (
                                <div key={r.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <div className="text-sm space-y-1">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">
                                            <b>{r.kind}</b>{' '}
                                            {r.kind === 'weekly' && `(${DOW[r.day_of_week ?? 0]})`}
                                            {r.kind === 'date' && `(${r.date_on})`}
                                            {r.kind === 'range' && `(${r.date_from} → ${r.date_to})`}
                                        </div>
                                        <div className="text-gray-600 dark:text-gray-400">
                                            Филиал: {branches.find((b) => b.id === r.branch_id)?.name ?? r.branch_id}
                                        </div>
                                        <div className="text-gray-600 dark:text-gray-400">
                                            Интервалы: {intervalsToStr(r.intervals)}; Перерывы: {intervalsToStr(r.breaks)}
                                        </div>
                                        <div className="text-gray-600 dark:text-gray-400">
                                            TZ: {r.tz}; Приоритет: {r.priority};{' '}
                                            <span className={r.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                                                {r.is_active ? 'Активно' : 'Отключено'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleRule(r.id, !r.is_active)}
                                        >
                                            {r.is_active ? 'Отключить' : 'Включить'}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => deleteRule(r.id)}
                                        >
                                            Удалить
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {rules.length === 0 && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    Правил пока нет
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'timeoff' && (
                <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Новый отпуск/отсутствие</h3>
                        <div className="grid sm:grid-cols-3 gap-4 items-start">
                            <DatePicker
                                value={formTO.date_from || null}
                                onChange={(v) => setFormTO((f) => ({ ...f, date_from: v || '' }))}
                            />
                            <DatePicker
                                value={formTO.date_to || null}
                                onChange={(v) => setFormTO((f) => ({ ...f, date_to: v || '' }))}
                            />
                            <input
                                className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                placeholder="Причина"
                                value={formTO.reason || ''}
                                onChange={(e) => setFormTO((f) => ({ ...f, reason: e.target.value }))}
                            />
                        </div>
                        <Button variant="outline" disabled={savingTO} onClick={addTO} isLoading={savingTO}>
                            {savingTO ? 'Сохраняем…' : 'Добавить'}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Список отсутствий</h3>
                        <div className="space-y-3">
                            {timeoff.map((t) => (
                                <div key={t.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {t.date_from} → {t.date_to} {t.reason ? `— ${t.reason}` : ''}
                                    </div>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => deleteTO(t.id)}
                                    >
                                        Удалить
                                    </Button>
                                </div>
                            ))}
                            {timeoff.length === 0 && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    Отсутствий нет
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
