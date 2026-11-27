import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { formatRatingDisplayValue } from '@shared-client/rating';

import { colors } from '../../constants/colors';
import { radii, space } from '../../constants/theme';
import { useLanguage } from '../../i18n';

type RatingBadgeProps = {
    /** Rating 0-100 or null when it has not been initialized yet; shown on the 0-5 scale, as on the web. */
    rating: number | null;
    size?: 'small' | 'medium';
};

export default function RatingBadge({ rating, size = 'medium' }: RatingBadgeProps) {
    const { t } = useLanguage();
    const fontSize = size === 'small' ? 12 : 14;
    const iconSize = size === 'small' ? 12 : 14;
    const padding = size === 'small' ? 4 : 6;
    const isNull = rating === null || rating === undefined;
    const isLow = typeof rating === 'number' && rating <= 10;

    if (isNull) {
        return (
            <View
                style={[styles.containerNoRating, { paddingHorizontal: padding, paddingVertical: padding / 2 }]}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
            >
                {/* As the web: a business, branch or master without enough reviews says so, not a bare dash. */}
                <Text style={[styles.ratingNoRating, { fontSize }]}>{t('common.rating.noRating')}</Text>
            </View>
        );
    }

    const value = Number(rating);
    return (
        <View
            style={[
                styles.container,
                isLow && styles.containerLow,
                { paddingHorizontal: padding, paddingVertical: padding / 2 },
            ]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
        >
            <Ionicons
                name="star"
                size={iconSize}
                color={isLow ? colors.tone.danger.fg : colors.tone.warning.fg}
                accessible={false}
                importantForAccessibility="no"
            />
            <Text style={[styles.rating, isLow && styles.ratingLow, { fontSize }]}>{formatRatingDisplayValue(value)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        backgroundColor: colors.tone.warning.bg,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.tone.warning.border,
    },
    containerLow: {
        backgroundColor: colors.tone.danger.bg,
        borderColor: colors.tone.danger.border,
    },
    containerNoRating: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.tone.neutral.bg,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.tone.neutral.border,
    },
    rating: {
        fontWeight: '600',
        color: colors.tone.warning.fg,
    },
    ratingLow: {
        color: colors.tone.danger.fg,
    },
    ratingNoRating: {
        fontWeight: '500',
        color: colors.tone.neutral.fg,
    },
});
