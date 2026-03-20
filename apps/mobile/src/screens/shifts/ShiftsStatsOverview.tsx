import { Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import { formatPrice } from '../../utils/format';
import { styles } from './styles';
import type { Stats } from './types';

export function ShiftsStatsOverview({ stats }: { stats: Stats }) {
    return (
        <>
            <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Оборот</Text>
                    <Text style={styles.statValue}>{formatPrice(stats.totalAmount)}</Text>
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Доля сотрудника</Text>
                    <Text style={[styles.statValue, styles.statValueEmployee]}>
                        {formatPrice(stats.totalMaster)}
                    </Text>
                    {stats.totalAmount > 0 && (
                        <Text style={styles.statPercent}>
                            {((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%
                        </Text>
                    )}
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Доля бизнеса</Text>
                    <Text style={[styles.statValue, styles.statValueBusiness]}>
                        {formatPrice(stats.totalSalon)}
                    </Text>
                    {stats.totalAmount > 0 && (
                        <Text style={styles.statPercent}>
                            {((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%
                        </Text>
                    )}
                </Card>
            </View>

            <View style={styles.additionalStats}>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Смен</Text>
                    <Text style={styles.additionalStatValue}>{stats.shiftsCount}</Text>
                </Card>

                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Расходники</Text>
                    <Text style={styles.additionalStatValue}>{formatPrice(stats.totalConsumables)}</Text>
                </Card>

                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Опоздания</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalLateMinutes} мин</Text>
                </Card>

                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Клиентов</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalClients}</Text>
                </Card>
            </View>
        </>
    );
}
