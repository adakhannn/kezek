import { promotionSaveErrorMessage } from '@/lib/promotionSaveErrorMessage';
import { branchesRu } from '@/app/_components/i18n/dictionaries/branches.ru';
import { branchesKy } from '@/app/_components/i18n/dictionaries/branches.ky';
import { branchesEn } from '@/app/_components/i18n/dictionaries/branches.en';

test.each([['ru',branchesRu],['ky',branchesKy],['en',branchesEn]] as const)(
    'uses stable field metadata to localize validation in %s', (_locale, dictionary) => {
        const t = (key:string,fallback?:string) => (dictionary as Record<string,string>)[key] ?? fallback ?? key;
        for (const [field,key] of [['params.visit_count','visitCount'],['params.discount_percent','discount']]) {
            expect(promotionSaveErrorMessage({error:'validation',message:'Russian server text',details:{field}},t))
                .toBe(dictionary[`branches.promotions.validation.${key}` as keyof typeof dictionary]);
        }
        expect(promotionSaveErrorMessage({error:'validation'},t)).toBe(dictionary['branches.promotions.validation.general']);
        for (const response of [null,undefined,'validation',{error:'internal',message:'secret database diagnostic'}]) {
            expect(promotionSaveErrorMessage(response,t)).toBe(dictionary['branches.promotions.error.save']);
        }
    },
);
