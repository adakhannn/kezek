/**
 * Утилиты для экспорта данных финансовых операций
 */

import { formatInTimeZone } from 'date-fns-tz';

import type { ShiftItem, Shift } from '../types';

import { TZ } from '@/lib/time';

/**
 * Экспортирует список клиентов в CSV формат
 */
export function exportClientsToCSV(
    items: ShiftItem[],
    shift: Shift | null,
    shiftDate: Date,
    staffName?: string
): void {
    // Заголовки CSV
    const headers = [
        'Дата',
        'Сотрудник',
        'Клиент',
        'Услуга',
        'Сумма услуги (сом)',
        'Расходники (сом)',
        'Итого (сом)',
        'Время создания',
    ];

    // Данные
    const rows = items.map((item) => {
        const total = (item.serviceAmount || 0) + (item.consumablesAmount || 0);
        const createdAt = item.createdAt
            ? formatInTimeZone(new Date(item.createdAt), TZ, 'dd.MM.yyyy HH:mm')
            : '-';

        return [
            formatInTimeZone(shiftDate, TZ, 'dd.MM.yyyy'),
            staffName || '-',
            item.clientName || '-',
            item.serviceName || '-',
            (item.serviceAmount || 0).toFixed(2),
            (item.consumablesAmount || 0).toFixed(2),
            total.toFixed(2),
            createdAt,
        ];
    });

    // Объединяем заголовки и данные
    const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    // Добавляем BOM для корректного отображения кириллицы в Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Создаем ссылку для скачивания
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clients_${formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Экспортирует сводку по смене в CSV формат
 */
export function exportShiftSummaryToCSV(
    shift: Shift | null,
    calculations: {
        displayTotalAmount: number;
        masterShare: number;
        salonShare: number;
        totalConsumables: number;
    },
    items: ShiftItem[],
    shiftDate: Date,
    staffName?: string
): void {
    const headers = ['Параметр', 'Значение'];
    
    const rows = [
        ['Дата смены', formatInTimeZone(shiftDate, TZ, 'dd.MM.yyyy')],
        ['Сотрудник', staffName || '-'],
        ['Статус', shift?.status === 'closed' ? 'Закрыта' : shift?.status === 'open' ? 'Открыта' : 'Не создана'],
        ['', ''],
        ['ОБОРОТ', ''],
        ['Общий оборот (сом)', calculations.displayTotalAmount.toFixed(2)],
        ['Расходники (сом)', calculations.totalConsumables.toFixed(2)],
        ['', ''],
        ['РАСПРЕДЕЛЕНИЕ', ''],
        ['Сотруднику (сом)', calculations.masterShare.toFixed(2)],
        ['Бизнесу (сом)', calculations.salonShare.toFixed(2)],
        ['', ''],
        ['ДЕТАЛИ', ''],
        ['Количество клиентов', items.length.toString()],
        ['Часы работы', shift?.hours_worked ? shift.hours_worked.toFixed(2) : '-'],
        ['Почасовая ставка', shift?.hourly_rate ? `${shift.hourly_rate.toFixed(2)} сом/час` : '-'],
        ['Гарантированная оплата', shift?.guaranteed_amount ? `${shift.guaranteed_amount.toFixed(2)} сом` : '-'],
        ['Доплата', shift?.topup_amount ? `${shift.topup_amount.toFixed(2)} сом` : '-'],
    ];

    const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shift_summary_${formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

