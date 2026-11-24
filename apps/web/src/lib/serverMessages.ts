/**
 * API messages in the language of the request (FE-10).
 *
 * Services keep their Russian messages. The server dictionaries (server*.ru/ky/en.ts next to the UI
 * dictionaries, but outside the client bundle) map each exact Russian message, or a pattern of it with
 * {placeholders} where the service inserts a value, to Kyrgyz and English. localizeApiResponse rewrites
 * the `message` and `error` fields of a JSON API response, and the `message` of each validation issue
 * in `details.errors`, for the language of the request: the `kezek_lang` cookie, else the
 * `X-Kezek-Locale` header that the mobile app sends.
 * withErrorHandler and withRateLimit apply it, and withLocalizedMessages wraps the few route handlers
 * that use neither, so services need no changes. Russian, a missing cookie, an unknown message and
 * anything but a JSON object body leave the response as it is; so does any failure here.
 */
import { NextResponse } from 'next/server';

import { serverAuthEn } from '@/app/_components/i18n/dictionaries/serverAuth.en';
import { serverAuthKy } from '@/app/_components/i18n/dictionaries/serverAuth.ky';
import { serverAuthRu } from '@/app/_components/i18n/dictionaries/serverAuth.ru';
import { serverBookingEn } from '@/app/_components/i18n/dictionaries/serverBooking.en';
import { serverBookingKy } from '@/app/_components/i18n/dictionaries/serverBooking.ky';
import { serverBookingRu } from '@/app/_components/i18n/dictionaries/serverBooking.ru';
import { serverBusinessEn } from '@/app/_components/i18n/dictionaries/serverBusiness.en';
import { serverBusinessKy } from '@/app/_components/i18n/dictionaries/serverBusiness.ky';
import { serverBusinessRu } from '@/app/_components/i18n/dictionaries/serverBusiness.ru';
import { serverCommonEn } from '@/app/_components/i18n/dictionaries/serverCommon.en';
import { serverCommonKy } from '@/app/_components/i18n/dictionaries/serverCommon.ky';
import { serverCommonRu } from '@/app/_components/i18n/dictionaries/serverCommon.ru';
import { serverStaffEn } from '@/app/_components/i18n/dictionaries/serverStaff.en';
import { serverStaffKy } from '@/app/_components/i18n/dictionaries/serverStaff.ky';
import { serverStaffRu } from '@/app/_components/i18n/dictionaries/serverStaff.ru';

export type ServerLocale = 'ru' | 'ky' | 'en';

type Dictionary = Readonly<Record<string, string>>;

const RU: Dictionary = { ...serverCommonRu, ...serverAuthRu, ...serverBookingRu, ...serverStaffRu, ...serverBusinessRu };
const TRANSLATIONS: Record<'ky' | 'en', Dictionary> = {
    ky: { ...serverCommonKy, ...serverAuthKy, ...serverBookingKy, ...serverStaffKy, ...serverBusinessKy },
    en: { ...serverCommonEn, ...serverAuthEn, ...serverBookingEn, ...serverStaffEn, ...serverBusinessEn },
};

/** All server messages by locale, for the dictionary test. */
export const serverDictionaries: Readonly<Record<ServerLocale, Dictionary>> = { ru: RU, ...TRANSLATIONS };

/** The response fields that carry text for people. */
const MESSAGE_FIELDS = ['message', 'error'] as const;
/** Bigger bodies are data, not messages; they are not read twice. */
const MAX_BODY_LENGTH = 64 * 1024;
const CYRILLIC = /[А-Яа-яЁё]/;
const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

type Pattern = { key: string; regex: RegExp; names: string[]; fixedLength: number };

let exact: Map<string, string> | undefined;
let patterns: Pattern[] = [];
/** Responses this module already returned: nested wrappers do the work once. */
const localized = new WeakSet<Response>();

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Exact Russian text -> key, and the patterns, the most fixed text first. */
function index(): Map<string, string> {
    if (exact) return exact;
    const map = new Map<string, string>();
    const list: Pattern[] = [];
    for (const [key, value] of Object.entries(RU)) {
        const names = [...value.matchAll(PLACEHOLDER)].map((match) => match[1]);
        if (names.length === 0) {
            map.set(value, key);
            continue;
        }
        const fixed = value.split(PLACEHOLDER).filter((_, i) => i % 2 === 0);
        const fixedLength = fixed.join('').trim().length;
        // A pattern without fixed text would match any message.
        if (fixedLength < 4) continue;
        list.push({ key, names, fixedLength, regex: new RegExp(`^${fixed.map(escapeRegExp).join('([\\s\\S]+?)')}$`) });
    }
    patterns = list.sort((a, b) => b.fixedLength - a.fixedLength);
    exact = map;
    return map;
}

/** The dictionary key of a Russian message and the values of its placeholders, or null. */
function lookup(message: string): { key: string; values: Record<string, string> } | null {
    const key = index().get(message);
    if (key) return { key, values: {} };
    for (const pattern of patterns) {
        const match = pattern.regex.exec(message);
        if (!match) continue;
        return { key: pattern.key, values: Object.fromEntries(pattern.names.map((name, i) => [name, match[i + 1]])) };
    }
    return null;
}

/** The message in `locale`, or the message itself when it is Russian or not in the dictionaries. */
export function translateServerMessage(message: string, locale: ServerLocale): string {
    if (locale === 'ru' || !message) return message;
    const found = lookup(message);
    const template = found ? TRANSLATIONS[locale][found.key] : undefined;
    if (!found || !template) return message;
    return template.replace(PLACEHOLDER, (whole, name: string) => found.values[name] ?? whole);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A string the dictionaries have a translation for. */
function known(value: unknown): value is string {
    return typeof value === 'string' && value !== '' && lookup(value) !== null;
}

/** The body of a copy of the response, or null once it is longer than `limit` characters. */
async function readUpTo(response: Response, limit: number): Promise<string | null> {
    const reader = response.clone().body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) return text + decoder.decode();
        text += decoder.decode(value, { stream: true });
        if (text.length > limit) {
            // Only the copy stops; the original body keeps streaming. Not awaited: a cancelled tee
            // branch settles when the other one is done.
            reader.cancel().catch(() => undefined);
            return null;
        }
    }
}

/** Header with the language of the mobile app. The website never sends it. */
export const LOCALE_HEADER = 'x-kezek-locale';

function isServerLocale(value: unknown): value is ServerLocale {
    return value === 'ru' || value === 'ky' || value === 'en';
}

/**
 * The language of the current request: the `X-Kezek-Locale` header (the mobile app), then the
 * `kezek_lang` cookie (the website), then Russian. The header comes first: on Android the app's
 * requests also carry the cookies of its WebView (the map sets kezek_lang), which must not
 * override the language the app asks for. Russian outside a request or when neither can be read.
 */
export async function requestLocale(): Promise<ServerLocale> {
    try {
        const { headers } = await import('next/headers');
        const value = (await headers()).get(LOCALE_HEADER)?.trim().toLowerCase();
        if (isServerLocale(value)) return value;
    } catch {
        // Outside a request scope: fall through to the cookie.
    }
    try {
        const { getLocaleFromCookieServer } = await import('@/lib/cookies');
        const cookie = await getLocaleFromCookieServer();
        if (cookie) return cookie;
    } catch {
        // No cookie store.
    }
    return 'ru';
}

/**
 * The response with its `message`, `error` and validation issue messages in the language of the
 * request (see the module comment). `locale` overrides the cookie and the header.
 */
export async function localizeApiResponse<R extends Response>(response: R, locale?: ServerLocale): Promise<R> {
    try {
        if (localized.has(response)) return response;
        localized.add(response);
        if (!(response.headers.get('content-type') ?? '').includes('application/json')) return response;
        const text = await readUpTo(response, MAX_BODY_LENGTH);
        if (text === null || !CYRILLIC.test(text)) return response;
        const body: unknown = JSON.parse(text);
        if (!isRecord(body)) return response;
        const fields = MESSAGE_FIELDS.filter((field) => known(body[field]));
        // Validation failures list their issues in details.errors[].message (validateRequest).
        const details = isRecord(body.details) ? body.details : undefined;
        const issues = Array.isArray(details?.errors) ? details.errors : [];
        const issueCount = issues.filter((issue) => isRecord(issue) && known(issue.message)).length;
        if (fields.length === 0 && issueCount === 0) return response;
        // The cookie is read only for a message the dictionaries know.
        const target = locale ?? await requestLocale();
        if (target === 'ru') return response;
        const translated: Record<string, unknown> = { ...body };
        for (const field of fields) translated[field] = translateServerMessage(body[field] as string, target);
        if (details && issueCount > 0) {
            translated.details = {
                ...details,
                errors: issues.map((issue) => (isRecord(issue) && known(issue.message)
                    ? { ...issue, message: translateServerMessage(issue.message, target) }
                    : issue)),
            };
        }
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        const result = new NextResponse(JSON.stringify(translated), {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
        localized.add(result);
        return result as unknown as R;
    } catch {
        return response;
    }
}

/** A route handler whose JSON messages follow the language of the request. */
export function withLocalizedMessages<A extends unknown[], R extends Response>(
    handler: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
    return async (...args: A) => localizeApiResponse(await handler(...args));
}
