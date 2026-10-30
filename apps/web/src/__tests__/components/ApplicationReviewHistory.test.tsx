/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ApplicationReviewHistory, ApplicationReviewStatus } from '@/components/admin/ApplicationReviewHistory';
import { applicationHistoryRu, applicationHistoryKy, applicationHistoryEn } from '@/app/_components/i18n/dictionaries/applicationHistory';
import type { I18nKey } from '@/app/_components/i18n/LanguageProvider';

it.each([applicationHistoryRu, applicationHistoryKy, applicationHistoryEn])('translates states and combines duplicate technical flags without exposing codes', dictionary => {
    const t = (key: I18nKey) => (dictionary as Record<string,string>)[key];
    const {container} = render(<><ApplicationReviewHistory count={3} flags={['repeat_applicant','high_submission_volume']} t={t}/>
        <ApplicationReviewStatus status="approved" t={t}/><ApplicationReviewStatus status="cancelled" t={t}/></>);
    expect(screen.getByText(dictionary['admin.applicationHistory.status.approved'])).toBeTruthy();
    expect(screen.getByText(dictionary['admin.applicationHistory.status.cancelled'])).toBeTruthy();
    expect(container.textContent).toContain(dictionary['admin.applicationHistory.repeat']);
    expect(container.textContent).not.toMatch(/repeat_applicant|high_submission_volume|\{count\}/);
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
});
it('retains neutral prior rejection and unknown-note explanations without raw identifiers', () => {
    const t = (key:I18nKey) => (applicationHistoryRu as Record<string,string>)[key];
    const {container} = render(<ApplicationReviewHistory count={0} flags={['prior_rejection','unknown_internal_flag']} t={t}/>);
    expect(container.textContent).toContain(applicationHistoryRu['admin.applicationHistory.rejected']);
    expect(container.textContent).toContain(applicationHistoryRu['admin.applicationHistory.other']);
    expect(container.textContent).not.toMatch(/prior_rejection|unknown_internal_flag/);
});
it('does not invent a warning for a first application', () => {
    const {container} = render(<ApplicationReviewHistory count={0} flags={[]} t={key=>key}/>);
    expect(container.innerHTML).toBe('');
});
