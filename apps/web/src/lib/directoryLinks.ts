/**
 * Ссылки филиала на внешние каталоги: Instagram, 2ГИС, Google Карты, Яндекс Карты.
 *
 * Подпись «2ГИС» на публичной странице обещает клиенту сайт 2ГИС, поэтому каждая ссылка
 * должна вести на домен своего сервиса. Иначе кнопка может открыть произвольный сайт:
 * так тестовые данные со ссылками на потерянный домен kezek.kg вели бы на чужой ресурс.
 */
export const DIRECTORY_LINK_KEYS = ['instagram', 'two_gis', 'google_maps', 'yandex_maps'] as const;

export type DirectoryLinkKey = (typeof DIRECTORY_LINK_KEYS)[number];
export type DirectoryLinks = Record<DirectoryLinkKey, string | null>;

const DIRECTORY_LINK_LABELS: Record<DirectoryLinkKey, string> = {
    instagram: 'Instagram',
    two_gis: '2ГИС',
    google_maps: 'Google Карты',
    yandex_maps: 'Яндекс Карты',
};

// Поддомены разрешены (www., go., maps.), регистрируемый домен — только домен сервиса.
const DIRECTORY_LINK_HOSTS: Record<DirectoryLinkKey, RegExp> = {
    instagram: /^(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am)$/,
    two_gis: /^(?:[a-z0-9-]+\.)*2gis\.(?:[a-z]{2,3}|com\.[a-z]{2})$/,
    google_maps: /^(?:[a-z0-9-]+\.)*(?:google\.(?:[a-z]{2,3}|com?\.[a-z]{2})|goo\.gl|g\.page)$/,
    yandex_maps: /^(?:[a-z0-9-]+\.)*(?:yandex\.(?:[a-z]{2,3}|com\.[a-z]{2})|ya\.ru|ya\.cc)$/,
};

const MAX_LINK_LENGTH = 2048;

export type DirectoryLinkResult = { ok: true; value: string | null } | { ok: false };

/**
 * Пустое значение — `null`. Ссылку без схемы («instagram.com/name») дополняем `https://`,
 * `http` поднимаем до `https`. Отклоняем другие схемы, логин/пароль и порт в адресе,
 * а также домены, не принадлежащие сервису.
 */
export function normalizeDirectoryLink(key: DirectoryLinkKey, value: unknown): DirectoryLinkResult {
    if (value == null) return { ok: true, value: null };
    if (typeof value !== 'string') return { ok: false };
    const text = value.trim();
    if (!text) return { ok: true, value: null };
    if (text.length > MAX_LINK_LENGTH) return { ok: false };

    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return { ok: false };
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false };
    if (url.username || url.password || url.port) return { ok: false };

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!DIRECTORY_LINK_HOSTS[key].test(host)) return { ok: false };

    url.protocol = 'https:';
    return { ok: true, value: url.toString() };
}

function linkSource(input: unknown): Record<string, unknown> {
    return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

export type DirectoryLinksValidation =
    | { ok: true; value: DirectoryLinks }
    | { ok: false; invalid: DirectoryLinkKey[]; message: string };

/** Для сохранения: неверная ссылка — ошибка валидации с перечнем сервисов. */
export function validateDirectoryLinks(input: unknown): DirectoryLinksValidation {
    const source = linkSource(input);
    const value = {} as DirectoryLinks;
    const invalid: DirectoryLinkKey[] = [];
    for (const key of DIRECTORY_LINK_KEYS) {
        const result = normalizeDirectoryLink(key, source[key]);
        value[key] = result.ok ? result.value : null;
        if (!result.ok) invalid.push(key);
    }
    if (invalid.length > 0) {
        const services = invalid.map((key) => DIRECTORY_LINK_LABELS[key]).join(', ');
        return { ok: false, invalid, message: `Ссылка должна вести на сайт своего сервиса: ${services}` };
    }
    return { ok: true, value };
}

/** Для показа и копирования из заявки: оставляет только корректные ссылки. */
export function sanitizeDirectoryLinks(input: unknown): DirectoryLinks {
    const source = linkSource(input);
    const value = {} as DirectoryLinks;
    for (const key of DIRECTORY_LINK_KEYS) {
        const result = normalizeDirectoryLink(key, source[key]);
        value[key] = result.ok ? result.value : null;
    }
    return value;
}
