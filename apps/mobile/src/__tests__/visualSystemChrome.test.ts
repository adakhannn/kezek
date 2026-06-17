import fs from 'node:fs';
import path from 'node:path';

const MOBILE_ROOT = path.resolve(__dirname, '../..');

describe('mobile visual system chrome', () => {
    test('native appearance and splash match the dark application shell', () => {
        const appConfig = JSON.parse(
            fs.readFileSync(path.join(MOBILE_ROOT, 'app.json'), 'utf8'),
        ).expo;

        expect(appConfig.userInterfaceStyle).toBe('dark');
        expect(appConfig.splash.backgroundColor).toBe('#030712');
        expect(appConfig.android.adaptiveIcon.backgroundColor).toBe('#030712');
    });

    test('runtime status bar uses light content over the dark shell', () => {
        const appSource = fs.readFileSync(path.join(MOBILE_ROOT, 'App.tsx'), 'utf8');

        expect(appSource).toContain('<StatusBar style="light"');
        expect(appSource).toContain('backgroundColor={colors.surface.page}');
        expect(appSource).not.toContain('<StatusBar style="auto"');
    });
});
