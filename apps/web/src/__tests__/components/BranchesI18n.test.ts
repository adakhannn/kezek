import { branchesEn } from '@/app/_components/i18n/dictionaries/branches.en';
import { branchesKy } from '@/app/_components/i18n/dictionaries/branches.ky';
import { branchesRu } from '@/app/_components/i18n/dictionaries/branches.ru';

describe('branch dictionaries', () => {
    it('keep the same keys in RU, EN, and KY', () => {
        const enKeys = Object.keys(branchesEn).sort();
        expect(Object.keys(branchesRu).sort()).toEqual(enKeys);
        expect(Object.keys(branchesKy).sort()).toEqual(enKeys);
    });
});
