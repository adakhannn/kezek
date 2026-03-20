import { Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import { formatPrice } from '../../utils/format';
import { styles } from './styles';

type Props = {
    totalAmount: number;
    finalMasterShare: number;
    currentGuaranteed: number;
    baseMasterShare: number;
    itemsCount: number;
};

export function ShiftQuickStatsGrid({
    totalAmount,
    finalMasterShare,
    currentGuaranteed,
    baseMasterShare,
    itemsCount,
}: Props) {
    return (
        <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Оборот</Text>
                <Text style={styles.statValue}>{formatPrice(totalAmount)}</Text>
            </Card>
            <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Мне</Text>
                <Text style={[styles.statValue, styles.statValueEmployee]}>
                    {formatPrice(finalMasterShare)}
                </Text>
                {currentGuaranteed > baseMasterShare && (
                    <Text style={styles.statHint}>
                        (гарантия: {formatPrice(currentGuaranteed)})
                    </Text>
                )}
            </Card>
            <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Клиентов</Text>
                <Text style={styles.statValue}>{itemsCount}</Text>
            </Card>
        </View>
    );
}
