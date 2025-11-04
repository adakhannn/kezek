'use client';

import { useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/pickers/DatePicker';
import DateRangePicker from '@/components/pickers/DateRangePicker';
import TimeRangeList, { TimeRange } from '@/components/pickers/TimeRangeList';
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
        <div className="border rounded p-3 space-y-3">
            <div className="font-medium">{DOW[dow]}</div>
            <TimeRangeList label="Интервалы рабочего времени" items={iv} onChange={setIv} />
            <TimeRangeList label="Перерывы (опционально)" items={br} onChange={setBr} />
            <button className="border rounded px-3 py-1" disabled={saving}
                    onClick={() => onSave(dow, iv, br)}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
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
        <section className="border rounded p-4 space-y-4">
            <div className="flex gap-2">
                {(['weekly', 'rules', 'timeoff'] as const).map((k) => (
                    <button key={k}
                            className={`px-3 py-1 border rounded ${tab === k ? 'bg-gray-100 font-medium' : ''}`}
                            onClick={() => setTab(k)}>
                        {k === 'weekly' ? 'Еженедельно' : k === 'rules' ? 'Исключения (правила)' : 'Отпуска'}
                    </button>
                ))}
            </div>

            {tab === 'weekly' && (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                        Пустой список интервалов = день нерабочий.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {Array.from({ length: 7 }, (_, i) => i).map((dow) => (
                            <WeekRow key={dow} dow={dow} row={whByDow[dow]} saving={savingWH} onSave={saveWH} />
                        ))}
                    </div>
                </div>
            )}

            {tab === 'rules' && (
                <div className="space-y-4">
                    <div className="border rounded p-3 space-y-3">
                        <div className="font-medium">Новое правило</div>

                        <div className="grid sm:grid-cols-3 gap-3 items-start">
                            <select
                                className="border rounded px-2 py-1"
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
                                    className="border rounded px-2 py-1"
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
                                className="border rounded px-2 py-1"
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
                                className="border rounded px-2 py-1"
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

                        <div className="flex items-center gap-3">
                            <label className="text-sm">Приоритет</label>
                            <input
                                type="number"
                                className="border rounded px-2 py-1 w-24"
                                value={formRule.priority ?? 0}
                                onChange={(e) => setFormRule((r) => ({ ...r, priority: Number(e.target.value) }))}
                            />
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={formRule.is_active ?? true}
                                    onChange={(e) => setFormRule((r) => ({ ...r, is_active: e.target.checked }))}
                                />
                                Активно
                            </label>
                            <button className="border rounded px-3 py-1" disabled={savingRule || otherBranches.length === 0}
                                    onClick={addRule} title={otherBranches.length === 0 ? 'Нет других филиалов' : undefined}>
                                {savingRule ? 'Сохраняем…' : 'Добавить правило'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="font-medium mb-2">Существующие правила</div>
                        <div className="space-y-2">
                            {rules.map((r) => (
                                <div key={r.id} className="border rounded p-2 flex items-center justify-between">
                                    <div className="text-sm">
                                        <div>
                                            <b>{r.kind}</b>{' '}
                                            {r.kind === 'weekly' && `(${DOW[r.day_of_week ?? 0]})`}
                                            {r.kind === 'date' && `(${r.date_on})`}
                                            {r.kind === 'range' && `(${r.date_from} → ${r.date_to})`}
                                        </div>
                                        <div>
                                            Филиал:&nbsp;
                                            {branches.find((b) => b.id === r.branch_id)?.name ?? r.branch_id}
                                        </div>
                                        <div>
                                            Интервалы: {intervalsToStr(r.intervals)}; Перерывы: {intervalsToStr(r.breaks)}
                                        </div>
                                        <div>
                                            TZ: {r.tz}; Приоритет: {r.priority}; {r.is_active ? 'Активно' : 'Отключено'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="border rounded px-2 py-1 text-xs"
                                                onClick={() => toggleRule(r.id, !r.is_active)}>
                                            {r.is_active ? 'Отключить' : 'Включить'}
                                        </button>
                                        <button className="border rounded px-2 py-1 text-xs"
                                                onClick={() => deleteRule(r.id)}>
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {rules.length === 0 && <div className="text-sm text-gray-500">Правил пока нет</div>}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'timeoff' && (
                <div className="space-y-3">
                    <div className="border rounded p-3 space-y-2">
                        <div className="font-medium">Новый отпуск/отсутствие</div>
                        <div className="grid sm:grid-cols-3 gap-2 items-start">
                            <DatePicker
                                value={formTO.date_from || null}
                                onChange={(v) => setFormTO((f) => ({ ...f, date_from: v || '' }))}
                            />
                            <DatePicker
                                value={formTO.date_to || null}
                                onChange={(v) => setFormTO((f) => ({ ...f, date_to: v || '' }))}
                            />
                            <input
                                className="border rounded px-2 py-1"
                                placeholder="Причина"
                                value={formTO.reason || ''}
                                onChange={(e) => setFormTO((f) => ({ ...f, reason: e.target.value }))}
                            />
                        </div>
                        <button className="border rounded px-3 py-1" disabled={savingTO} onClick={addTO}>
                            {savingTO ? 'Сохраняем…' : 'Добавить'}
                        </button>
                    </div>

                    <div>
                        <div className="font-medium mb-2">Список отсутствий</div>
                        <div className="space-y-2">
                            {timeoff.map((t) => (
                                <div key={t.id} className="border rounded p-2 flex items-center justify-between">
                                    <div className="text-sm">
                                        {t.date_from} → {t.date_to} {t.reason ? `— ${t.reason}` : ''}
                                    </div>
                                    <button className="border rounded px-2 py-1 text-xs"
                                            onClick={() => deleteTO(t.id)}>
                                        Удалить
                                    </button>
                                </div>
                            ))}
                            {timeoff.length === 0 && <div className="text-sm text-gray-500">Отсутствий нет</div>}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
