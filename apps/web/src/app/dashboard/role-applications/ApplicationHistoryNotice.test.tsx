/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ApplicationHistoryNotice } from './ApplicationHistoryNotice';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

test('combines repeated-submission flags into a neutral expandable explanation', () => {
    const { container } = render(<ApplicationHistoryNotice count={3} flags={['repeat_applicant', 'high_submission_volume']} />);
    expect(screen.getByText('Повторная заявка · Предыдущих заявок: 3')).toBeTruthy();
    expect(screen.getByText(/во все бизнесы Kezek/)).toBeTruthy();
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(container.textContent).not.toContain('repeat_applicant');
    expect(container.textContent).not.toContain('high_submission_volume');
});
test('keeps prior rejections visible in the explanation', () => {
    render(<ApplicationHistoryNotice count={1} flags={['prior_rejection']} />);
    expect(screen.getByText(/Среди предыдущих заявок есть отклонённые/)).toBeTruthy();
});
test('does not expose unknown technical codes', () => {
    const { container } = render(<ApplicationHistoryNotice count={0} flags={['new_internal_flag']} />);
    expect(screen.getByText(/Есть дополнительные системные отметки/)).toBeTruthy();
    expect(container.textContent).not.toContain('new_internal_flag');
});
test('does not show history for a first application without flags', () => {
    const { container } = render(<ApplicationHistoryNotice count={0} flags={[]} />);
    expect(container.innerHTML).toBe('');
});
