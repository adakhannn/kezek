import {
    clampRating,
    getRatingWindow,
    interpretRatingScore,
    isActiveStaffDay,
    isDateInRatingWindow,
    isDefaultRating,
    isRatingUninitialized,
    type RatingSemantics,
} from '@shared-client/rating';

describe('rating domain helpers (shared-client/rating)', () => {
    describe('interpretRatingScore / isRatingUninitialized / isDefaultRating', () => {
        test('NULL трактуется как неинициализированный рейтинг', () => {
            const semantics: RatingSemantics = interpretRatingScore(null);
            expect(semantics.kind).toBe('uninitialized');
            expect(semantics.value).toBeNull();
            expect(isRatingUninitialized(null)).toBe(true);
            expect(isDefaultRating(null)).toBe(false);
        });

        test('50.0 трактуется как дефолтный стартовый рейтинг', () => {
            const semantics: RatingSemantics = interpretRatingScore(50);
            expect(semantics.kind).toBe('default');
            expect(semantics.value).toBe(50);
            expect(isDefaultRating(50)).toBe(true);
            expect(isRatingUninitialized(50)).toBe(false);
        });

        test('произвольное значение 0–100 трактуется как обычный рейтинг', () => {
            const semantics: RatingSemantics = interpretRatingScore(12.34);
            expect(semantics.kind).toBe('value');
            expect(semantics.value).toBeCloseTo(12.34, 2);
            expect(isDefaultRating(12.34)).toBe(false);
            expect(isRatingUninitialized(12.34)).toBe(false);
        });

        test('значения вне диапазона принудительно клампятся в 0–100', () => {
            expect(clampRating(-10)).toBe(0);
            expect(clampRating(150)).toBe(100);

            const low = interpretRatingScore(-5);
            const high = interpretRatingScore(200);

            expect(low.kind).toBe('value');
            expect(low.value).toBe(0);
            expect(high.kind).toBe('value');
            expect(high.value).toBe(100);
        });
    });

    describe('getRatingWindow / isDateInRatingWindow', () => {
        test('окно включает N полных дней до today и исключает текущий день', () => {
            const today = new Date(Date.UTC(2024, 0, 31)); // 2024‑01‑31
            const { startDate, endDateExclusive } = getRatingWindow(3, today);

            expect(startDate).toBe('2024-01-28'); // 28,29,30
            expect(endDateExclusive).toBe('2024-01-31'); // today, но исключено

            expect(isDateInRatingWindow('2024-01-28', 3, today)).toBe(true);
            expect(isDateInRatingWindow('2024-01-29', 3, today)).toBe(true);
            expect(isDateInRatingWindow('2024-01-30', 3, today)).toBe(true);

            // Граница включения/исключения
            expect(isDateInRatingWindow('2024-01-27', 3, today)).toBe(false);
            expect(isDateInRatingWindow('2024-01-31', 3, today)).toBe(false);
        });

        test('окно корректно работает при маленьких и больших значениях N', () => {
            const today = new Date(Date.UTC(2024, 5, 15));

            const win1 = getRatingWindow(0, today); // clamp до хотя бы 1
            const win365 = getRatingWindow(999, today); // clamp до 365

            expect(win1.startDate < win1.endDateExclusive).toBe(true);
            expect(win365.startDate < win365.endDateExclusive).toBe(true);
        });
    });

    describe('isActiveStaffDay (семантика "пустых" дней)', () => {
        test('день без смен, клиентов и отзывов считается неактивным', () => {
            expect(
                isActiveStaffDay({
                    total_shifts: 0,
                    clients_count: 0,
                    reviews_count: 0,
                }),
            ).toBe(false);
        });

        test('наличие хотя бы одной смены делает день активным', () => {
            expect(
                isActiveStaffDay({
                    total_shifts: 1,
                    clients_count: 0,
                    reviews_count: 0,
                }),
            ).toBe(true);
        });

        test('наличие хотя бы одного клиента делает день активным', () => {
            expect(
                isActiveStaffDay({
                    total_shifts: 0,
                    clients_count: 1,
                    reviews_count: 0,
                }),
            ).toBe(true);
        });

        test('наличие хотя бы одного отзыва делает день активным', () => {
            expect(
                isActiveStaffDay({
                    total_shifts: 0,
                    clients_count: 0,
                    reviews_count: 1,
                }),
            ).toBe(true);
        });
    });
});

