import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { useLanguage } from '../i18n';
import { telUrl, whatsAppUrl } from '../lib/contactLinks';
import { formatPhone } from '../utils/format';
import Button from './ui/Button';

type Props = {
    phone: string | null | undefined;
};

/**
 * The client's number with Call and WhatsApp buttons (S1, O1). If the phone cannot open the app,
 * the number is shown in an alert so it can still be dialled by hand.
 */
export default function ClientContactActions({ phone }: Props) {
    const { t } = useLanguage();
    const call = telUrl(phone);
    const whatsapp = whatsAppUrl(phone);
    if (!phone || (!call && !whatsapp)) return null;
    const shown = formatPhone(phone) || phone;

    const open = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert(t('staff.contact.openError', { phone: shown }));
        }
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.phone} selectable>{shown}</Text>
            <View style={styles.actions}>
                {call ? (
                    <Button
                        title={t('staff.contact.call')}
                        onPress={() => void open(call)}
                        variant="outline"
                        size="sm"
                        leadingIcon={<Ionicons name="call-outline" size={14} color={colors.accent.primary} />}
                        accessibilityLabel={t('staff.contact.callA11y', { phone: shown })}
                        style={styles.action}
                    />
                ) : null}
                {whatsapp ? (
                    <Button
                        title={t('staff.contact.whatsapp')}
                        onPress={() => void open(whatsapp)}
                        variant="outline"
                        size="sm"
                        leadingIcon={<Ionicons name="logo-whatsapp" size={14} color={colors.status.success} />}
                        accessibilityLabel={t('staff.contact.whatsappA11y', { phone: shown })}
                        style={styles.action}
                    />
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: colors.layout.space2,
        gap: colors.layout.space2,
    },
    phone: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: colors.layout.space2,
    },
    action: {
        flexGrow: 1,
    },
});
