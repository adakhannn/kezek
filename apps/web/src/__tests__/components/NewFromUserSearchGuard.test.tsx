/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

import NewFromUser from '@/app/dashboard/staff/NewFromUser';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';
import { staffEn } from '@/app/_components/i18n/dictionaries/staff.en';
import { staffKy } from '@/app/_components/i18n/dictionaries/staff.ky';

let mockLocale: 'ru'|'en'|'ky' = 'ru';
jest.mock('next/navigation', () => ({useRouter:() => ({push:jest.fn()})}));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage:() => ({t:(key:string,fallback:string) => {
        const dictionary: Record<string,string> = {ru:staffRu,en:staffEn,ky:staffKy}[mockLocale];
        return dictionary[key] ?? fallback;
    }}),
}));
jest.mock('@/hooks/useToast', () => ({useToast:() => ({showError:jest.fn(),toasts:[],removeToast:jest.fn()})}));
jest.mock('@/components/ui/Toast', () => ({ToastContainer:() => null}));

const dictionaries = {ru:staffRu,en:staffEn,ky:staffKy};
const fetchMock = jest.fn();
beforeEach(() => {jest.clearAllMocks();global.fetch=fetchMock;});
afterEach(cleanup);

test.each(['ru','en','ky'] as const)('manual-override guidance and identifier hint use the %s dictionary once', (locale) => {
    mockLocale=locale;
    const {container}=render(<NewFromUser branches={[{id:'branch',name:'LIVE TEST Branch'}]} />);
    const dictionary: Record<string,string> = dictionaries[locale];
    expect(dictionary['staff.new.manualOverride.title']).toEqual(expect.any(String));
    expect(dictionary['staff.new.manualOverride.message']).toEqual(expect.any(String));
    expect(screen.getByRole('status').textContent).toContain(dictionary['staff.new.manualOverride.title']);
    expect(screen.getByRole('status').textContent).toContain(dictionary['staff.new.manualOverride.message']);
    const hint=container.querySelector('label span');
    expect(hint?.textContent?.trim()).toBe(dictionary['staff.new.search.hint']);
    expect(hint?.textContent).not.toContain('((');
    expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['ru','en','ky'] as const)('blank lookup stays local with a readable %s message', (locale) => {
    mockLocale=locale;
    render(<NewFromUser branches={[{id:'branch',name:'LIVE TEST Branch'}]} />);
    fireEvent.click(screen.getByRole('button',{name:dictionaries[locale]['staff.new.search.button']}));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(dictionaries[locale]['staff.new.table.empty.enterQuery']);
});

test('whitespace lookup removes prior rows and cannot silently reuse a previously selected account', async () => {
    mockLocale='ru';
    fetchMock.mockResolvedValue({json:async()=>({ok:true,items:[{id:'known',full_name:'LIVE TEST Known',email:'known@example.test',phone:null}]})});
    render(<NewFromUser branches={[{id:'branch',name:'LIVE TEST Branch'}]} />);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'known@example.test'}});
    fireEvent.click(screen.getByRole('button',{name:'Найти'}));
    await screen.findByText('LIVE TEST Known');
    fireEvent.click(screen.getByRole('radio'));
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'  '}});
    await waitFor(()=>expect(screen.getByRole('button',{name:'Найти'}).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button',{name:'Найти'}));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('LIVE TEST Known')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Добавить сотрудника'}));
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('local empty-query validation follows a locale switch without repeating the search', () => {
    mockLocale='ru';
    const view=render(<NewFromUser branches={[{id:'branch',name:'LIVE TEST Branch'}]} />);
    fireEvent.click(screen.getByRole('button',{name:'Найти'}));
    mockLocale='en';
    view.rerender(<NewFromUser branches={[{id:'branch',name:'LIVE TEST Branch'}]} />);
    expect(screen.getByRole('alert').textContent).toContain(staffEn['staff.new.table.empty.enterQuery']);
    expect(fetchMock).not.toHaveBeenCalled();
});
