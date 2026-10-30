/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BranchPromotionsPanel from '@/app/dashboard/branches/[id]/BranchPromotionsPanel';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (key: string, fallback?: string) =>
        (jest.requireActual('@/app/_components/i18n/dictionaries/branches.ru').branchesRu as Record<string, string>)[key] ?? fallback ?? key }),
}));

const promotion = {
    id: 'test-promotion', title_ru: 'LIVE TEST promotion', promotion_type: 'free_after_n_visits',
    params: { visit_count: 3 }, is_active: false, created_at: '2026-10-09T00:00:00Z', usage_count: 0,
};
const response = (promotions: unknown[]) => ({ ok: true, json: async () => ({ ok: true, data: { promotions } }) });

test('renders inactive and active rows from the standard API data envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue(response([promotion, { ...promotion, id: 'active', title_ru: 'Active promotion', is_active: true }]));
    render(<BranchPromotionsPanel branchId="branch" />);
    expect(await screen.findByText('LIVE TEST promotion')).toBeTruthy();
    expect(screen.getByText('Active promotion')).toBeTruthy();
    expect(screen.queryByText('Акций пока нет')).toBeNull();
});

test('shows the saved inactive promotion after create reloads the list', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(response([]))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { promotion } }) })
        .mockResolvedValueOnce(response([promotion]));
    render(<BranchPromotionsPanel branchId="branch" />);
    await screen.findByText('Акций пока нет');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить акцию' }));
    fireEvent.change(screen.getByLabelText('Название акции (русский) *'), { target: { value: promotion.title_ru } });
    fireEvent.change(screen.getByLabelText('Количество посещений (N)'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Активна (отображается клиентам)'));
    fireEvent.click(screen.getByRole('button', { name: 'Создать', exact: true }));
    expect(await screen.findByText(promotion.title_ru)).toBeTruthy();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    const payload = JSON.parse(jest.mocked(global.fetch).mock.calls[1][1]?.body as string);
    expect(payload.is_active).toBe(false);
    expect(payload.params.visit_count).toBe(3);
});

test('promotion activity label has its own input identity beside the branch form', async () => {
    global.fetch = jest.fn().mockResolvedValue(response([promotion]));
    render(<><label htmlFor="is_active">Branch activity</label><input id="is_active" type="checkbox" defaultChecked />
        <BranchPromotionsPanel branchId="branch" /></>);
    await screen.findByText(promotion.title_ru);
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать', exact: true }));
    const promotionInput = screen.getByLabelText('Активна (отображается клиентам)') as HTMLInputElement;
    expect(promotionInput.id).not.toBe('is_active');
    fireEvent.click(screen.getByText('Активна (отображается клиентам)', { exact: true }));
    expect(promotionInput.checked).toBe(true);
    expect((screen.getByLabelText('Branch activity') as HTMLInputElement).checked).toBe(true);
});

test('explains a rejected negative visit count instead of displaying its machine code', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(response([promotion]))
        .mockResolvedValueOnce({ok:false,json:async () => ({ok:false,error:'validation',
            message:'Количество визитов должно быть больше 0',details:{field:'params.visit_count'}})});
    render(<BranchPromotionsPanel branchId="branch" />);
    await screen.findByText(promotion.title_ru);
    fireEvent.click(screen.getByRole('button',{name:'Редактировать',exact:true}));
    fireEvent.change(screen.getByLabelText('Количество посещений (N)'),{target:{value:'-1'}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));
    expect(await screen.findByText('Количество визитов должно быть больше 0')).toBeTruthy();
    expect(screen.queryByText('validation',{exact:true})).toBeNull();
    expect((screen.getByLabelText('Количество посещений (N)') as HTMLInputElement).value).toBe('-1');
    expect(global.fetch).toHaveBeenCalledTimes(2);
});
