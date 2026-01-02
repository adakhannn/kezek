import { View, Text, StyleSheet } from 'react-native';

export default function CabinetScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Личный кабинет</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
});

