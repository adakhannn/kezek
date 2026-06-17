import { colors } from '../constants/colors';

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
    const hex = value.replace('#', '');
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as Rgb;
}

function relativeLuminance(value: string): number {
    const channels = parseHex(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

function composite(foreground: string, background: string, alpha: number): string {
    const foregroundRgb = parseHex(foreground);
    const backgroundRgb = parseHex(background);
    const channels = foregroundRgb.map((channel, index) =>
        Math.round(channel * alpha + backgroundRgb[index] * (1 - alpha)),
    );

    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe('semantic theme contrast', () => {
    test.each([
        ['primary on page', colors.text.primary, colors.surface.canvas],
        ['secondary on page', colors.text.secondary, colors.surface.canvas],
        ['tertiary on card', colors.text.tertiary, colors.surface.card],
        ['primary gradient start', colors.text.light, colors.brand.primaryFrom],
        ['primary gradient end', colors.text.light, colors.brand.primaryTo],
        ['danger CTA', colors.text.dangerButton, colors.status.danger],
        ['WhatsApp CTA', colors.auth.whatsAppButtonText, colors.auth.whatsAppButtonBackground],
    ])('%s is at least WCAG AA for normal text', (_name, foreground, background) => {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    });

    test('Telegram CTA remains readable over its translucent auth surface', () => {
        const telegramSurface = composite('#60a5fa', colors.auth.shellCardBackground, 0.16);
        expect(contrastRatio(colors.auth.telegramButtonText, telegramSurface)).toBeGreaterThanOrEqual(4.5);
    });

    test('disabled controls remain visibly distinct instead of nearly disappearing', () => {
        expect(colors.interactive.disabledOpacity).toBeGreaterThanOrEqual(0.7);
    });
});
