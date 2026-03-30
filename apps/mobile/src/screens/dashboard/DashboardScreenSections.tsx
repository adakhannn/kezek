import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { styles } from './dashboardScreenStyles';
import type { Business } from './types';

type Props = {
    businesses: Business[];
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    onBusinessPress: (businessId: string) => void;
};

export function DashboardScreenSections({
    businesses,
    refreshing,
    onRefresh,
    onBusinessPress,
}: Props) {
    return (
        <ScrollView
            style={styles.container}
            testID="dashboard-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Кабинет бизнеса</Text>
                <Text style={styles.subtitle}>
                    Управление {businesses.length === 1 ? 'бизнесом' : 'бизнесами'}
                </Text>
            </View>

            {businesses.length > 0 ? (
                <View style={styles.businessList}>
                    {businesses.map((business) => (
                        <TouchableOpacity key={business.id} onPress={() => onBusinessPress(business.id)}>
                            <Card style={styles.businessCard}>
                                <Text style={styles.businessName}>{business.name}</Text>
                                {business.address && (
                                    <Text style={styles.businessAddress}>{business.address}</Text>
                                )}
                                {business.phones && business.phones.length > 0 && (
                                    <Text style={styles.businessPhone}>{business.phones[0]}</Text>
                                )}
                                <View style={styles.businessActions}>
                                    <Button
                                        title="Управление"
                                        onPress={() => onBusinessPress(business.id)}
                                        variant="outline"
                                        style={styles.actionButton}
                                    />
                                </View>
                            </Card>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <EmptyState
                    icon="business"
                    title="Нет бизнесов"
                    message="Зарегистрируйте бизнес, чтобы начать управление"
                />
            )}
        </ScrollView>
    );
}
