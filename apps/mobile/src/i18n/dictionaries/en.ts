import { authEn } from './auth.en';
import { commonEn } from './common.en';
import { navEn } from './nav.en';
import type { Dictionary } from './ru';

export const en: Dictionary = {
    ...authEn,
    ...commonEn,
    ...navEn,
};
