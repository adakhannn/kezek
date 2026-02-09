// apps/web/src/hooks/useRenderCount.ts
/**
 * Хук для подсчета количества рендеров компонента
 * Использование: добавьте в начало компонента
 * 
 * const MyComponent = () => {
 *   const renderCount = useRenderCount('MyComponent');
 *   console.log('MyComponent rendered', renderCount, 'times');
 *   ...
 * }
 */

import { useEffect, useRef } from 'react';

export function useRenderCount(componentName: string) {
    const renderCount = useRef(0);
    
    // Работает только в dev режиме
    if (process.env.NODE_ENV !== 'development') {
        return 0;
    }

    renderCount.current += 1;

    useEffect(() => {
        if (renderCount.current > 5) {
            console.warn(
                `[render-count] ${componentName} has rendered ${renderCount.current} times. ` +
                'Consider optimizing with React.memo, useMemo, or useCallback.'
            );
        }
    });

    return renderCount.current;
}

