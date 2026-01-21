const isDev = process.env.NODE_ENV !== 'production';

export function logDebug(scope: string, message: string, extra?: unknown) {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.log(`[${scope}] ${message}`, extra ?? '');
}

export function logWarn(scope: string, message: string, extra?: unknown) {
    if (!isDev) return;
     
    console.warn(`[${scope}] ${message}`, extra ?? '');
}

export function logError(scope: string, message: string, extra?: unknown) {
    // Ошибки всегда логируем и в dev, и в prod
     
    console.error(`[${scope}] ${message}`, extra ?? '');
}


