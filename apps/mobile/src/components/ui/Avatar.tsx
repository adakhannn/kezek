import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { displayStorageUrl } from '../../lib/supabaseProxy';

/** Two letters of a name: "Айгерим Касымова" -> "АК", "Bolot" -> "BO". */
export function initialsOf(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/* A stable color per name, so the same person keeps one color across lists. */
// Every fill keeps white initials at WCAG AA (>= 4.5:1).
const FILLS = ['#4f46e5', '#7c3aed', '#be185d', '#0e7490', '#047857', '#b45309', '#2563eb', '#9333ea'];
function fillFor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return FILLS[Math.abs(hash) % FILLS.length];
}

type AvatarProps = {
    name?: string | null;
    uri?: string | null;
    /** Diameter in dp: 32 dense lists, 40 lists (default), 56 headers, 88 profile. */
    size?: number;
    /** A ring in the accent color (selected, "you"). */
    ring?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** A person's photo, or their initials on a stable color when there is no photo or it fails to load. */
export default function Avatar({ name, uri, size = 40, ring = false, style, testID }: AvatarProps) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [uri]);
    const label = name ?? '';
    const box = { width: size, height: size, borderRadius: size / 2 };
    const showImage = Boolean(uri) && !failed;
    return (
        <View
            style={[styles.wrap, box, !showImage ? { backgroundColor: fillFor(label) } : null, ring ? styles.ring : null, style]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID={testID}
        >
            {showImage ? (
                <Image
                    source={{ uri: displayStorageUrl(uri!) }}
                    style={[StyleSheet.absoluteFill, box]}
                    onError={() => setFailed(true)}
                    accessibilityIgnoresInvertColors
                    testID={testID ? `${testID}-image` : undefined}
                />
            ) : (
                <Text style={[styles.initials, { fontSize: Math.max(11, Math.round(size * 0.38)) }]} allowFontScaling={false}>
                    {initialsOf(label)}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: colors.surface.elevated,
    },
    ring: { borderWidth: 2, borderColor: colors.accent.indigo },
    initials: { color: colors.text.light, fontWeight: '700', letterSpacing: 0.3 },
});
