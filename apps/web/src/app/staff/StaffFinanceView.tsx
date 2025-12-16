'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TZ } from '@/lib/time';

type ShiftItem = {
    id?: string;
    clientName: string;
    serviceName: string;
    amount: number;
    note?: string;
};

type Shift = {
    id: string;
    shift_date: string;
    opened_at: string | null;
    closed_at: string | null;
    expected_start: string | null;
    late_minutes: number;
    status: 'open' | 'closed';
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    percent_master: number;
    percent_salon: number;
};

type Stats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalLateMinutes: number;
    shiftsCount: number;
};

type TodayResponse =
    | {
          ok: true;
          today:
              | { exists: false; status: 'none'; shift: null; items: ShiftItem[] }
              | { exists: true; status: 'open' | 'closed'; shift: Shift; items: ShiftItem[] };
          stats: Stats;
      }
    | { ok: false; error: string };

function formatTime(iso: string | null) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

export default function StaffFinanceView() {
    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState<TodayResponse | null>(null);

    const [items, setItems] = useState<ShiftItem[]>([]);
    const [consumables, setConsumables] = useState('');
    const [staffPercentMaster, setStaffPercentMaster] = useState(60);
    const [staffPercentSalon, setStaffPercentSalon] = useState(40);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/staff/shift/today', { cache: 'no-store' });
            const json: TodayResponse = await res.json();
            setToday(json);
            if (json.ok && json.today.exists && json.today.shift) {
                const sh = json.today.shift;
                const loadedItems = (json.today.items ?? []).map((it: {
                    id?: string;
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    amount?: number;
                    note?: string;
                }) => ({
                    id: it.id,
                    clientName: it.clientName ?? it.client_name ?? '',
                    serviceName: it.serviceName ?? it.service_name ?? '',
                    amount: Number(it.amount ?? 0) || 0,
                    note: it.note,
                }));
                setItems(loadedItems);
                setConsumables(sh.consumables_amount ? String(sh.consumables_amount) : '');
            } else {
                setItems([]);
                setConsumables('');
            }
            // Проценты из настроек сотрудника (не из смены)
            if (json.ok && 'staffPercentMaster' in json && 'staffPercentSalon' in json) {
                setStaffPercentMaster(Number(json.staffPercentMaster ?? 60));
                setStaffPercentSalon(Number(json.staffPercentSalon ?? 40));
            }
        } catch (e) {
            console.error('Error loading today shift:', e);
            setToday({ ok: false, error: 'Не удалось загрузить данные смены' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handleOpenShift = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/staff/shift/open', { method: 'POST' });
            const json = await res.json();
            if (!json.ok) {
                alert(json.error || 'Не удалось открыть смену');
            }
            await load();
        } catch (e) {
            console.error('Error opening shift:', e);
            alert('Ошибка при открытии смены');
        } finally {
            setSaving(false);
        }
    };

    const handleCloseShift = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/staff/shift/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    consumablesAmount: Number(consumables || 0),
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                alert(json.error || 'Не удалось закрыть смену');
            }
            await load();
        } catch (e) {
            console.error('Error closing shift:', e);
            alert('Ошибка при закрытии смены');
        } finally {
            setSaving(false);
        }
    };

    const todayShift = today && today.ok && today.today.exists ? today.today.shift : null;
    const isOpen = todayShift && todayShift.status === 'open';
    const isClosed = todayShift && todayShift.status === 'closed';

    const stats: Stats | null = today && today.ok ? today.stats : null;

    const totalFromItems = items.reduce(
        (sum, it) => sum + (Number(it.amount ?? 0) || 0),
        0
    );

    const net =
        totalFromItems -
        Number(consumables || 0) >= 0
            ? totalFromItems - Number(consumables || 0)
            : 0;
    const pM = staffPercentMaster;
    const pS = staffPercentSalon;
    const ps = pM + pS || 100;
    const mShare = Math.round((net * pM) / ps);
    // Доля салона = остаток от чистой суммы + 100% расходников
    const sShareFromNet = Math.max(0, net - mShare);
    const sShare = sShareFromNet + Number(consumables || 0);

    const todayLabel = new Date().toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    return (
        <main className="mx-auto max-w-4xl p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Финансы
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Управление сменой и просмотр общей статистики
                </p>
            </div>

            <Card variant="elevated" className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Текущая смена
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {todayLabel} ({TZ})
                        </div>
                        {todayShift && (
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                <div>Открыта: {formatTime(todayShift.opened_at)}</div>
                                <div>
                                    Плановый старт:{' '}
                                    {todayShift.expected_start
                                        ? formatTime(todayShift.expected_start)
                                        : 'не задан'}
                                </div>
                                <div>
                                    Опоздание:{' '}
                                    {todayShift.late_minutes > 0
                                        ? `${todayShift.late_minutes} мин`
                                        : 'нет'}
                                </div>
                            </div>
                        )}
                    </div>
                     <div className="flex gap-2 items-center flex-wrap">
                         {!todayShift && (
                             <Button
                                 variant="primary"
                                 onClick={handleOpenShift}
                                 disabled={loading || saving}
                                 isLoading={saving}
                             >
                                 Открыть смену
                             </Button>
                         )}
                         {isOpen && (
                             <>
                                 <Button
                                     variant="outline"
                                     onClick={load}
                                     disabled={loading || saving}
                                 >
                                     Обновить
                                 </Button>
                                 <Button
                                     variant="primary"
                                     onClick={handleCloseShift}
                                     disabled={saving}
                                     isLoading={saving}
                                 >
                                     Закрыть смену
                                 </Button>
                             </>
                         )}
                         {isClosed && (
                             <>
                                 <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                                     Смена закрыта
                                 </div>
                                 <Button
                                     variant="outline"
                                     onClick={handleOpenShift}
                                     disabled={saving}
                                     isLoading={saving}
                                 >
                                     Переоткрыть смену
                                 </Button>
                             </>
                         )}
                     </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Сумма за услуги (сом)
                            </label>
                            <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                                {totalFromItems} сом
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Считается автоматически по списку клиентов ниже
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Расходники (сом)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                value={consumables}
                                onChange={(e) => setConsumables(e.target.value)}
                                disabled={!isOpen}
                                min={0}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Доля мастера (%)
                                </label>
                                <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">
                                    {staffPercentMaster}%
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Из настроек сотрудника
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Доля салона (%)
                                </label>
                                <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">
                                    {staffPercentSalon}%
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Из настроек сотрудника
                                </p>
                            </div>
                        </div>

                        <div className="mt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    Чистая сумма (после расходников)
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {net} сом
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    Доля мастера
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {mShare} сом
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    Доля салона (включая расходники)
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {sShare} сом
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Примечание: расходники 100% идут салону
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Таблица клиентов за смену */}
            <Card variant="elevated" className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Клиенты за смену
                    </h2>
                    {isOpen && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setItems((prev) => [
                                    ...prev,
                                    { clientName: '', serviceName: '', amount: 0, note: '' },
                                ])
                            }
                            disabled={saving}
                        >
                            Добавить клиента
                        </Button>
                    )}
                </div>

                {items.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Пока нет добавленных клиентов. Добавьте хотя бы одну строку и укажите сумму,
                        чтобы посчитать выручку за смену.
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        {items.map((item, idx) => (
                            <div
                                key={item.id ?? idx}
                                className="grid grid-cols-[2fr,2fr,1fr,auto] gap-2 items-center"
                            >
                                <input
                                    type="text"
                                    placeholder="Клиент"
                                    className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                                    value={item.clientName}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setItems((prev) =>
                                            prev.map((it, i) =>
                                                i === idx ? { ...it, clientName: v } : it
                                            )
                                        );
                                    }}
                                    disabled={!isOpen}
                                />
                                <input
                                    type="text"
                                    placeholder="Услуга / комментарий"
                                    className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                                    value={item.serviceName}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setItems((prev) =>
                                            prev.map((it, i) =>
                                                i === idx ? { ...it, serviceName: v } : it
                                            )
                                        );
                                    }}
                                    disabled={!isOpen}
                                />
                                <input
                                    type="number"
                                    min={0}
                                    className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-right"
                                    value={item.amount}
                                    onChange={(e) => {
                                        const v = Number(e.target.value || 0);
                                        setItems((prev) =>
                                            prev.map((it, i) =>
                                                i === idx ? { ...it, amount: v } : it
                                            )
                                        );
                                    }}
                                    disabled={!isOpen}
                                />
                                {isOpen && (
                                    <button
                                        type="button"
                                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                        onClick={() =>
                                            setItems((prev) => prev.filter((_, i) => i !== idx))
                                        }
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {stats && (
                <Card variant="elevated" className="p-6 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Общая статистика по сменам
                        </h2>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Всего закрытых смен: {stats.shiftsCount}
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                            <div className="text-gray-600 dark:text-gray-400">Общая выручка</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {stats.totalAmount} сом
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-gray-600 dark:text-gray-400">Сумма мастера</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {stats.totalMaster} сом
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-gray-600 dark:text-gray-400">Сумма салона</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {stats.totalSalon} сом
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        Суммарное опоздание: {stats.totalLateMinutes} минут
                    </div>
                </Card>
            )}
        </main>
    );
}


