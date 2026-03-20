import { Text, View } from 'react-native';

import { styles } from './styles';

type Props = {
    visible: boolean;
};

export function ShiftQuickOfflineIndicator({ visible }: Props) {
    if (!visible) {
        return null;
    }

    return (
        <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>Синхронизация офлайн-данных...</Text>
        </View>
    );
}
