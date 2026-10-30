/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ClientEditForm } from '@/app/staff/finance/components/ClientEditForm';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';
import { staffKy } from '@/app/_components/i18n/dictionaries/staff.ky';
import { staffEn } from '@/app/_components/i18n/dictionaries/staff.en';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
const dictionaries = {ru:staffRu,ky:staffKy,en:staffEn};
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({locale:mockLocale,t:(key:string,fallback:string) => dictionaries[mockLocale][key as keyof typeof staffRu] ?? fallback}),
}));

it.each(['ru','ky','en'] as const)('explains editable walk-in names without a raw template in %s', (locale) => {
    mockLocale = locale;
    const item = {clientName:'LIVE TEST',serviceName:'Test service',serviceAmount:300,consumablesAmount:50};
    render(<ClientEditForm item={item} idx={0} allItems={[item]} bookings={[]} serviceOptions={[{name_ru:'Test service'}]} isOpen isReadOnly={false} onUpdate={jest.fn()} onCollapse={jest.fn()} />);
    expect(screen.getByText(dictionaries[locale]['staff.finance.clients.walkInHint'])).toBeTruthy();
    expect(screen.queryByText(/\{name\}/)).toBeNull();
    expect(screen.getByDisplayValue('LIVE TEST')).toBeTruthy();
});
