import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';

type LoadingSpinnerProps = {
    message?: string;
    size?: 'small' | 'large';
};

export default function LoadingSpinner({ message, size = 'large' }: LoadingSpinnerProps) {
    const { t } = useLanguage();
    return (
        <View
            style={styles.container}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={message || t('cabinet.ui.loading')}
            accessibilityLiveRegion="polite"
            accessibilityState={{ busy: true }}
        >
            <View style={styles.indicatorWrap}>
                <ActivityIndicator size={size} color={colors.accent.primary} />
            </View>
            {message ? <Text style={styles.message} importantForAccessibility="no">{message}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: colors.layout.space8,
    },
    indicatorWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        ...colors.shadow.md,
    },
    message: {
        marginTop: colors.layout.space4,
        fontSize: 15,
        color: colors.text.secondary,
        textAlign: 'center',
    },
});
