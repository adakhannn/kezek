import type { ReactNode } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
} from 'react-native';

import { colors } from '../../constants/colors';

type InputProps = TextInputProps & {
    label?: string;
    error?: string;
    helperText?: string;
    size?: 'sm' | 'md' | 'lg';
    containerStyle?: StyleProp<ViewStyle>;
    inputContainerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<TextStyle>;
    leadingIcon?: ReactNode;
    trailingIcon?: ReactNode;
};

export default function Input({
    label,
    error,
    helperText,
    size = 'md',
    containerStyle,
    inputContainerStyle,
    leadingIcon,
    trailingIcon,
    style,
    ...props
}: InputProps) {
    const sizeStyle = size === 'sm' ? styles.inputSm : size === 'lg' ? styles.inputLg : styles.inputMd;
    const editable = props.editable !== false;

    return (
        <View style={[styles.container, containerStyle]}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <View
                style={[
                    styles.inputContainer,
                    sizeStyle,
                    error && styles.inputContainerError,
                    !editable && styles.inputContainerReadOnly,
                    inputContainerStyle,
                ]}
            >
                {leadingIcon ? <View style={styles.iconWrap}>{leadingIcon}</View> : null}
                <TextInput
                    style={[styles.input, style]}
                    placeholderTextColor={colors.text.tertiary}
                    selectionColor={colors.interactive.focusRing}
                    accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
                    accessibilityHint={props.accessibilityHint ?? helperText}
                    accessibilityState={{ disabled: !editable }}
                    {...props}
                />
                {trailingIcon ? <View style={styles.iconWrap}>{trailingIcon}</View> : null}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {helperText && !error ? <Text style={styles.helperText}>{helperText}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: colors.layout.space4,
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.secondary,
        marginBottom: 6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: colors.layout.radiusMd,
        backgroundColor: colors.surface.card,
        paddingHorizontal: colors.layout.space4,
        gap: colors.layout.space2,
    },
    inputSm: {
        minHeight: 42,
        paddingVertical: 8,
    },
    inputMd: {
        minHeight: 48,
        paddingVertical: 10,
    },
    inputLg: {
        minHeight: 54,
        paddingVertical: 12,
    },
    inputContainerError: {
        borderColor: colors.status.danger,
    },
    inputContainerReadOnly: {
        backgroundColor: colors.surface.elevated,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
        paddingVertical: 0,
    },
    error: {
        fontSize: 12,
        color: colors.status.danger,
        marginTop: 6,
    },
    helperText: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: 6,
    },
});
