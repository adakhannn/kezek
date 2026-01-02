import { useCallback, useRef } from 'react';

/**
 * Хук для мемоизации колбэков с зависимостями
 * Полезно для оптимизации производительности
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList
): T {
    const callbackRef = useRef(callback);

    // Обновляем ref при изменении callback
    callbackRef.current = callback;

    // Мемоизируем колбэк с зависимостями
    return useCallback(
        ((...args: Parameters<T>) => {
            return callbackRef.current(...args);
        }) as T,
        deps
    );
}

