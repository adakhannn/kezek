import { View } from 'react-native';

import Button from '../../components/ui/Button';
import { styles } from './styles';

export function BookingDetailsActions({
    canCancel,
    isCancelling,
    hasPrimaryPhone,
    onRepeat,
    onCancel,
    onCall,
    onWhatsApp,
}: {
    canCancel: boolean;
    isCancelling: boolean;
    hasPrimaryPhone: boolean;
    onRepeat: () => void;
    onCancel: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
}) {
    return (
        <View style={styles.actions}>
            <Button title="Повторить запись" onPress={onRepeat} style={styles.primaryAction} />

            {canCancel && (
                <Button
                    title="Отменить бронирование"
                    onPress={onCancel}
                    variant="outline"
                    style={styles.cancelButton}
                    loading={isCancelling}
                />
            )}

            {hasPrimaryPhone && (
                <View style={styles.contactRow}>
                    <Button title="Позвонить в салон" onPress={onCall} variant="outline" style={styles.contactButton} />
                    <Button
                        title="Написать в WhatsApp"
                        onPress={onWhatsApp}
                        variant="outline"
                        style={styles.contactButton}
                    />
                </View>
            )}
        </View>
    );
}
