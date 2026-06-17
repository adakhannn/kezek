import { linking } from '../../navigation/linking';

describe('map linking config', () => {
    test('maps /map deep links to the mobile Map screen', () => {
        const config = linking.config?.screens as Record<string, any>;

        expect(config.Map).toBe('map');
    });
});
