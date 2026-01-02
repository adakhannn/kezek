import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

type LoadingSpinnerProps = {
    message?: string;
    size?: 'small' | 'large';
};

export default function LoadingSpinner({ message, size = 'large' }: LoadingSpinnerProps) {
    return (
        <View style={styles.container}>
            <ActivityIndicator size={size} color="#6366f1" />
            {message && <Text style={styles.message}>{message}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    message: {
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
    },
});

