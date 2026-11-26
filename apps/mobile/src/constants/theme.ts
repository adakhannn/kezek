import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { colors } from './colors';

/*
 * Design tokens of the mobile app. docs/mobile/UI_GUIDE.md explains when to use each one.
 * `colors` (constants/colors.ts) stays the palette; this file adds the scales a layout needs.
 */

/** Spacing scale (dp). Use these steps only; never ad-hoc 6, 10, 14, 18, 26. */
export const space = {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
} as const;

/** The one horizontal screen gutter: content, sections and cards start 16dp from the edge. */
export const GUTTER = space.lg;

/** Vertical rhythm: between sections of a screen, and between items inside a section. */
export const layout = {
    gutter: GUTTER,
    sectionGap: space.xxl,
    itemGap: space.md,
    fieldGap: space.lg,
    /** Space a floating tab bar covers at the bottom of a tab screen (bar 74-84 + 12 offset + air). */
    tabBarClearance: Platform.select({ ios: 120, default: 108 }) as number,
    /** Height of the sticky action bar of a form (button 52 + padding). */
    actionBarHeight: 84,
    maxContentWidth: 640,
} as const;

/** Corner radii. Cards `lg`, controls `md`, chips and pills `pill`. */
export const radii = {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    pill: 999,
} as const;

/**
 * Type scale. `display` is for a hero number or a welcome line only; screen titles live in the
 * navigation header, so screens start with `headline` sections, never with a second title.
 */
export const typeScale = {
    display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
    headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
    body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
    bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
    callout: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
    caption: { fontSize: 13, lineHeight: 17, fontWeight: '400' },
    overline: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
    metric: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
} as const satisfies Record<string, TextStyle>;

/** Text colors by importance. `tertiary` only for meta under something that is already readable. */
export const text = {
    primary: colors.text.primary,
    secondary: colors.text.secondary,
    tertiary: colors.text.tertiary,
    onAccent: colors.text.light,
    accent: colors.tone.accent.fg,
    danger: colors.tone.danger.fg,
    success: colors.tone.success.fg,
    warning: colors.tone.warning.fg,
} as const;

/** Surface levels, darkest first: canvas (behind everything) < page < card < raised < overlay. */
export const surface = {
    canvas: colors.surface.canvas,
    page: colors.surface.page,
    card: colors.surface.card,
    raised: colors.surface.elevated,
    emphasis: colors.surface.emphasis,
    overlay: colors.surface.overlay,
} as const;

/** Elevation: dark surfaces read depth from the lighter fill; the shadow only lifts floating things. */
export const elevation = {
    none: {} as ViewStyle,
    card: colors.shadow.sm as ViewStyle,
    raised: colors.shadow.md as ViewStyle,
    floating: colors.shadow.lg as ViewStyle,
} as const;

export type Tone = keyof typeof colors.tone;

export const theme = { space, layout, radii, typeScale, text, surface, elevation, colors } as const;
