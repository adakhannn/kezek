export function sanitizeAuthReturnPath(value: string | null | undefined): string {
    if (!value) return '/';

    const trimmed = value.trim();
    if (!trimmed) return '/';

    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
        return '/';
    }

    try {
        const parsed = new URL(trimmed, 'https://kezek.local');
        if (parsed.origin !== 'https://kezek.local') {
            return '/';
        }

        // URL parsing removes dot segments: "/.//evil.com" becomes the pathname "//evil.com", which a
        // browser navigation reads as another host (R25-08). Check the result, not only the input.
        const path = parsed.pathname;
        if (path.startsWith('//') || path.includes('\\')) {
            return '/';
        }

        return `${path}${parsed.search}${parsed.hash}` || '/';
    } catch {
        return '/';
    }
}

export function getAuthReturnPath(searchParams: URLSearchParams): string {
    return sanitizeAuthReturnPath(searchParams.get('redirect') ?? searchParams.get('next'));
}
