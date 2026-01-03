import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './ui/Button';

type ErrorDisplayProps = {
    error: Error;
    onRetry?: () => void;
};

export default function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
    const isEnvError = error.message.includes('environment variables') || 
                      error.message.includes('EXPO_PUBLIC');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Ionicons name="alert-circle" size={64} color="#ef4444" />
            <Text style={styles.title}>Что-то пошло не так</Text>
            <Text style={styles.message}>{error.message}</Text>
            
            {isEnvError && (
                <View style={styles.envHelp}>
                    <Text style={styles.envTitle}>Проверьте настройки:</Text>
                    <Text style={styles.envText}>
                        1. Создайте файл .env.local в папке apps/mobile/
                    </Text>
                    <Text style={styles.envText}>
                        2. Добавьте переменные:
                    </Text>
                    <Text style={styles.envCode}>
                        EXPO_PUBLIC_SUPABASE_URL=...{'\n'}
                        EXPO_PUBLIC_SUPABASE_ANON_KEY=...{'\n'}
                        EXPO_PUBLIC_API_URL=https://kezek.kg
                    </Text>
                    <Text style={styles.envText}>
                        3. Перезапустите Expo (остановите и запустите снова)
                    </Text>
                </View>
            )}
            
            {onRetry && (
                <Button
                    title="Попробовать снова"
                    onPress={onRetry}
                    style={styles.button}
                />
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    envHelp: {
        backgroundColor: '#f9fafb',
        padding: 20,
        borderRadius: 12,
        marginTop: 16,
        marginBottom: 24,
        width: '100%',
    },
    envTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    envText: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
        lineHeight: 20,
    },
    envCode: {
        fontSize: 12,
        fontFamily: 'monospace',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        color: '#111827',
        marginVertical: 8,
    },
    button: {
        marginTop: 16,
    },
});

