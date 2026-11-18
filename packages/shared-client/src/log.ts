/**
 * Безопасное логирование для клиентских приложений (web и mobile)
 * Автоматически маскирует чувствительные данные
 *
 * @param isDev - Функция для определения dev режима (для web: () => process.env.NODE_ENV !== 'production', для mobile: () => __DEV__)
 * @param options - Что печатать в production и куда отдавать события мониторинга (ARCH-04).
 *   По умолчанию production печатает только сообщение ошибки и молчит о предупреждениях (mobile).
 */

import { safeExtra, sanitizeText } from './logSafe';

export type IsDevFn = () => boolean;

/** Extra routing data for monitoring; never printed. */
export type LogMeta = {
    /** A 5xx response reported by the API layer (deduplicated per request by monitoring). */
    kind?: 'api_response';
    tags?: Record<string, string>;
};

/** A warning or error handed to monitoring. `extra` is the raw value (Errors stay Errors). */
export type LogEvent = {
    level: 'warn' | 'error';
    scope: string;
    message: string;
    extra?: unknown;
    meta?: LogMeta;
};

export type LogSink = (event: LogEvent) => void;

type Setting<T> = T | (() => T);

export type LoggerOptions = {
    /** Production output: 'message' (default) or 'summary' - one line with sanitized JSON details. */
    productionDetail?: Setting<'message' | 'summary'>;
    /** Print warnings in production (default false). */
    productionWarnings?: Setting<boolean>;
    /** Receives every warning and error (monitoring); its failures never reach the caller. */
    sink?: LogSink;
};

type Detail = 'full' | 'summary' | 'message';

const SUMMARY_LIMIT = 2000;

function read<T>(setting: Setting<T>): T {
    return typeof setting === 'function' ? (setting as () => T)() : setting;
}

/**
 * Создаёт функции логирования с указанной функцией определения dev режима
 */
export function createLogger(isDev: IsDevFn, options: LoggerOptions = {}) {
    const productionDetail = options.productionDetail ?? 'message';
    const productionWarnings = options.productionWarnings ?? false;

    function write(method: 'log' | 'warn' | 'error', scope: string, message: string, extra: unknown, detail: Detail) {
        const head = `[${scope}] ${sanitizeText(message)}`;
        // Looked up at call time, so test spies on console keep working.
        // eslint-disable-next-line no-console
        const print = console[method];
        if (extra === undefined || detail === 'message') {
            print(head);
            return;
        }
        if (detail === 'full') {
            print(head, safeExtra(extra));
            return;
        }
        let json: string | undefined;
        try {
            json = JSON.stringify(safeExtra(extra));
        } catch {
            print(`${head} "[Unserializable]"`);
            return;
        }
        if (json === undefined) {
            print(head);
            return;
        }
        print(`${head} ${json.length > SUMMARY_LIMIT ? `${json.slice(0, SUMMARY_LIMIT)}…` : json}`);
    }

    function notify(level: LogEvent['level'], scope: string, message: string, extra: unknown, meta?: LogMeta) {
        if (!options.sink) return;
        try {
            options.sink({ level, scope, message: sanitizeText(message), extra, meta });
        } catch {
            // Monitoring must never break the code that logs.
        }
    }

    /**
     * Безопасное логирование debug информации (только в dev)
     * Автоматически маскирует чувствительные данные
     */
    function logDebug(scope: string, message: string, extra?: unknown) {
        if (!isDev()) return;
        write('log', scope, message, extra, 'full');
    }

    /**
     * Безопасное логирование предупреждений: в dev всегда, в production — если включено опцией.
     * Автоматически маскирует чувствительные данные
     */
    function logWarn(scope: string, message: string, extra?: unknown, meta?: LogMeta) {
        if (isDev()) write('warn', scope, message, extra, 'full');
        else if (read(productionWarnings)) write('warn', scope, message, extra, read(productionDetail));
        notify('warn', scope, message, extra, meta);
    }

    /**
     * Безопасное логирование ошибок (в dev и prod); детали в production — по опции.
     * Автоматически маскирует чувствительные данные
     */
    function logError(scope: string, message: string, extra?: unknown, meta?: LogMeta) {
        write('error', scope, message, extra, isDev() ? 'full' : read(productionDetail));
        notify('error', scope, message, extra, meta);
    }

    return {
        logDebug,
        logWarn,
        logError,
    };
}

/**
 * Экспортируем утилиты для маскирования
 */
export { maskToken, maskUrl, safeExtra, sanitizeObject, sanitizeText, toLoggable } from './logSafe';
