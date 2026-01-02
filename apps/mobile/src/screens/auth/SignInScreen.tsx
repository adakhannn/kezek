import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';

export default function SignInScreen() {
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Вход</Text>
            <TextInput
                style={styles.input}
                placeholder="Email или телефон"
                value={email || phone}
                onChangeText={(text) => {
                    if (text.includes('@')) {
                        setEmail(text);
                        setPhone('');
                    } else {
                        setPhone(text);
                        setEmail('');
                    }
                }}
                keyboardType="email-address"
            />
            <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Войти</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#6366f1',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

