import { validateCreateBookingParams, validateCreateGuestBookingParams } from './validation';

describe('core-domain/booking/validation', () => {
    test('validateCreateBookingParams допускает отсутствие services и валидирует базовые поля', () => {
        const result = validateCreateBookingParams({
            biz_id: 'biz-1',
            branch_id: 'branch-1',
            service_id: 'service-1',
            staff_id: 'staff-1',
            start_at: '2025-01-01T10:00:00.000Z',
        });

        expect(result.valid).toBe(true);
        expect(result.data).toEqual({
            biz_id: 'biz-1',
            branch_id: 'branch-1',
            service_id: 'service-1',
            staff_id: 'staff-1',
            start_at: '2025-01-01T10:00:00.000Z',
            services: undefined,
        });
    });

    test('validateCreateBookingParams валидирует массив services и нормализует элементы', () => {
        const result = validateCreateBookingParams({
            biz_id: 'biz-1',
            service_id: 'service-main',
            staff_id: 'staff-1',
            start_at: '2025-01-01T10:00:00.000Z',
            services: [
                { service_id: ' service-1 ', duration_min: 30 },
                { service_id: 'service-2', duration_min: 45, order_index: 2, price_from: 100, price_to: 150 },
            ],
        });

        expect(result.valid).toBe(true);
        expect(result.data?.services).toEqual([
            { service_id: 'service-1', duration_min: 30 },
            { service_id: 'service-2', duration_min: 45, order_index: 2, price_from: 100, price_to: 150 },
        ]);
    });

    test('validateCreateBookingParams возвращает ошибку, если services передан как пустой массив', () => {
        const result = validateCreateBookingParams({
            biz_id: 'biz-1',
            service_id: 'service-main',
            staff_id: 'staff-1',
            start_at: '2025-01-01T10:00:00.000Z',
            services: [],
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Если передан массив services, он не должен быть пустым');
    });

    test('validateCreateGuestBookingParams пробрасывает services и нормализует остальные поля', () => {
        const result = validateCreateGuestBookingParams({
            biz_id: 'biz-1',
            branch_id: 'branch-1',
            service_id: 'service-main',
            staff_id: 'staff-1',
            start_at: '2025-01-01T10:00:00.000Z',
            client_name: ' Test ',
            client_phone: ' +996 555 00-00-00 ',
            services: [{ service_id: 'service-1', duration_min: 30 }],
        });

        expect(result.valid).toBe(true);
        expect(result.data).toMatchObject({
            biz_id: 'biz-1',
            branch_id: 'branch-1',
            service_id: 'service-main',
            staff_id: 'staff-1',
            client_name: 'Test',
            client_phone: '+996555000000',
        });
        expect(result.data?.services).toEqual([{ service_id: 'service-1', duration_min: 30 }]);
    });
});

