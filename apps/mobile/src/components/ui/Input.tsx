import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';
import { colors } from '../../constants/colors';

type InputProps = TextInputProps & {
    label?: string;
    error?: string;
    helperText?: string;
};

export default function Input({ label, error, helperText, style, ...props }: InputProps) {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    error && styles.inputError,
                    !error && props.editable === false && styles.inputReadOnly,
                    style,
                ]}
                placeholderTextColor={colors.text.tertiary}
                {...props}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: colors.background.secondary,
        color: colors.text.primary,
    },
    inputError: {
        borderColor: colors.status.cancelled,
    },
    inputReadOnly: {
        backgroundColor: colors.background.secondary,
    },
    error: {
        fontSize: 12,
        color: colors.status.cancelled,
        marginTop: 6,
    },
    helperText: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: 6,
    },
});

