import { Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RatingBadge from '../../components/ui/RatingBadge';
import { colors } from '../../constants/colors';
import { formatPhone } from '../../utils/format';

type Business = {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
};

type Props = {
    styles: any;
    isLoading: boolean;
    refreshing: boolean;
    businesses: Business[] | undefined;
    search: string;
    selectedCategory: string | null;
    onOpenBusiness: (slug: string) => void;
};

export function HomeBusinessListSection({
    styles,
    isLoading,
    refreshing,
    businesses,
    search,
    selectedCategory,
    onOpenBusiness,
}: Props) {
    if (isLoading && !refreshing) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!businesses || businesses.length === 0) {
        return (
            <EmptyState
                icon="search"
                title={search || selectedCategory ? 'Ничего не найдено' : 'Нет доступных бизнесов'}
                message={search || selectedCategory ? 'Попробуйте другой запрос' : 'Бизнесы появятся здесь после регистрации'}
            />
        );
    }

    return (
        <View style={styles.businessList}>
            {businesses.map((business) => (
                <TouchableOpacity
                    key={business.id}
                    onPress={() => onOpenBusiness(business.slug)}
                    activeOpacity={0.7}
                >
                    <Card style={styles.businessCard}>
                        <View style={styles.businessHeader}>
                            <View style={styles.businessNameRow}>
                                <Text style={styles.businessName}>{business.name}</Text>
                                <RatingBadge rating={business.rating_score ?? null} size="small" />
                            </View>
                        </View>

                        {business.address && (
                            <View style={styles.businessInfo}>
                                <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
                                <Text style={styles.businessAddress}>{business.address}</Text>
                            </View>
                        )}

                        {business.phones && business.phones.length > 0 && (
                            <View style={styles.businessInfo}>
                                <Ionicons name="call-outline" size={16} color={colors.text.secondary} />
                                <Text style={styles.businessPhone}>
                                    {formatPhone(business.phones[0])}
                                </Text>
                            </View>
                        )}

                        {business.categories && business.categories.length > 0 && (
                            <View style={styles.businessCategories}>
                                {business.categories.map((category) => (
                                    <View key={category} style={styles.businessCategoryTag}>
                                        <Text style={styles.businessCategoryText}>{category}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={styles.businessFooter}>
                            <LinearGradient
                                colors={[colors.primary.from, colors.primary.to]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.bookButton}
                            >
                                <Text style={styles.bookButtonText}>Записаться</Text>
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </LinearGradient>
                        </View>
                    </Card>
                </TouchableOpacity>
            ))}
        </View>
    );
}
