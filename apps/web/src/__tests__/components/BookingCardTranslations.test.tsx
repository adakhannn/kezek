/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import BookingCard from '@/app/cabinet/components/BookingCard';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { cabinetRu } from '@/app/_components/i18n/dictionaries/cabinet.ru';
import { cabinetKy } from '@/app/_components/i18n/dictionaries/cabinet.ky';
import { cabinetEn } from '@/app/_components/i18n/dictionaries/cabinet.en';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage:jest.fn()}));
jest.mock('@/app/cabinet/components/MapDialog', () => ({__esModule:true, default:() => null}));
jest.mock('@/app/cabinet/components/ReviewDialog', () => ({__esModule:true, default:() => null}));

test.each([
    ['ru', cabinetRu, 'Редактировать отзыв (3★)'],
    ['ky', cabinetKy, 'Пикирди түзөтүү (3★)'],
    ['en', cabinetEn, 'Edit review (3★)'],
] as const)('localizes the edit action for an existing review in %s', (locale, dictionary, label) => {
    jest.mocked(useLanguage).mockReturnValue({locale, t:(key:string, fallback?:string) => (dictionary as Record<string,string>)[key] ?? fallback ?? key} as ReturnType<typeof useLanguage>);
    render(<BookingCard bookingId="review-test" status="paid" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:00:00Z" service={null} staff={null} branch={null} business={null} canCancel={false} review={{id:'review',rating:3,comment:'LIVE TEST'}} />);
    expect(screen.getByRole('button', {name:label})).toBeTruthy();
    if (locale !== 'en') expect(screen.queryByText(/Edit review/)).toBeNull();
});

test.each([
    ['ru', cabinetRu, ['Статус записи', 'Создано', 'Выполнено'], ['Дата и время', 'Доступное действие', 'Завершено', 'Акция применена']],
    ['ky', cabinetKy, ['Жазылуунун абалы', 'Түзүлдү', 'Аткарылган'], ['Күнү жана убактысы', 'Жеткиликтүү аракет', 'Аяктады', 'Акция колдонулду']],
    ['en', cabinetEn, ['Booking status', 'Created', 'Completed'], ['Date and time', 'Available action', 'Promotion applied']],
] as const)('renders booking progress labels in %s without pseudo tiles or a promotion step', (locale, dictionary, labels, absent) => {
    jest.mocked(useLanguage).mockReturnValue({locale, t:(key:string, fallback?:string) => (dictionary as Record<string,string>)[key] ?? fallback ?? key} as ReturnType<typeof useLanguage>);
    render(<BookingCard bookingId="live-test-0123" status="confirmed" start_at="2099-10-12T03:00:00Z" end_at="2099-10-12T04:00:00Z" service={{id:'service', name_ru:'Test', duration_min:60}} staff={null} branch={null} business={null} canCancel />);
    for (const label of labels) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    for (const label of absent) expect(screen.queryByText(label)).toBeNull();
    // The raw booking id is not shown to the client.
    expect(screen.queryByText(/#live-tes/)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:dictionary['cabinet.bookings.card.actions.cancel'], exact:true}));
    expect(screen.getByRole('heading', {name:dictionary['cabinet.bookings.card.cancelConfirmTitle'], exact:true})).toBeTruthy();
    if (locale !== 'en') {
        expect(screen.queryByText('Date and time')).toBeNull();
        expect(screen.queryByText('Booking progress')).toBeNull();
    }
});

test.each([
 ['ru',cabinetRu,'Услуги визита','Всего:'],
 ['ky',cabinetKy,'Визиттин кызматтары','Жалпы:'],
 ['en',cabinetEn,'Services in visit','Total:'],
] as const)('localizes complex visit section and total in %s',(locale,dictionary,title,total)=>{
 jest.mocked(useLanguage).mockReturnValue({locale,t:(key:string,fallback?:string)=>(dictionary as Record<string,string>)[key]??fallback??key} as ReturnType<typeof useLanguage>);
 const first={id:'s1',name_ru:'First',duration_min:60};
 render(<BookingCard bookingId="complex-test" status="cancelled" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:01:00Z" service={first} servicesList={[first,{id:'s2',name_ru:'Second',duration_min:1}]} staff={null} branch={null} business={null} canCancel={false}/>);
 expect(screen.getAllByText(title).length).toBeGreaterThan(0);
 expect(screen.getByText(new RegExp(`^${total} 61`))).toBeTruthy();
});

describe('cabinet booking card wording (owner rules)', () => {
    const tFor = (dictionary: Record<string, string>) => (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;

    test('shows the promotion step only on a booking that carries a promotion', () => {
        jest.mocked(useLanguage).mockReturnValue({locale:'ru', t:tFor(cabinetRu)} as ReturnType<typeof useLanguage>);
        const view = render(<BookingCard bookingId="promo-test" status="paid" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:00:00Z" service={null} staff={null} branch={null} business={null} canCancel={false} />);
        expect(screen.queryAllByText('Акция применена')).toHaveLength(0);
        view.rerender(<BookingCard bookingId="promo-test" status="paid" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:00:00Z" service={null} staff={null} branch={null} business={null} canCancel={false} promotionApplied={{promotion_type:'birthday_discount'}} />);
        // The badge and the timeline step.
        expect(screen.getAllByText('Акция применена')).toHaveLength(2);
    });

    test.each([
        ['ru', cabinetRu, 'По пакету визитов', 'По пакету визитов «Десять визитов»'],
        ['ky', cabinetKy, 'Визит пакети боюнча', '«Он визит» визит пакети боюнча'],
        ['en', cabinetEn, 'Visit package', 'Visit package “Ten visits”'],
    ] as const)('names the visit package in %s without payment words', (locale, dictionary, badge, line) => {
        jest.mocked(useLanguage).mockReturnValue({locale, t:tFor(dictionary)} as ReturnType<typeof useLanguage>);
        const { container } = render(<BookingCard bookingId="package-test" status="paid" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:00:00Z" service={null} staff={null} branch={null} business={null} canCancel={false}
            subscriptionApplied={{ plan_name_ru: 'Десять визитов', plan_name_ky: 'Он визит', plan_name_en: 'Ten visits' }} />);
        expect(screen.getByText(badge, {exact:true})).toBeTruthy();
        expect(screen.getByText(line, {exact:true})).toBeTruthy();
        expect(container.textContent).not.toMatch(/Оплачено|Paid|төлөндү/);
    });

    test('writes the visit time in the owner format without a time-zone name', () => {
        jest.mocked(useLanguage).mockReturnValue({locale:'ru', t:tFor(cabinetRu)} as ReturnType<typeof useLanguage>);
        const { container } = render(<BookingCard bookingId="when-test" status="confirmed" start_at="2099-11-27T03:00:00Z" end_at="2099-11-27T04:00:00Z" service={null} staff={null} branch={null} business={{id:'biz', name:'Biz', slug:'biz', tz:'Asia/Bishkek'}} canCancel={false} />);
        expect(screen.getByTestId('booking-card-when').textContent).toBe('27 нояб. 2099 • 09:00–10:00');
        expect(container.textContent).not.toContain('Asia/Bishkek');
        expect(container.textContent).not.toMatch(/\d г\./);
    });
});
