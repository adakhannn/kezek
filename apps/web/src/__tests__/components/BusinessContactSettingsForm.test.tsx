/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getT } from '@/app/_components/i18n/server';
import { BusinessContactSettingsForm } from '@/app/dashboard/settings/BusinessContactSettingsForm';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
beforeEach(() => {
    jest.mocked(useLanguage).mockReturnValue({ locale: 'ru', t: getT('ru') } as ReturnType<typeof useLanguage>);
});

const initial = {contact_phone:'+996500574029',contact_whatsapp:'',contact_email:'',website_url:''};
test.each([
    [{ok:false,error:'validation',message:'Сайт должен быть корректной HTTPS-ссылкой'}, 'Сайт должен быть корректной HTTPS-ссылкой'],
    [{ok:false,error:{message:'Ошибка поля'}}, 'Ошибка поля'],
    [{ok:false,error:'update_failed'}, 'Не удалось сохранить контакты'],
])('shows a human error without leaking the machine code', async (payload, message) => {
    global.fetch = jest.fn().mockResolvedValue({ok:false,json:async()=>payload});
    render(<BusinessContactSettingsForm initial={initial} />);
    fireEvent.change(screen.getByLabelText('Сайт'),{target:{value:'http://example.invalid'}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить контакты'}));
    await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain(message));
    expect(screen.queryByText('validation')).toBeNull();
    expect(screen.getByLabelText('Сайт')).toBeTruthy();
});

it('allows correction after an error and displays the saved server values', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ok:false,json:async()=>({ok:false,error:'validation',message:'HTTPS required'})})
        .mockResolvedValueOnce({ok:true,json:async()=>({ok:true,data:initial})});
    render(<BusinessContactSettingsForm initial={initial} />);
    fireEvent.change(screen.getByLabelText('Сайт'),{target:{value:'http://example.invalid'}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить контакты'}));
    await screen.findByText('HTTPS required');
    fireEvent.change(screen.getByLabelText('Сайт'),{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить контакты'}));
    await screen.findByText('Публичные контакты сохранены');
    expect(screen.queryByText('HTTPS required')).toBeNull();
    expect((screen.getByLabelText('Сайт') as HTMLInputElement).value).toBe('');
});
