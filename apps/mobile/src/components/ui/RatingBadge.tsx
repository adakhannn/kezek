import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type RatingBadgeProps = {
    /** Рейтинг 0–100 или null (не инициализирован). */
    rating: number | null;
    size?: 'small' | 'medium';
};

export default function RatingBadge({ rating, size = 'medium' }: RatingBadgeProps) {
    const fontSize = size === 'small' ? 12 : 14;
    const iconSize = size === 'small' ? 12 : 14;
    const padding = size === 'small' ? 4 : 6;
    const isNull = rating === null || rating === undefined;
    const isLow = typeof rating === 'number' && rating <= 10;

    if (isNull) {
        return (
            <View style={[styles.containerNoRating, { paddingHorizontal: padding, paddingVertical: padding / 2 }]}>
                <Text style={[styles.ratingNoRating, { fontSize }]}>—</Text>
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
        >
            <Ionicons name="star" size={iconSize} color={isLow ? '#b45309' : '#f59e0b'} />
            <Text style={[styles.rating, isLow && styles.ratingLow, { fontSize }]}>{value.toFixed(1)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    containerLow: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(180, 83, 9, 0.4)',
    },
    containerNoRating: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(156, 163, 175, 0.15)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(107, 114, 128, 0.3)',
    },
    rating: {
        fontWeight: '600',
        color: '#d97706',
    },
    ratingLow: {
        color: '#b45309',
    },
    ratingNoRating: {
        fontWeight: '500',
        color: '#6b7280',
    },
});

