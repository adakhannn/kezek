'use client';

import dynamic from 'next/dynamic';
import type { JSX, ComponentType } from 'react';

type BookingFormProps = {
    data: unknown;
};

// Используем dynamic без жёсткой проверки типов модуля и приводим к ожидаемым пропсам
const BookingForm = dynamic(() => import('../view')) as ComponentType<BookingFormProps>;

export function BookingFormClient(props: BookingFormProps): JSX.Element {
    return <BookingForm {...props} />;
}


