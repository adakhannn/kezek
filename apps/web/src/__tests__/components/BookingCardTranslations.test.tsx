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
    ['ru', cabinetRu, 'Редактировать отзыв'],
    ['ky', cabinetKy, 'Пикирди түзөтүү'],
    ['en', cabinetEn, 'Edit review'],
] as const)('localizes the available action for an existing review in %s', (locale, dictionary, label) => {
    jest.mocked(useLanguage).mockReturnValue({locale, t:(key:string, fallback?:string) => (dictionary as Record<string,string>)[key] ?? fallback ?? key} as ReturnType<typeof useLanguage>);
    render(<BookingCard bookingId="review-test" status="paid" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:00:00Z" service={null} staff={null} branch={null} business={null} canCancel={false} review={{id:'review',rating:3,comment:'LIVE TEST'}} />);
    expect(screen.getByText(label, {exact:true})).toBeTruthy();
    if (locale !== 'en') expect(screen.queryByText('Edit review', {exact:true})).toBeNull();
});

test.each([
    ['ru', cabinetRu, ['Дата и время', 'Длительность', 'Доступное действие', 'Статус записи', 'Создано', 'Завершено']],
    ['ky', cabinetKy, ['Күнү жана убактысы', 'Узактыгы', 'Жеткиликтүү аракет', 'Жазылуунун абалы', 'Түзүлдү', 'Аяктады']],
    ['en', cabinetEn, ['Date and time', 'Duration', 'Available action', 'Booking status', 'Created', 'Completed']],
] as const)('renders booking summary labels in %s', (locale, dictionary, labels) => {
    jest.mocked(useLanguage).mockReturnValue({locale, t:(key:string, fallback?:string) => (dictionary as Record<string,string>)[key] ?? fallback ?? key} as ReturnType<typeof useLanguage>);
    render(<BookingCard bookingId="live-test" status="confirmed" start_at="2026-10-12T03:00:00Z" end_at="2026-10-12T04:00:00Z" service={{id:'service', name_ru:'Test', duration_min:60}} staff={null} branch={null} business={null} canCancel />);
    for (const label of labels) expect(screen.getByText(label)).toBeTruthy();
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
