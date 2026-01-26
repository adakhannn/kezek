import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

type RatingBadgeProps = {
    rating: number;
    size?: 'small' | 'medium';
};

export default function RatingBadge({ rating, size = 'medium' }: RatingBadgeProps) {
    const fontSize = size === 'small' ? 12 : 14;
    const iconSize = size === 'small' ? 12 : 14;
    const padding = size === 'small' ? 4 : 6;

    return (
        <View style={[styles.container, { paddingHorizontal: padding, paddingVertical: padding / 2 }]}>
            <Ionicons name="star" size={iconSize} color="#f59e0b" />
            <Text style={[styles.rating, { fontSize }]}>{rating.toFixed(1)}</Text>
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
    rating: {
        fontWeight: '600',
        color: '#d97706',
    },
});

