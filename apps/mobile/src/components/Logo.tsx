import { Image, View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';

/**
 * Компонент логотипа Kezek для мобильного приложения
 * Поддерживает как изображение, так и текстовый вариант
 */
export default function Logo({ style }: { style?: any }) {
    const [imageError, setImageError] = useState(false);

    const handleImageError = (error: any) => {
        console.log('[Logo] Image load error:', error);
        setImageError(true);
    };

    return (
        <View style={[styles.container, style]}>
            {!imageError ? (
                <Image
                    source={require('../../assets/logo.png')}
                    style={styles.image}
                    resizeMode="contain"
                    onError={handleImageError}
                    onLoad={() => console.log('[Logo] Image loaded successfully')}
                />
            ) : (
                // Текстовый вариант (показывается если изображение не загрузилось)
                <View style={styles.textContainer}>
                    <LinearGradient
                        colors={[colors.primary.from, colors.primary.to]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradient}
                    >
                        <Text style={styles.text}>Kezek</Text>
                    </LinearGradient>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        minWidth: 100,
    },
    image: {
        height: 48,
        width: 200,
        maxWidth: 200,
        backgroundColor: 'transparent',
    },
    textContainer: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    gradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
});

