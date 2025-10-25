'use client';

import { useState } from 'react';

export type TimeRange = { start: string; end: string };

function normalize(t: string) {
    // гарантируем формат HH:MM
    if (!t) return '';
    const [h, m] = t.split(':');
    const hh = String(Math.min(23, Math.max(0, Number(h) || 0))).padStart(2,'0');
    const mm = String(Math.min(59, Math.max(0, Number(m) || 0))).padStart(2,'0');
    return `${hh}:${mm}`;
}

export default function TimeRangeList({
                                          label,
                                          items,
                                          onChange,
                                      }: {
    label: string;
    items: TimeRange[];
    onChange: (next: TimeRange[]) => void;
}) {
    const [draft, setDraft] = useState<TimeRange>({ start: '09:00', end: '18:00' });

    function add() {
        const s = normalize(draft.start);
        const e = normalize(draft.end);
        if (!s || !e) return;
        if (s >= e) return alert('Начало должно быть раньше конца');
        onChange([...items, { start: s, end: e }]);
    }
    function removeAt(i: number) {
        const next = items.slice();
        next.splice(i,1);
        onChange(next);
    }
    function replaceAt(i: number, patch: Partial<TimeRange>) {
        const next = items.slice();
        next[i] = { ...next[i], ...patch };
        onChange(next);
    }

    return (
        <div>
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="flex gap-2 items-center mb-2">
                <input type="time" className="border rounded px-2 py-1" value={draft.start}
                       onChange={(e)=>setDraft(d=>({...d, start: e.target.value}))}/>
                <span className="text-sm">—</span>
                <input type="time" className="border rounded px-2 py-1" value={draft.end}
                       onChange={(e)=>setDraft(d=>({...d, end: e.target.value}))}/>
                <button className="border rounded px-2 py-1" onClick={add}>Добавить</button>
            </div>

            <div className="space-y-2">
                {items.map((tr, i)=>(
                    <div key={i} className="flex items-center gap-2">
                        <input type="time" className="border rounded px-2 py-1"
                               value={tr.start}
                               onChange={e=>replaceAt(i, { start: e.target.value })}/>
                        <span className="text-sm">—</span>
                        <input type="time" className="border rounded px-2 py-1"
                               value={tr.end}
                               onChange={e=>replaceAt(i, { end: e.target.value })}/>
                        <button className="border rounded px-2 py-1" onClick={()=>removeAt(i)}>Удалить</button>
                    </div>
                ))}
                {items.length===0 && <div className="text-xs text-gray-400">Пока пусто</div>}
            </div>
        </div>
    );
}
