import fs from 'node:fs';
import path from 'node:path';

const BASELINE_ROOT = path.resolve(__dirname, '../../../../docs/mobile-visual-baselines');

function readPngDimensions(filePath: string) {
    const png = fs.readFileSync(filePath);
    const signature = png.subarray(0, 8).toString('hex');

    expect(signature).toBe('89504e470d0a1a0a');

    return {
        width: png.readUInt32BE(16),
        height: png.readUInt32BE(20),
    };
}

describe('mobile visual baseline artifacts', () => {
    test.each([
        'auth-360dp.png',
        'auth-412dp.png',
        'whatsapp-entry-412dp.png',
    ])('%s is a full emulator screenshot', (name) => {
        expect(readPngDimensions(path.join(BASELINE_ROOT, name))).toEqual({
            width: 1440,
            height: 3120,
        });
    });

    test('auth CTA hierarchy remains Google, Telegram, then WhatsApp', () => {
        const signInSource = fs.readFileSync(
            path.resolve(__dirname, '../screens/auth/SignInScreen.tsx'),
            'utf8',
        );
        // The button titles are dictionary keys (src/i18n/dictionaries/auth.*.ts).
        const google = signInSource.indexOf("t('auth.signIn.google')");
        const telegram = signInSource.indexOf("t('auth.signIn.telegram')");
        const whatsApp = signInSource.indexOf("t('auth.signIn.whatsapp')");

        expect(google).toBeGreaterThan(-1);
        expect(telegram).toBeGreaterThan(google);
        expect(whatsApp).toBeGreaterThan(telegram);
        expect(signInSource).not.toContain('Регистрация');
        expect(signInSource).not.toContain('Отправить код на email');
    });
});
