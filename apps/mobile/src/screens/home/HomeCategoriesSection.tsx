import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../constants/colors';

type Props = {
    styles: any;
    categories: string[];
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
};

export function HomeCategoriesSection({
    styles,
    categories,
    selectedCategory,
    onSelectCategory,
}: Props) {
    if (categories.length === 0) {
        return null;
    }

    return (
        <View style={styles.categoriesContainer}>
            <Text style={styles.categoriesLabel}>Популярные категории:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                <TouchableOpacity
                    style={[
                        styles.categoryChip,
                        !selectedCategory && styles.categoryChipActive,
                    ]}
                    onPress={() => onSelectCategory(null)}
                >
                    {!selectedCategory ? (
                        <LinearGradient
                            colors={[colors.primary.from, colors.primary.to]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.categoryChipGradient}
                        >
                            <Text style={styles.categoryChipTextActive}>Все</Text>
                        </LinearGradient>
                    ) : (
                        <Text style={styles.categoryChipText}>Все</Text>
                    )}
                </TouchableOpacity>
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category}
                        style={[
                            styles.categoryChip,
                            selectedCategory === category && styles.categoryChipActive,
                        ]}
                        onPress={() => onSelectCategory(category)}
                    >
                        {selectedCategory === category ? (
                            <LinearGradient
                                colors={[colors.primary.from, colors.primary.to]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.categoryChipGradient}
                            >
                                <Text style={styles.categoryChipTextActive}>{category}</Text>
                            </LinearGradient>
                        ) : (
                            <Text style={styles.categoryChipText}>{category}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
