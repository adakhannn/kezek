import { Children, forwardRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextInput, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import Input from './Input';

type FormFieldProps = Omit<ComponentProps<typeof Input>, 'helperText'> & {
    /** Short help under the field; only when it prevents a mistake. */
    hint?: string;
};

/**
 * A labelled text field of a form: label (with `required`), the value with an optional unit
 * (`prefix` / `suffix`: "сом", "мин", "%"), a hint and an error. `multiline` for notes.
 */
const FormField = forwardRef<TextInput, FormFieldProps>(function FormField({ hint, containerStyle, ...props }, ref) {
    return <Input ref={ref} {...props} helperText={hint} containerStyle={[styles.field, containerStyle]} />;
});

export default FormField;

/** Two (or three) short fields side by side: price from / to, start / end, percent master / salon. */
export function FieldRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
        <View style={[styles.row, style]}>
            {Children.toArray(children).map((child, index) => (
                <View key={index} style={styles.cell}>{child}</View>
            ))}
        </View>
    );
}

/**
 * A titled group of fields inside a form ("Цена", "Где доступна"): a quiet overline title and
 * the fields under it, no box. Use several groups instead of one long flat stack.
 */
export function FieldGroup({ title, caption, children, style }: {
    title?: string;
    caption?: string;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <View style={[styles.group, style]}>
            {title ? <Text style={styles.groupTitle} accessibilityRole="header">{title}</Text> : null}
            {caption ? <Text style={styles.groupCaption}>{caption}</Text> : null}
            {/* The last field's bottom margin would add to the section gap. */}
            <View style={styles.groupBody}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    field: { marginBottom: space.lg },
    row: { flexDirection: 'row', gap: space.md },
    cell: { flex: 1, minWidth: 0 },
    group: { gap: space.sm },
    groupBody: { marginBottom: -space.lg },
    groupTitle: { ...typeScale.overline, color: colors.text.tertiary },
    groupCaption: { ...typeScale.caption, color: colors.text.secondary, marginTop: -space.xs },
});
