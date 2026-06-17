import fs from 'node:fs';
import path from 'node:path';

import { MIN_TOUCH_TARGET } from '../constants/accessibility';

const MOBILE_SRC = path.resolve(__dirname, '..');

function readSource(relativePath: string) {
    return fs.readFileSync(path.join(MOBILE_SRC, relativePath), 'utf8');
}

describe('critical touch target contracts', () => {
    test('uses the practical 44dp minimum', () => {
        expect(MIN_TOUCH_TARGET).toBe(44);
    });

    test.each([
        'components/BookingCancelButton.tsx',
        'components/BookingProgressIndicator.tsx',
        'components/ui/FeedbackBanner.tsx',
        'screens/home/homeScreenStyles.ts',
        'screens/booking/BookingStep1Branch.tsx',
        'screens/booking/BookingStep3Staff.tsx',
        'screens/booking/BookingStep5Time.tsx',
        'screens/shifts/shiftsScreenStyles.ts',
    ])('%s uses the shared minimum touch target', (relativePath) => {
        expect(readSource(relativePath)).toContain('MIN_TOUCH_TARGET');
    });

    test('compact icon actions expose accessible labels', () => {
        expect(readSource('components/BookingCancelButton.tsx')).toContain(
            'accessibilityLabel="Закрыть бронирование"',
        );
        expect(readSource('screens/home/SearchSection.tsx')).toContain(
            'accessibilityLabel="Очистить поиск"',
        );
    });
});
