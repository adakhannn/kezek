import { authKy } from './auth.ky';
import { commonKy } from './common.ky';
import { navKy } from './nav.ky';
import type { Dictionary } from './ru';

export const ky: Dictionary = {
    ...authKy,
    ...commonKy,
    ...navKy,
};
