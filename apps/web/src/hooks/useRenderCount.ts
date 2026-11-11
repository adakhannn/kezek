// apps/web/src/hooks/useRenderCount.ts
/**
 * Диагностический счётчик завершённых рендеров компонента.
 * Использование: добавьте в начало компонента
 * 
 * const MyComponent = () => {
 *   const getRenderCount = useRenderCount('MyComponent');
 *   // Читать getRenderCount() в handler/effect, не во время render.
 *   ...
 * }
 */

import { useCallback, useEffect, useRef } from 'react';

import { logWarn } from '@/lib/log';

export function useRenderCount(componentName: string) {
    const renderCount = useRef(0);
    const previousCommit = useRef<object | null>(null);
    const render = {};
    const isDevelopment = process.env.NODE_ENV === 'development';

    useEffect(() => {
        if (!isDevelopment || previousCommit.current === render) return;
        // StrictMode replays effects for the same render; count that commit once.
        previousCommit.current = render;
        renderCount.current += 1;
        if (renderCount.current > 5) {
            logWarn('RenderCount', 'Frequent component renders; inspect props and memoization.', {
                componentName,
                renderCount: renderCount.current,
            });
        }
    });

    return useCallback(() => isDevelopment ? renderCount.current : 0, [isDevelopment]);
}

