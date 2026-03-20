import { View, Text } from 'react-native';

import { getDashboardSubtitleLabel } from './helpers';
import { styles } from './styles';

type DashboardHeaderProps = {
    businessCount: number;
};

export function DashboardHeader({ businessCount }: DashboardHeaderProps) {
    return (
        <View style={styles.header}>
            <Text style={styles.title}>Кабинет бизнеса</Text>
            <Text style={styles.subtitle}>{getDashboardSubtitleLabel(businessCount)}</Text>
        </View>
    );
}
