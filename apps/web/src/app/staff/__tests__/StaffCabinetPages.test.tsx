/**
 * Базовые unit/интеграционные тесты для страниц staff‑кабинета:
 * - главный кабинет сотрудника
 * - список/создание записей
 * - расписание
 * - финансы и статистика
 *
 * Тесты рендерят компоненты через renderToString без jsdom, с моком i18n.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

import React from 'react';
import { renderToString } from 'react-dom/server';

import StaffCabinet from '../StaffCabinet';
import StaffBookingsView from '../bookings/StaffBookingsView';
import StaffSchedulePageClient from '../schedule/StaffSchedulePageClient';
import StaffFinancePageClient from '../../dashboard/staff/[id]/finance/StaffFinancePageClient';
import StaffFinanceStatsPageClient from '../../dashboard/staff/[id]/finance/stats/StaffFinanceStatsPageClient';
import SlotsClient from '../../dashboard/staff/[id]/slots/Client';

// Упрощаем сложный FinancePage, чтобы не поднимать React Query и сложные хуки в тестах
jest.mock('@/app/staff/finance/components/FinancePage', () => {
    return {
        FinancePage: ({ staffId }: { staffId?: string }) => (
            <div>{`FinancePage mock for ${staffId || 'current'}`}</div>
        ),
    };
});

// Мокаем next/link для серверного рендера
jest.mock('next/link', () => {
    return ({ href, children, ...rest }: { href?: string; children: React.ReactNode }) => (
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <a href={typeof href === 'string' ? href : '#'} {...rest}>
            {children}
        </a>
    );
});

// Мок i18n-провайдера, чтобы не тянуть реальный контекст
jest.mock('@/app/_components/i18n/LanguageProvider', () => {
    return {
        useLanguage: () => ({
            locale: 'ru' as const,
            t: (_key: string, fallback: string) => fallback,
        }),
    };
});

// Упрощаем date‑picker в слотах до простого input
jest.mock('@/components/pickers/DatePickerPopover', () => {
    return function DatePickerPopoverMock(props: { value: string; onChange: (value: string) => void }) {
        return (
            <input
                type="date"
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
            />
        );
    };
});

describe('Staff cabinet pages basic render', () => {
    test('StaffCabinet корректно рендерит услуги и счётчики записей', () => {
        const html = renderToString(
            <StaffCabinet
                userId="user-1"
                staffId="staff-1"
                staffName="Иван Иванов"
                avatarUrl={null}
                branch={{
                    id: 'branch-1',
                    name: 'Главный филиал',
                    address: 'г. Бишкек, ул. Тестовая, 1',
                }}
                services={[
                    {
                        id: 'svc-1',
                        name_ru: 'Стрижка',
                        duration_min: 60,
                        price_from: 1000,
                        price_to: 1500,
                    },
                ]}
                upcoming={[{ id: 1 }]}
                past={[{ id: 2 }, { id: 3 }]}
            />,
        );

        // Имя сотрудника и блоки кабинета
        expect(html).toContain('Иван Иванов');
        expect(html).toContain('Мои услуги');
        expect(html).toContain('Стрижка');
        expect(html).toContain('Мои записи');
        // Проверяем, что счётчики предстоящих/прошедших записей попали в рендер
        expect(html).toContain('Предстоящие');
        expect(html).toContain('Прошедшие');
    });

    test('StaffBookingsView отображает вкладки и базовую информацию о бронированиях', () => {
        const html = renderToString(
            <StaffBookingsView
                bizId="biz-1"
                staffId="staff-1"
                branchId="branch-1"
                upcoming={[
                    {
                        id: 'booking-up-1',
                        status: 'confirmed',
                        start_at: '2025-01-01T10:00:00.000Z',
                        end_at: '2025-01-01T11:00:00.000Z',
                        client_name: 'Клиент 1',
                        client_phone: '+996555000001',
                        services: {
                            name_ru: 'Маникюр',
                            duration_min: 60,
                        },
                        branches: {
                            name: 'Филиал 1',
                            lat: null,
                            lon: null,
                            address: 'Адрес 1',
                        },
                        businesses: {
                            name: 'Бизнес 1',
                            slug: 'biz-1',
                        },
                    },
                ]}
                past={[]}
                services={[]}
                staff={[]}
                branches={[
                    { id: 'branch-1', name: 'Филиал 1', is_active: true },
                ]}
            />,
        );

        expect(html).toContain('Мои записи');
        // Вкладка "Предстоящие" с количеством
        expect(html).toContain('Предстоящие');
        // Имя клиента и услуга тоже должны быть в рендере
        expect(html).toContain('Клиент 1');
        expect(html).toContain('Маникюр');
    });

    test('StaffSchedulePageClient рендерит заголовок и контекст бизнеса', () => {
        const html = renderToString(
            <StaffSchedulePageClient
                staffId="staff-1"
                staffName="Иван Иванов"
                bizName="Тестовый бизнес"
                bizCity="Бишкек"
            />,
        );

        expect(html).toContain('Моё расписание');
        expect(html).toContain('Просмотр вашего рабочего расписания');
    });

    test('StaffFinancePageClient отображает заголовок с именем сотрудника', () => {
        const html = renderToString(
            <StaffFinancePageClient id="staff-1" fullName="Иван Иванов" />,
        );

        expect(html).toContain('Управление сменой');
        expect(html).toContain('Иван Иванов');
    });

    test('StaffFinanceStatsPageClient отображает заголовок статистики', () => {
        const html = renderToString(
            <StaffFinanceStatsPageClient id="staff-1" fullName="Иван Иванов" />,
        );

        expect(html).toContain('Статистика по сотрудникам');
        expect(html).toContain('Иван Иванов');
    });

    test('SlotsClient рендерит фильтры и текст для пустых слотов', () => {
        const html = renderToString(
            <SlotsClient
                bizId="biz-1"
                staffId="staff-1"
                services={[]}
                branches={[]}
                defaultDate="2025-01-01"
            />,
        );

        expect(html).toContain('Фильтры свободных слотов');
        expect(html).toContain('Свободные слоты');
        // При отсутствии данных показываем подсказку "Нет свободных слотов"
        expect(html).toContain('Нет свободных слотов');
    });
});

