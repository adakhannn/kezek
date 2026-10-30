/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { HomeHeader, HomeResultsHeader } from '@/app/_components/HomeClientComponents';
jest.mock('next/navigation',()=>({useRouter:()=>({push:jest.fn(),replace:jest.fn()})}));
jest.mock('@/app/_components/i18n/LanguageProvider',()=>({useLanguage:()=>({t:(_key:string,fallback:string)=>fallback})}));

it('shows the public category name but keeps slug URLs and selected filter identities', () => {
    const slug = 'zhenskaya-parikmaherskaya';
    const categoryLabels = {[slug]:'Женская парикмахерская'};
    render(<><HomeHeader q="" cat={slug} categories={[slug]} categoryLabels={categoryLabels} totalResults={1} />
        <HomeResultsHeader q="" cat={slug} totalResults={1} categoryLabels={categoryLabels} /></>);
    expect(screen.getByRole('link',{name:'Женская парикмахерская'}).getAttribute('href')).toBe(`/?cat=${slug}`);
    expect(screen.getByText('Категория: Женская парикмахерская')).toBeTruthy();
    expect(screen.queryByText(slug)).toBeNull();
});
