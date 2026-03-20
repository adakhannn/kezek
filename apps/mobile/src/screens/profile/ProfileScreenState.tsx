import { View, Text } from 'react-native';

import { styles } from './styles';

export function ProfileScreenLoading() {
    return (
        <View style={styles.container}>
            <Text style={styles.loading}>Р—Р°РіСЂСѓР·РєР°...</Text>
        </View>
    );
}
