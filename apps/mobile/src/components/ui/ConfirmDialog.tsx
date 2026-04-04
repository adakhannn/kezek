import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/colors';
import Button from './Button';
import MotionPressable from './MotionPressable';

type ConfirmDialogProps = {
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDialog({
    visible,
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <MotionPressable style={styles.backdrop} onPress={onCancel}>
                    <View />
                </MotionPressable>
                <View style={styles.dialog}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                    <View style={styles.actions}>
                        <Button
                            title={cancelLabel}
                            onPress={onCancel}
                            variant="secondary"
                            style={styles.actionButton}
                            fullWidth
                        />
                        <Button
                            title={confirmLabel}
                            onPress={onConfirm}
                            variant={variant === 'danger' ? 'danger' : 'primary'}
                            style={styles.actionButton}
                            fullWidth
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: colors.layout.space5,
        backgroundColor: colors.surface.overlay,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    dialog: {
        borderRadius: colors.layout.radiusLg,
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        padding: colors.layout.space5,
        ...colors.shadow.lg,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
    },
    message: {
        marginTop: colors.layout.space3,
        fontSize: 14,
        lineHeight: 20,
        color: colors.text.secondary,
    },
    actions: {
        flexDirection: 'row',
        gap: colors.layout.space3,
        marginTop: colors.layout.space5,
    },
    actionButton: {
        flex: 1,
    },
});
