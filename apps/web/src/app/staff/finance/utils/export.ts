/**
 * Утилиты для экспорта данных финансовых операций
 */

import { formatInTimeZone } from 'date-fns-tz';

import type { ShiftItem, Shift } from '../types';

import { financeDateLabel } from './calendar';
import { shiftSummaryAmounts } from './summaryAmounts';

import { toCsv } from '@/lib/csv';
import { TZ } from '@/lib/time';

type Translate = (key: string, fallback: string) => string;
/** Without the UI translator the Russian headers stay (FE-10). */
const keepRussian: Translate = (_key, fallback) => fallback;

/**
 * Экспортирует список клиентов в CSV формат
 */
export function exportClientsToCSV(
    items: ShiftItem[],
    shift: Shift | null,
    shiftDate: Date,
    staffName?: string,
    t: Translate = keepRussian,
): void {
    // Заголовки CSV
    const headers = [
        t('staff.finance.export.date', 'Дата'),
        t('staff.finance.export.staff', 'Сотрудник'),
        t('staff.finance.export.client', 'Клиент'),
        t('staff.finance.export.service', 'Услуга'),
        t('staff.finance.export.serviceAmount', 'Сумма услуги (сом)'),
        t('staff.finance.export.consumables', 'Расходники (сом)'),
        t('staff.finance.export.total', 'Итого (сом)'),
        t('staff.finance.export.createdAt', 'Время создания'),
    ];

    // Данные
    const rows = items.map((item) => {
        const total = (item.serviceAmount || 0) + (item.consumablesAmount || 0);
        const createdAt = item.createdAt
            ? formatInTimeZone(new Date(item.createdAt), TZ, 'dd.MM.yyyy HH:mm')
            : '-';

        return [
            financeDateLabel(shiftDate)!.split('-').reverse().join('.'),
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
    const csvContent = toCsv([headers, ...rows]);

    // Добавляем BOM для корректного отображения кириллицы в Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Создаем ссылку для скачивания
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clients_${financeDateLabel(shiftDate)}.csv`;
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
    staffName?: string,
    t: Translate = keepRussian,
): void {
    const headers = [t('staff.finance.export.parameter', 'Параметр'), t('staff.finance.export.value', 'Значение')];
    const revenue = shiftSummaryAmounts(calculations);
    
    const rows = [
        [t('staff.finance.export.shiftDate', 'Дата смены'), financeDateLabel(shiftDate)!.split('-').reverse().join('.')],
        [t('staff.finance.export.staff', 'Сотрудник'), staffName || '-'],
        [t('staff.finance.export.status', 'Статус'), shift?.status === 'closed' ? t('staff.finance.export.statusClosed', 'Закрыта') : shift?.status === 'open' ? t('staff.finance.export.statusOpen', 'Открыта') : t('staff.finance.export.statusNone', 'Не создана')],
        ['', ''],
        [t('staff.finance.export.revenueSection', 'ОБОРОТ'), ''],
        [t('staff.finance.export.revenueTotal', 'Общий оборот (сом)'), revenue.total.toFixed(2)],
        [t('staff.finance.export.servicesAmount', 'Сумма услуг (сом)'), revenue.services.toFixed(2)],
        [t('staff.finance.export.consumables', 'Расходники (сом)'), revenue.consumables.toFixed(2)],
        ['', ''],
        [t('staff.finance.export.shareSection', 'РАСПРЕДЕЛЕНИЕ'), ''],
        [t('staff.finance.export.staffShare', 'Сотруднику (сом)'), calculations.masterShare.toFixed(2)],
        [t('staff.finance.export.businessShare', 'Бизнесу (сом)'), calculations.salonShare.toFixed(2)],
        ['', ''],
        [t('staff.finance.export.detailsSection', 'ДЕТАЛИ'), ''],
        [t('staff.finance.export.clientCount', 'Количество клиентов'), items.length.toString()],
        [t('staff.finance.export.hoursWorked', 'Часы работы'), shift?.hours_worked ? shift.hours_worked.toFixed(2) : '-'],
        [t('staff.finance.export.hourlyRate', 'Почасовая ставка'), shift?.hourly_rate ? t('staff.finance.export.perHour', '{amount} сом/час').replace('{amount}', shift.hourly_rate.toFixed(2)) : '-'],
        [t('staff.finance.export.guaranteed', 'Гарантированная оплата'), shift?.guaranteed_amount ? t('finance.money', '{amount} сом').replace('{amount}', shift.guaranteed_amount.toFixed(2)) : '-'],
        [t('staff.finance.export.topup', 'Доплата'), shift?.topup_amount ? t('finance.money', '{amount} сом').replace('{amount}', shift.topup_amount.toFixed(2)) : '-'],
    ];

    const csvContent = toCsv([headers, ...rows]);

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shift_summary_${financeDateLabel(shiftDate)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

