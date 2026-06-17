import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = path.resolve(__dirname, '../..');

function read(relativePath: string) {
    return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('keyboard and input UX contracts', () => {
    test('Android uses resize mode so the keyboard does not cover screen content', () => {
        const appConfig = JSON.parse(read('app.json')) as {
            expo?: { android?: { softwareKeyboardLayoutMode?: string } };
        };

        expect(appConfig.expo?.android?.softwareKeyboardLayoutMode).toBe('resize');
    });

    test.each([
        'src/screens/auth/VerifyScreen.tsx',
        'src/screens/auth/WhatsAppScreen.tsx',
        'src/screens/profile/ProfileScreenSections.tsx',
        'src/screens/shiftQuick/ShiftQuickSections.tsx',
    ])('%s keeps forms reachable while the keyboard is open', (relativePath) => {
        const source = read(relativePath);

        expect(source).toContain('KeyboardAvoidingView');
        expect(source).toContain('keyboardShouldPersistTaps="handled"');
        expect(source).toContain('keyboardDismissMode="on-drag"');
        expect(source).toContain('automaticallyAdjustKeyboardInsets');
    });

    test('multi-field forms define next/done focus progression', () => {
        const profile = read('src/screens/profile/ProfileScreenSections.tsx');
        const shift = read('src/screens/shiftQuick/ShiftQuickSections.tsx');

        expect(profile).toContain('returnKeyType="next"');
        expect(profile).toContain('phoneInputRef.current?.focus()');
        expect(profile).toContain('returnKeyType="done"');
        expect(shift).toContain('serviceInputRef.current?.focus()');
        expect(shift).toContain('amountInputRef.current?.focus()');
        expect(shift).toContain('consumablesInputRef.current?.focus()');
    });

    test('search and OTP fields expose keyboard submit behavior', () => {
        const search = read('src/screens/home/SearchSection.tsx');
        const verify = read('src/screens/auth/VerifyScreen.tsx');
        const whatsapp = read('src/screens/auth/WhatsAppScreen.tsx');

        expect(search).toContain('returnKeyType="search"');
        expect(search).toContain('onSubmitEditing={Keyboard.dismiss}');
        expect(verify).toContain('onSubmitEditing');
        expect(whatsapp).toContain('onSubmitEditing');
    });
});
