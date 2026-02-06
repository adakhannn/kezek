// apps/web/src/app/staff/finance/hooks/useServiceOptions.ts

import { useMemo } from 'react';

import type { ServiceName, ShiftItem, Booking } from '../types';
import { getServiceName } from '../utils';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

/**
 * Хук для формирования списка доступных услуг
 */
export function useServiceOptions(
    availableServices: ServiceName[],
    bookings: Booking[],
    items: ShiftItem[]
): ServiceName[] {
    const { locale } = useLanguage();

    return useMemo(() => {
        const set = new Set<string>();
        const serviceMap = new Map<string, ServiceName>();
        
        // Услуги сотрудника из настроек
        for (const svc of availableServices) {
            if (svc?.name_ru?.trim()) {
                const key = svc.name_ru.trim();
                set.add(key);
                serviceMap.set(key, svc);
            }
        }
        
        // Услуги из сегодняшних записей
        for (const b of bookings) {
            if (b.services) {
                const list = Array.isArray(b.services) ? b.services : [b.services];
                for (const s of list) {
                    if (s?.name_ru?.trim()) {
                        const key = s.name_ru.trim();
                        set.add(key);
                        serviceMap.set(key, s);
                    }
                }
            }
        }
        
        // Учитываем уже введённые вручную названия услуг в строках смены
        for (const it of items) {
            if (it.serviceName?.trim()) {
                const key = it.serviceName.trim();
                set.add(key);
                // Если это не было в списке услуг, создаем объект только с name_ru
                if (!serviceMap.has(key)) {
                    serviceMap.set(key, { name_ru: key });
                }
            }
        }
        
        // Возвращаем массив объектов ServiceName, отсортированный по переведенному названию
        return Array.from(set)
            .map(key => serviceMap.get(key)!)
            .sort((a, b) => {
                const nameA = getServiceName(a, locale);
                const nameB = getServiceName(b, locale);
                return nameA.localeCompare(nameB, locale === 'ru' ? 'ru' : locale === 'ky' ? 'ky' : 'en');
            });
    }, [availableServices, bookings, items, locale]);
}

