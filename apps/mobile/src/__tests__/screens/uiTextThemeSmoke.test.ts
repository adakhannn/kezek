import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const CORE_FILES = [
    path.join(ROOT, 'screens/auth/SignInScreen.tsx'),
    path.join(ROOT, 'screens/auth/VerifyScreen.tsx'),
    path.join(ROOT, 'screens/auth/WhatsAppScreen.tsx'),
    path.join(ROOT, 'screens/home/homeScreenStyles.ts'),
    path.join(ROOT, 'screens/profile/profileScreenStyles.ts'),
];

describe('UI text + theme consistency smoke', () => {
    test('core files do not contain replacement character marker', () => {
        for (const filePath of CORE_FILES) {
            const content = fs.readFileSync(filePath, 'utf8');
            expect(content).not.toContain('\uFFFD');
        }
    });

    test('core files avoid inline hex colors', () => {
        const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/;

        for (const filePath of CORE_FILES) {
            const content = fs.readFileSync(filePath, 'utf8');
            expect(content).not.toMatch(hexColorPattern);
        }
    });
});
