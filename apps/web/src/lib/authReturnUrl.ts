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

        return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    } catch {
        return '/';
    }
}

export function getAuthReturnPath(searchParams: URLSearchParams): string {
    return sanitizeAuthReturnPath(searchParams.get('redirect') ?? searchParams.get('next'));
}
