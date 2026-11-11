import { timingSafeEqual } from 'node:crypto';

/** Missing or malformed configuration never creates a usable bearer credential. */
export function isAuthorizedCronRequest(req: Request, secret: string | undefined): boolean {
    if (!secret || !secret.trim() || secret.trim() !== secret) return false;
    const actual = req.headers.get('authorization');
    if (!actual) return false;
    const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
    const supplied = Buffer.from(actual, 'utf8');
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
