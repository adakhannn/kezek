import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import type { RecentPlace } from './types';

type Props = {
    user: unknown;
    places: RecentPlace[];
    styles: any;
    onOpenPlace: (slug: string) => void;
};

export function HomeRecentPlacesSection({
    user,
    places,
    styles,
    onOpenPlace,
}: Props) {
    if (!user || places.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Недавние места</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentPlacesRow}
            >
                {places.map((place) => (
                    <TouchableOpacity
                        key={place.slug}
                        style={styles.recentPlaceChip}
                        activeOpacity={0.7}
                        onPress={() => onOpenPlace(place.slug)}
                    >
                        <Ionicons
                            name="time-outline"
                            size={16}
                            color={colors.text.secondary}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={styles.recentPlaceText}>{place.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
