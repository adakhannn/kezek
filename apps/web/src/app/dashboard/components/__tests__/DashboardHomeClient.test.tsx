/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { DashboardHomeClient } from '../DashboardHomeClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        locale: 'ru' as const,
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

describe('DashboardHomeClient', () => {
    test('prioritizes pending applications over setup and hides the focus when processed', () => {
        const props = {
            bizName: 'Business', bizCity: null, formattedDate: '2026-09-17T00:00:00Z',
            bookingsToday: 0, staffActive: 0, servicesActive: 0, branchesCount: 0,
            needOnboarding: true, ratingScore: null, ratingConfigScope: null, ratingWeights: null,
        };
        const { rerender } = render(<DashboardHomeClient {...props} staffApplications={{ pending: 2 }} />);
        expect(screen.getByText('Заявки сотрудников · 2')).toBeTruthy();
        expect(screen.getByRole('link', { name: /Рассмотреть заявки/ }).getAttribute('href')).toBe('/dashboard/role-applications');
        expect(screen.queryByText('Сначала доведите кабинет до рабочего состояния')).toBeNull();
        rerender(<DashboardHomeClient {...props} staffApplications={{ pending: 0 }} />);
        expect(screen.queryByText('Заявки сотрудников · 2')).toBeNull();
        expect(screen.getByText('Сначала доведите кабинет до рабочего состояния')).toBeTruthy();
    });
    test('рендерит базовый dashboard summary и быстрые действия', () => {
        render(
            <DashboardHomeClient
                bizName="Kezek Studio"
                bizCity="Almaty"
                formattedDate="2026-03-22T00:00:00.000Z"
                bookingsToday={8}
                staffActive={4}
                servicesActive={12}
                branchesCount={2}
                needOnboarding={false}
                ratingScore={87.4}
                ratingConfigScope="biz"
                ratingWeights={{
                    reviews: 30,
                    productivity: 25,
                    loyalty: 25,
                    discipline: 20,
                    windowDays: 30,
                }}
            />,
        );

        expect(screen.getByText('Kezek Studio')).toBeTruthy();
        expect(screen.getByText('Быстрые действия')).toBeTruthy();
        expect(screen.queryByText('Статус интеграций')).toBeNull();
        expect(
            screen
                .getAllByRole('link', { name: /Открыть календарь/i })
                .some((link) => link.getAttribute('href') === '/dashboard/bookings'),
        ).toBe(true);
        expect(screen.getByRole('link', { name: /Добавить сотрудника/i }).getAttribute('href')).toBe(
            '/dashboard/staff/new',
        );
        expect(screen.getByText('87.4')).toBeTruthy();
    });

    test('показывает onboarding-подсказки и fallback имя бизнеса', () => {
        render(
            <DashboardHomeClient
                bizName={null}
                bizCity={null}
                formattedDate="2026-03-22T00:00:00.000Z"
                bookingsToday={0}
                staffActive={0}
                servicesActive={0}
                branchesCount={0}
                needOnboarding
                ratingScore={null}
                ratingConfigScope={null}
                ratingWeights={null}
            />,
        );

        expect(screen.getByText('Ваш бизнес в Kezek')).toBeTruthy();
        expect(screen.getByText('Давай доведём кабинет до рабочего состояния.')).toBeTruthy();
        expect(screen.getAllByText('Создай хотя бы один филиал, чтобы клиенты могли записываться.').length).toBeGreaterThan(0);
        expect(screen.getByText('Добавь услуги и укажи продолжительность и цену.')).toBeTruthy();
        expect(screen.getByText('Добавь сотрудников и укажи, кто оказывает какие услуги.')).toBeTruthy();
    });
});
