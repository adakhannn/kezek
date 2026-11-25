import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Switch, Text, View } from 'react-native';

import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { disablePushNotifications, enablePushNotifications, readPushEnabled } from '../../lib/pushNotifications';
import { logWarn } from '../../lib/log';
import { styles } from './profileScreenStyles';

/**
 * "Push-уведомления" in Profile: the only place the app asks for the notification permission
 * (lib/pushNotifications.ts explains why). On registers this install's token, off removes it.
 */
export function PushNotificationsSwitch({ userId }: { userId: string | undefined }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [enabled, setEnabled] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;
        if (!userId) return;
        void readPushEnabled(userId).then(value => { if (active) setEnabled(value); });
        return () => { active = false; };
    }, [userId]);

    const onChange = useCallback(async (next: boolean) => {
        if (!userId || busy) return;
        setBusy(true);
        try {
            if (!next) {
                await disablePushNotifications(userId);
                setEnabled(false);
                return;
            }
            const result = await enablePushNotifications(userId);
            setEnabled(result === 'enabled');
            if (result === 'denied') {
                Alert.alert(t('push.denied.title'), t('push.denied.message'), [
                    { text: t('cabinet.ui.cancel'), style: 'cancel' },
                    { text: t('push.denied.openSettings'), onPress: () => { void Linking.openSettings(); } },
                ]);
            } else if (result === 'unsupported') {
                showToast(t('push.unsupported'), 'info');
            }
        } catch (error) {
            logWarn('PushNotificationsSwitch', 'Push setting change failed', { message: error instanceof Error ? error.message : String(error) });
            showToast(t('push.error'), 'error');
        } finally {
            setBusy(false);
        }
    }, [busy, showToast, t, userId]);

    return (
        <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>{t('push.switch.label')}</Text>
                <Text style={styles.switchHint}>{t('push.switch.hint')}</Text>
            </View>
            <Switch
                testID="profile-push-switch"
                accessibilityLabel={t('push.switch.label')}
                value={enabled}
                disabled={!userId || busy}
                onValueChange={value => { void onChange(value); }}
                trackColor={{ false: colors.border.strong, true: colors.accent.indigo }}
                thumbColor={colors.text.light}
            />
        </View>
    );
}
