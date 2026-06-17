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
const UI_PRIMITIVE_FILES = [
    path.join(ROOT, 'components/ErrorDisplay.tsx'),
    path.join(ROOT, 'components/ui/Button.tsx'),
    path.join(ROOT, 'components/ui/Card.tsx'),
    path.join(ROOT, 'components/ui/ConfirmDialog.tsx'),
    path.join(ROOT, 'components/ui/FeedbackBanner.tsx'),
    path.join(ROOT, 'components/ui/Input.tsx'),
    path.join(ROOT, 'components/ui/OfflineBanner.tsx'),
    path.join(ROOT, 'components/ui/Toast.tsx'),
];
const THEME_FILES = [...CORE_FILES, ...UI_PRIMITIVE_FILES];

describe('UI text + theme consistency smoke', () => {
    test('core files do not contain replacement character marker', () => {
        for (const filePath of THEME_FILES) {
            const content = fs.readFileSync(filePath, 'utf8');
            expect(content).not.toContain('\uFFFD');
        }
    });

    test('core files avoid inline hex colors', () => {
        const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/;

        for (const filePath of THEME_FILES) {
            const content = fs.readFileSync(filePath, 'utf8');
            expect(content).not.toMatch(hexColorPattern);
        }
    });
});
