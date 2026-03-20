import { View } from 'react-native';

import { DashboardBusinessCard } from './DashboardBusinessCard';
import { styles } from './styles';
import type { Business } from './types';

type DashboardBusinessListSectionProps = {
    businesses: Business[];
    onBusinessPress: (business: Business) => void;
};

export function DashboardBusinessListSection({
    businesses,
    onBusinessPress,
}: DashboardBusinessListSectionProps) {
    return (
        <View style={styles.businessList}>
            {businesses.map((business) => (
                <DashboardBusinessCard
                    key={business.id}
                    business={business}
                    onPress={onBusinessPress}
                />
            ))}
        </View>
    );
}
