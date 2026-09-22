/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { ApplicationBranchSelect } from './ApplicationBranchSelect';

test('keeps addresses outside options and updates the selected address', () => {
    const branches = [
        { id: '1', name: 'Филиал 1', address: 'Очень длинный адрес первого филиала' },
        { id: '2', name: 'Филиал 2', address: 'Адрес второго филиала' },
    ];
    const onChange = jest.fn();
    const { rerender } = render(<ApplicationBranchSelect id="branch" branches={branches} value="1" onChange={onChange} />);
    expect(screen.getAllByRole('option').map((node) => node.textContent)).toEqual(['Филиал 1', 'Филиал 2']);
    expect(screen.getByText(branches[0].address)).toBeTruthy();
    expect(screen.getByRole('combobox').getAttribute('aria-describedby')).toBe('branch-address');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('2');
    rerender(<ApplicationBranchSelect id="branch" branches={branches} value="2" onChange={onChange} />);
    expect(screen.queryByText(branches[0].address)).toBeNull();
    expect(screen.getByText(branches[1].address)).toBeTruthy();
});
