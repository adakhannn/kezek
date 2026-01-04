import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';

type CardProps = {
    children: React.ReactNode;
    style?: ViewStyle;
    hover?: boolean;
};

export default function Card({ children, style, hover }: CardProps) {
    return (
        <View style={[styles.card, hover && styles.hover, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: 16, // rounded-2xl в веб-версии
        padding: 24, // p-6 в веб-версии
        borderWidth: 1,
        borderColor: colors.border.dark,
        ...colors.shadow.lg,
    },
    hover: {
        // Для будущего использования с анимацией
        opacity: 0.95,
    },
});

