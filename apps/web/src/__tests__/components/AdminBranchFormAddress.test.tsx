/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { BranchForm } from '@/components/admin/branches/BranchForm';

const push = jest.fn();
const refresh = jest.fn();
const fetchMock = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
jest.mock('@/components/admin/branches/BranchMapPickerYandex', () => ({
    __esModule: true,
    default: ({ onPick }: { onPick: (lat: number, lon: number, address: string) => void }) => (
        <div>
            <p>Карта временно недоступна. Введите адрес филиала вручную.</p>
            <button type="button" onClick={() => onPick(40.5, 72.8, 'Map selected address')}>
                Unit map callback
            </button>
        </div>
    ),
}));

function setup(address = '') {
    render(<BranchForm mode="edit" bizId="unit-business" branchId="unit-branch"
        initial={{ name: 'Inactive branch', address, is_active: false }} />);
    return {
        address: screen.getByRole('textbox', { name: 'Адрес', exact: true }) as HTMLInputElement,
        name: screen.getByRole('textbox', { name: 'Название филиала', exact: true }) as HTMLInputElement,
        save: screen.getByRole('button', { name: 'Сохранить изменения', exact: true }) as HTMLButtonElement,
    };
}

beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock;
});

it('retains manual address after blur without a map or a submit, and clears back to unchanged', () => {
    const fields = setup();
    expect(fields.save.disabled).toBe(true);
    fireEvent.change(fields.address, { target: { value: 'Manual draft address' } });
    fireEvent.blur(fields.address);
    expect(fields.address.value).toBe('Manual draft address');
    expect(fields.save.disabled).toBe(false);
    expect(fields.name.value).toBe('Inactive branch');
    expect((screen.getByRole('checkbox', { name: 'Филиал активен' }) as HTMLInputElement).checked).toBe(false);
    fireEvent.change(fields.address, { target: { value: '' } });
    expect(fields.save.disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
});

it('allows manual replacement and restoration of an existing address; name edits remain independent', () => {
    const fields = setup('Original address');
    fireEvent.change(fields.address, { target: { value: 'Replacement address' } });
    expect(fields.address.value).toBe('Replacement address');
    fireEvent.change(fields.address, { target: { value: 'Original address' } });
    expect(fields.save.disabled).toBe(true);
    fireEvent.change(fields.name, { target: { value: 'Changed name' } });
    expect(fields.name.value).toBe('Changed name');
    expect(fields.address.value).toBe('Original address');
    expect(fields.save.disabled).toBe(false);
    fireEvent.change(fields.name, { target: { value: 'Inactive branch' } });
    expect(fields.save.disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
});

it('preserves map callback address and coordinates and permits a subsequent manual address edit', () => {
    const fields = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Unit map callback' }));
    expect(fields.address.value).toBe('Map selected address');
    expect(screen.getByText(/Координаты:/).textContent).toContain('40.500000');
    expect(screen.getByText(/Координаты:/).textContent).toContain('72.800000');
    fireEvent.change(fields.address, { target: { value: 'Manual after map' } });
    expect(fields.address.value).toBe('Manual after map');
    expect(screen.getByText(/Координаты:/).textContent).toContain('40.500000');
    expect(fetchMock).not.toHaveBeenCalled();
});
