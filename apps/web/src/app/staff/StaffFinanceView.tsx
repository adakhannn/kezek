'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TZ } from '@/lib/time';

type ShiftItem = {
    id?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    note?: string;
};

type Booking = {
    id: string;
    client_name: string | null;
    client_phone: string | null;
    start_at: string;
    services: { name_ru: string } | { name_ru: string }[] | null;
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
    hours_worked?: number | null;
    hourly_rate?: number | null;
    guaranteed_amount?: number;
    topup_amount?: number;
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
          bookings?: Booking[];
          staffPercentMaster?: number;
          staffPercentSalon?: number;
          hourlyRate?: number | null;
          currentHoursWorked?: number | null;
          currentGuaranteedAmount?: number | null;
          isDayOff?: boolean;
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
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [staffPercentMaster, setStaffPercentMaster] = useState(60);
    const [staffPercentSalon, setStaffPercentSalon] = useState(40);
    const [hourlyRate, setHourlyRate] = useState<number | null>(null);
    const [currentHoursWorked, setCurrentHoursWorked] = useState<number | null>(null);
    const [currentGuaranteedAmount, setCurrentGuaranteedAmount] = useState<number | null>(null);
    const [isDayOff, setIsDayOff] = useState(false);
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
                    serviceAmount?: number;
                    amount?: number; // для обратной совместимости
                    consumablesAmount?: number;
                    consumables_amount?: number; // для обратной совместимости
                    bookingId?: string | null;
                    booking_id?: string | null; // для обратной совместимости
                    note?: string;
                }) => ({
                    id: it.id,
                    clientName: it.clientName ?? it.client_name ?? '',
                    serviceName: it.serviceName ?? it.service_name ?? '',
                    serviceAmount: Number(it.serviceAmount ?? it.amount ?? 0) || 0,
                    consumablesAmount: Number(it.consumablesAmount ?? it.consumables_amount ?? 0) || 0,
                    bookingId: it.bookingId ?? it.booking_id ?? null,
                    note: it.note,
                }));
                setItems(loadedItems);
            } else {
                setItems([]);
            }
            // Записи за сегодня для выбора клиентов
            if (json.ok && 'bookings' in json && Array.isArray(json.bookings)) {
                setBookings(json.bookings);
            }
            // Проценты из настроек сотрудника (не из смены)
            if (json.ok && 'staffPercentMaster' in json && 'staffPercentSalon' in json) {
                setStaffPercentMaster(Number(json.staffPercentMaster ?? 60));
                setStaffPercentSalon(Number(json.staffPercentSalon ?? 40));
            }
            // Выходной день
            if (json.ok && 'isDayOff' in json) {
                setIsDayOff(Boolean(json.isDayOff));
            }
            // Ставка за час и текущие часы работы
            if (json.ok && 'hourlyRate' in json) {
                setHourlyRate(json.hourlyRate ?? null);
            }
            if (json.ok && 'currentHoursWorked' in json) {
                setCurrentHoursWorked(json.currentHoursWorked ?? null);
            }
            if (json.ok && 'currentGuaranteedAmount' in json) {
                setCurrentGuaranteedAmount(json.currentGuaranteedAmount ?? null);
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

    // Сумма услуг = сумма всех serviceAmount
    const totalServiceFromItems = items.reduce(
        (sum, it) => sum + (Number(it.serviceAmount ?? 0) || 0),
        0
    );
    // Сумма расходников = сумма всех consumablesAmount
    const totalConsumablesFromItems = items.reduce(
        (sum, it) => sum + (Number(it.consumablesAmount ?? 0) || 0),
        0
    );

    const totalAmount = totalServiceFromItems;
    const finalConsumables = totalConsumablesFromItems;

    const net = totalAmount - finalConsumables >= 0 ? totalAmount - finalConsumables : 0;
    const pM = staffPercentMaster;
    const pS = staffPercentSalon;
    const ps = pM + pS || 100;
    const mShare = Math.round((net * pM) / ps);
    // Доля салона = остаток от чистой суммы + 100% расходников
    const sShareFromNet = Math.max(0, net - mShare);
    const sShare = sShareFromNet + finalConsumables;

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
                                {isOpen && hourlyRate && currentHoursWorked !== null && currentGuaranteedAmount !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Оплата за выход
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Отработано:</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {currentHoursWorked.toFixed(2)} ч
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Ставка:</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {hourlyRate} сом/ч
                                                </span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                    К получению за выход:
                                                </span>
                                                <span className="font-semibold text-green-600 dark:text-green-400">
                                                    {currentGuaranteedAmount.toFixed(2)} сом
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                     <div className="flex gap-2 items-center flex-wrap">
                         {!todayShift && (
                             <>
                                 {isDayOff ? (
                                     <div className="text-sm text-amber-600 dark:text-amber-400 font-medium px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                                         Сегодня у вас выходной день. Нельзя открыть смену.
                                     </div>
                                 ) : (
                                     <Button
                                         variant="primary"
                                         onClick={handleOpenShift}
                                         disabled={loading || saving || isDayOff}
                                         isLoading={saving}
                                     >
                                         Открыть смену
                                     </Button>
                                 )}
                             </>
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
                                {totalAmount} сом
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Считается автоматически по списку клиентов ниже
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Расходники (сом)
                            </label>
                            <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                                {finalConsumables} сом
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Считается автоматически по списку клиентов ниже
                            </p>
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
                            {todayShift && todayShift.hourly_rate && todayShift.hours_worked !== null && todayShift.hours_worked !== undefined && (
                                <>
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Оплата за выход
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Отработано часов
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {todayShift.hours_worked.toFixed(2)} ч
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Ставка за час
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {todayShift.hourly_rate} сом/ч
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Гарантированная сумма за выход
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {todayShift.guaranteed_amount?.toFixed(2) ?? '0.00'} сом
                                                </span>
                                            </div>
                                            {todayShift.topup_amount && todayShift.topup_amount > 0 && (
                                                <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                        Доплата владельца
                                                    </span>
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                        +{todayShift.topup_amount.toFixed(2)} сом
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                    Итого к получению
                                                </span>
                                                <span className="font-semibold text-green-600 dark:text-green-400">
                                                    {((todayShift.guaranteed_amount ?? 0) + (todayShift.topup_amount ?? 0)).toFixed(2)} сом
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
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
                                    { clientName: '', serviceName: '', serviceAmount: 0, consumablesAmount: 0, bookingId: null, note: '' },
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
                        Пока нет добавленных клиентов. Добавьте клиента из записей или введите вручную, укажите суммы за услугу и расходники.
                    </p>
                ) : (
                    <div className="space-y-3 text-sm">
                        {items.map((item, idx) => {
                            const usedBookingIds = items.filter((it, i) => i !== idx && it.bookingId).map(it => it.bookingId);
                            const availableBookings = bookings.filter(b => !usedBookingIds.includes(b.id));
                            
                            return (
                                <div
                                    key={item.id ?? idx}
                                    className="grid grid-cols-[2fr,2fr,1fr,1fr,auto] gap-2 items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                    <div>
                                        <select
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                                            value={item.bookingId ?? ''}
                                            onChange={(e) => {
                                                const bookingId = e.target.value || null;
                                                const booking = bookingId ? bookings.find(b => b.id === bookingId) : null;
                                                const service = booking?.services 
                                                    ? (Array.isArray(booking.services) ? booking.services[0] : booking.services)
                                                    : null;
                                                setItems((prev) =>
                                                    prev.map((it, i) =>
                                                        i === idx ? {
                                                            ...it,
                                                            bookingId,
                                                            clientName: booking ? (booking.client_name || booking.client_phone || '') : it.clientName,
                                                            serviceName: service ? service.name_ru : it.serviceName,
                                                        } : it
                                                    )
                                                );
                                            }}
                                            disabled={!isOpen}
                                        >
                                            <option value="">Выберите клиента из записей...</option>
                                            {availableBookings.map((b) => {
                                                const service = b.services 
                                                    ? (Array.isArray(b.services) ? b.services[0] : b.services)
                                                    : null;
                                                const clientLabel = b.client_name || b.client_phone || 'Клиент';
                                                const serviceLabel = service?.name_ru || '';
                                                const time = new Date(b.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                                                return (
                                                    <option key={b.id} value={b.id}>
                                                        {clientLabel} - {serviceLabel} ({time})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {!item.bookingId && (
                                            <input
                                                type="text"
                                                placeholder="Или введите имя клиента"
                                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
                                                value={item.clientName}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === idx ? { ...it, clientName: v, bookingId: null } : it
                                                        )
                                                    );
                                                }}
                                                disabled={!isOpen}
                                            />
                                        )}
                                    </div>
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
                                        placeholder="Услуга"
                                        className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-right"
                                        value={item.serviceAmount || ''}
                                        onChange={(e) => {
                                            const v = Number(e.target.value || 0);
                                            setItems((prev) =>
                                                prev.map((it, i) =>
                                                    i === idx ? { ...it, serviceAmount: v } : it
                                                )
                                            );
                                        }}
                                        disabled={!isOpen}
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        placeholder="Расходники"
                                        className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-right"
                                        value={item.consumablesAmount || ''}
                                        onChange={(e) => {
                                            const v = Number(e.target.value || 0);
                                            setItems((prev) =>
                                                prev.map((it, i) =>
                                                    i === idx ? { ...it, consumablesAmount: v } : it
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
                            );
                        })}
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


