'use client';

import dynamic from 'next/dynamic';
import type { ReactElement, ComponentType } from 'react';

type BookingsClientProps = {
    bizId: string;
    services: unknown[];
    staff: unknown[];
    branches: unknown[];
    initial: unknown[];
};

// Используем dynamic без жёсткой проверки типов модуля и приводим к ожидаемым пропсам
const BookingsClient = dynamic(() => import('./view')) as ComponentType<BookingsClientProps>;

export function BookingsClientWrapper(props: BookingsClientProps): ReactElement {
    return <BookingsClient {...props} />;
}


