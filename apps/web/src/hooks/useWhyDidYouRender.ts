// apps/web/src/hooks/useWhyDidYouRender.ts
/**
 * Хук для отслеживания причин перерендеров компонентов
 * Использование: добавьте в начало компонента
 * 
 * const MyComponent = () => {
 *   useWhyDidYouRender('MyComponent', { prop1, prop2, state });
 *   ...
 * }
 */

import { useEffect, useRef } from 'react';

import { logDebug } from '@/lib/log';

interface Props {
    [key: string]: unknown;
}

export function useWhyDidYouRender(name: string, props: Props) {
    const previousProps = useRef<Props | undefined>(undefined);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            previousProps.current = undefined;
            return;
        }
        if (previousProps.current) {
            const allKeys = Object.keys({ ...previousProps.current, ...props });
            const changedProps: Record<string, { from: unknown; to: unknown }> = {};

            allKeys.forEach((key) => {
                if (!Object.is(previousProps.current![key], props[key])) {
                    changedProps[key] = {
                        from: previousProps.current![key],
                        to: props[key],
                    };
                }
            });

            if (Object.keys(changedProps).length) {
                logDebug('WhyDidYouRender', 'Component props changed', { name, changedProps });
            }
        }

        previousProps.current = props;
    });
}

