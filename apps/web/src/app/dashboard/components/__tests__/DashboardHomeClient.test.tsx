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

jest.mock('../IntegrationsStatusCard', () => ({
    IntegrationsStatusCard: () => <div>Integrations status</div>,
}));

describe('DashboardHomeClient', () => {
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
        expect(screen.getByText('Integrations status')).toBeTruthy();
        expect(screen.getByRole('link', { name: /Открыть «Календарь»/i }).getAttribute('href')).toBe(
            '/dashboard/bookings',
        );
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
        expect(screen.getByText('Давайте доведём кабинет до рабочего состояния.')).toBeTruthy();
        expect(screen.getByText('Создайте хотя бы один филиал, чтобы клиенты могли записываться.')).toBeTruthy();
        expect(screen.getByText('Добавьте услуги и укажите продолжительность и цену.')).toBeTruthy();
        expect(screen.getByText('Добавьте сотрудников и укажите, кто оказывает какие услуги.')).toBeTruthy();
    });
});
