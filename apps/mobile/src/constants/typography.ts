import { TextStyle } from 'react-native';

export const typography = {
    display: {
        fontSize: 34,
        lineHeight: 38,
        fontWeight: '700',
        letterSpacing: -0.8,
    } satisfies TextStyle,
    pageTitle: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: '700',
        letterSpacing: -0.6,
    } satisfies TextStyle,
    sectionTitle: {
        fontSize: 20,
        lineHeight: 24,
        fontWeight: '600',
        letterSpacing: -0.3,
    } satisfies TextStyle,
    body: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400',
    } satisfies TextStyle,
    caption: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
    } satisfies TextStyle,
    label: {
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '600',
        letterSpacing: 0.2,
    } satisfies TextStyle,
    metric: {
        fontSize: 30,
        lineHeight: 32,
        fontWeight: '700',
        letterSpacing: -0.8,
    } satisfies TextStyle,
};
