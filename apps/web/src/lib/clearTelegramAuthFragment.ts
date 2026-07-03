export function isTelegramAuthFragment(hash: string) {
    return hash.startsWith('#tgAuthResult=');
}

export function clearTelegramAuthFragment() {
    if (typeof window === 'undefined') return;
    if (!isTelegramAuthFragment(window.location.hash)) return;

    window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
    );
}
