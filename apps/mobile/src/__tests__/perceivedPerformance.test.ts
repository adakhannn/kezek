import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = path.resolve(__dirname, '../..');

function read(relativePath: string) {
    return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('perceived performance contracts', () => {
    test('booking first paint only blocks on business and branch data', () => {
        const source = read('src/screens/bookingFlow/useBookingScreenData.ts');
        const criticalQuery = source.slice(
            source.indexOf("queryKey: ['business-init', slug]"),
            source.indexOf('const branchIds ='),
        );

        expect(criticalQuery).toContain(".from('businesses')");
        expect(criticalQuery).toContain(".from('branches')");
        expect(criticalQuery).not.toContain(".from('services')");
        expect(criticalQuery).not.toContain(".from('staff')");
        expect(criticalQuery).not.toContain(".from('branch_promotions')");
    });

    test('booking screen passes prepared data into step one to avoid a duplicate query', () => {
        const bookingScreen = read('src/screens/BookingScreen.tsx');
        const stepOne = read('src/screens/booking/BookingStep1Branch.tsx');

        expect(bookingScreen).toContain('<BookingStep1Branch initialData={initialData} />');
        expect(stepOne).toContain('slug: preparedData ? undefined : slug');
    });

    test('promotion loading remains outside the first meaningful paint path', () => {
        const source = read('src/screens/bookingFlow/useBookingScreenData.ts');

        expect(source).toContain("queryKey: ['booking-promotions'");
        expect(source).toContain('InteractionManager.runAfterInteractions');
        expect(source).toContain('enabled: canLoadPromotions && branchIds.length > 0');
        expect(source).toContain('isLoading: businessQuery.isLoading');
    });

    test('booking context hydration uses a single state commit', () => {
        const context = read('src/contexts/BookingContext.tsx');
        const source = read('src/screens/bookingFlow/useBookingScreenData.ts');

        expect(context).toContain('const hydrateInitialData = useCallback');
        expect(source).toContain('hydrateInitialData(businessQuery.data)');
        expect(source).not.toContain('setBusiness(businessQuery.data.business)');
        expect(source).not.toContain('setBranches(businessQuery.data.branches)');
    });

    test('booking loading state paints recognizable business context immediately', () => {
        const home = read('src/screens/HomeScreen.tsx');
        const booking = read('src/screens/BookingScreen.tsx');

        expect(home).toContain("rootNavigation.navigate('Booking', { slug, previewName })");
        expect(booking).toContain("previewName || 'Запись'");
        expect(booking).toContain('<BookingProgressIndicator currentStep={1} />');
    });
});
