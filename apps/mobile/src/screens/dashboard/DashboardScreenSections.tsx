import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import { useLanguage } from '../../i18n';
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
    const { t } = useLanguage();
    return (
        <ScrollView
            style={styles.container}
            testID="dashboard-screen"
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
            }
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('staff.dashboard.title')}</Text>
                <Text style={styles.subtitle}>
                    {t(businesses.length === 1 ? 'staff.dashboard.subtitleOne' : 'staff.dashboard.subtitleMany')}
                </Text>
            </View>

            {businesses.length > 0 ? (
                <View style={styles.businessList}>
                    {businesses.map((business) => (
                        <MotionPressable
                            key={business.id}
                            onPress={() => onBusinessPress(business.id)}
                            style={styles.businessPressable}
                            scale="firm"
                        >
                            <Card style={styles.businessCard}>
                                <Text style={styles.businessName}>{business.name}</Text>
                                {business.address ? (
                                    <Text style={styles.businessAddress}>{business.address}</Text>
                                ) : null}
                                {business.phones?.length ? (
                                    <Text style={styles.businessPhone}>{business.phones[0]}</Text>
                                ) : null}
                                <View style={styles.businessActions}>
                                    <Button
                                        title={t('staff.dashboard.openWeb')}
                                        onPress={() => onBusinessPress(business.id)}
                                        variant="outline"
                                        fullWidth
                                    />
                                </View>
                            </Card>
                        </MotionPressable>
                    ))}
                </View>
            ) : (
                <EmptyState
                    icon="business"
                    title={t('staff.dashboard.emptyTitle')}
                    message={t('staff.dashboard.emptyMessage')}
                />
            )}
        </ScrollView>
    );
}
