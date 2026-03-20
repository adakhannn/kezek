import { Text, View } from 'react-native';

import { styles } from './styles';

export function CabinetScreenLoading() {
    return (
        <View style={styles.container} testID="cabinet-screen">
            <Text style={styles.loading}>Загрузка...</Text>
        </View>
    );
}
