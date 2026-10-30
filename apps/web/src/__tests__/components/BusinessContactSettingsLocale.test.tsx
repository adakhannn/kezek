/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getT } from '@/app/_components/i18n/server';
import { BusinessContactSettingsForm } from '@/app/dashboard/settings/BusinessContactSettingsForm';
import BusinessSettingsPage from '@/app/dashboard/settings/page';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getLocaleFromCookieServer } from '@/lib/cookies';
import { isBusinessOwner } from '@/lib/staffApplicationApprovalService';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/cookies', () => ({ getLocaleFromCookieServer: jest.fn() }));
jest.mock('@/lib/staffApplicationApprovalService', () => ({ isBusinessOwner: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

const initial = { contact_phone: '+996500574029', contact_whatsapp: '', contact_email: '', website_url: '' };
const cases = [
    ['ru', 'Настройки бизнеса', 'Контакты бизнеса', 'Публичный телефон', 'Сохранить контакты'],
    ['en', 'Business settings', 'Business contacts', 'Public phone', 'Save contacts'],
    ['ky', 'Бизнес жөндөөлөрү', 'Бизнестин байланыштары', 'Жалпыга ачык телефон', 'Байланыштарды сактоо'],
] as const;
const copy = {
    ru: ['Эти данные видят клиенты. Они не связаны с телефонами входа, владельцев или сотрудников.', 'Основной номер для звонков клиентов', 'Только бизнес-номер, не номер авторизации', 'Только HTTPS-ссылка', 'Рабочий WhatsApp', 'Публичный email', 'Сайт'],
    en: ['Clients can see these details. They are separate from sign-in, owner and staff phone numbers.', 'Main number for client calls', 'Business number only, not a sign-in number', 'HTTPS links only', 'Business WhatsApp', 'Public email', 'Website'],
    ky: ['Бул маалыматтар кардарларга көрүнөт. Алар кирүү, ээсинин же кызматкерлердин телефон номерлерине байланыштуу эмес.', 'Кардарлардын чалуулары үчүн негизги номер', 'Кирүү номери эмес, бизнестин номери гана', 'HTTPS шилтемеси гана', 'Иш WhatsApp номери', 'Жалпыга ачык email', 'Веб-сайт'],
};
const originalFetch = global.fetch;
let from: jest.Mock;
let rpc: jest.Mock;
function setLocale(locale: 'ru' | 'en' | 'ky') {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: getT(locale) } as ReturnType<typeof useLanguage>);
    jest.mocked(getLocaleFromCookieServer).mockResolvedValue(locale);
}
beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: initial }) };
    from = jest.fn().mockReturnValue(query);
    rpc = jest.fn().mockResolvedValue({ data: false });
    jest.mocked(getServiceClient).mockReturnValue({ from } as unknown as ReturnType<typeof getServiceClient>);
    jest.mocked(getBizContextForManagers).mockResolvedValue({ supabase: { rpc }, userId: 'owner', bizId: 'business-2', business: { name: 'Тестовый бизнес 2' } } as unknown as Awaited<ReturnType<typeof getBizContextForManagers>>);
    jest.mocked(isBusinessOwner).mockResolvedValue(true);
    setLocale('ru');
});
afterAll(() => { global.fetch = originalFetch; });

test.each(cases)('form labels use %s while contact values remain unchanged and no request is sent', (locale, _title, heading, phone, save) => {
    setLocale(locale);
    render(<BusinessContactSettingsForm initial={initial} />);
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByLabelText(phone)).toHaveProperty('value', initial.contact_phone);
    expect(screen.getByRole('button', { name: save })).toBeTruthy();
    for (const text of copy[locale].slice(0, 4)) expect(screen.getByText(text)).toBeTruthy();
    for (const label of copy[locale].slice(4)) expect(screen.getByLabelText(label)).toHaveProperty('value', '');
    expect(global.fetch).not.toHaveBeenCalled();
});

test.each(cases)('server page uses %s without translating authored business name', async (locale, title) => {
    setLocale(locale);
    render(await BusinessSettingsPage());
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(/Тестовый бизнес 2/)).toBeTruthy();
    expect(from).toHaveBeenCalledWith('businesses');
    expect(rpc).toHaveBeenCalledWith('is_super_admin');
    expect(isBusinessOwner).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', bizId: 'business-2' }));
    expect(global.fetch).not.toHaveBeenCalled();
});

test('locale rerender preserves unsaved draft locally without submitting', () => {
    const view = render(<BusinessContactSettingsForm initial={initial} />);
    fireEvent.change(screen.getByLabelText('Публичный телефон'), { target: { value: '+996555000001' } });
    setLocale('en');
    view.rerender(<BusinessContactSettingsForm initial={initial} />);
    expect(screen.getByLabelText('Public phone')).toHaveProperty('value', '+996555000001');
    expect(global.fetch).not.toHaveBeenCalled();
});

test('denied caller still cannot read contacts (isolated page control, not live security)', async () => {
    jest.mocked(isBusinessOwner).mockResolvedValue(false);
    setLocale('en');
    render(await BusinessSettingsPage());
    expect(screen.getByText('Access denied')).toBeTruthy();
    expect(screen.getByText('Only the business owner can change public contacts.')).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
});

test('existing superadmin page control remains allowed', async () => {
    jest.mocked(isBusinessOwner).mockResolvedValue(false);
    rpc.mockResolvedValue({ data: true });
    render(await BusinessSettingsPage());
    expect(screen.getByRole('heading', { name: 'Настройки бизнеса' })).toBeTruthy();
    expect(from).toHaveBeenCalledTimes(1);
});

test.each([
    [{ message: 'Server supplied message', error: { message: 'Nested message' } }, 'Server supplied message'],
    [{ error: { message: 'Nested message' } }, 'Nested message'],
    [{ error: { code: 'BAD_INPUT' } }, 'Could not save contacts'],
])('mock submit preserves existing server error precedence', async (payload, expected) => {
    setLocale('en');
    jest.mocked(global.fetch).mockResolvedValue({ ok: false, json: async () => payload } as Response);
    const view = render(<BusinessContactSettingsForm initial={initial} />);
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/contact-settings', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(initial),
    });
});

test('network failure uses localized fallback in mock only', async () => {
    setLocale('en');
    jest.mocked(global.fetch).mockRejectedValue(new Error('offline'));
    const view = render(<BusinessContactSettingsForm initial={initial} />);
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText('Could not reach the server')).toBeTruthy());
});
