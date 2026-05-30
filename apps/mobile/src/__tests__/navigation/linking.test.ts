import { linking } from '../../navigation/linking';

describe('linking config', () => {
    test('maps nested cabinet profile route', () => {
        const config = linking.config?.screens as Record<string, any>;
        expect(config.Main.screens.Cabinet.screens.CabinetMain).toBe('cabinet');
        expect(config.Main.screens.Cabinet.screens.Profile).toBe('cabinet/profile');
    });
});
