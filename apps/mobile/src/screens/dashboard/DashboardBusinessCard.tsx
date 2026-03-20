import { TouchableOpacity, Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getPrimaryBusinessPhone } from './helpers';
import { styles } from './styles';
import type { Business } from './types';

type DashboardBusinessCardProps = {
    business: Business;
    onPress: (business: Business) => void;
};

export function DashboardBusinessCard({ business, onPress }: DashboardBusinessCardProps) {
    const primaryPhone = getPrimaryBusinessPhone(business);

    return (
        <TouchableOpacity onPress={() => onPress(business)}>
            <Card style={styles.businessCard}>
                <Text style={styles.businessName}>{business.name}</Text>
                {business.address ? (
                    <Text style={styles.businessAddress}>{business.address}</Text>
                ) : null}
                {primaryPhone ? <Text style={styles.businessPhone}>{primaryPhone}</Text> : null}
                <View style={styles.businessActions}>
                    <Button
                        title="Управление"
                        onPress={() => onPress(business)}
                        variant="outline"
                        style={styles.actionButton}
                    />
                </View>
            </Card>
        </TouchableOpacity>
    );
}
