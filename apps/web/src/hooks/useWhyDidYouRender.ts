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

import { useEffect, useMemo, useRef } from 'react';

interface Props {
    [key: string]: unknown;
}

export function useWhyDidYouRender(name: string, props: Props) {
    // Работает только в dev режиме
    if (process.env.NODE_ENV !== 'development') {
        return;
    }

    const previousProps = useRef<Props | undefined>(undefined);
    
    // Создаем строку из props для использования в зависимостях
    const propsStr = JSON.stringify(props);
    const propsKey = useMemo(() => propsStr, [propsStr]);

    useEffect(() => {
        if (previousProps.current) {
            const allKeys = Object.keys({ ...previousProps.current, ...props });
            const changedProps: Record<string, { from: unknown; to: unknown }> = {};

            allKeys.forEach((key) => {
                if (previousProps.current![key] !== props[key]) {
                    changedProps[key] = {
                        from: previousProps.current![key],
                        to: props[key],
                    };
                }
            });

            if (Object.keys(changedProps).length) {
                // eslint-disable-next-line no-console
                console.group(`[why-did-you-render] ${name}`);
                // eslint-disable-next-line no-console
                console.log('Changed props:', changedProps);
                // eslint-disable-next-line no-console
                console.log('Previous props:', previousProps.current);
                // eslint-disable-next-line no-console
                console.log('Current props:', props);
                // eslint-disable-next-line no-console
                console.groupEnd();
            }
        }

        previousProps.current = props;
    }, [name, propsKey]);
}

