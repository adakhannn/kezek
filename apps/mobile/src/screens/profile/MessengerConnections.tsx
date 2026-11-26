import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { styles as profileStyles } from './profileScreenStyles';

const WHATSAPP_PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/;
const OTP_PATTERN = /^\d{6}$/;

type WhatsAppProps = {
    verified: boolean;
    /** The confirmed number (profiles.whatsapp_phone), or the number to propose for confirmation. */
    whatsappPhone: string | null;
    fallbackPhone: string | null;
    onVerified: () => void;
};

/**
 * B5: WhatsApp notifications need a number confirmed with a code, as on the website. The same
 * endpoints as the web profile (/api/whatsapp/send-otp, /verify-otp) take the app's Bearer token.
 */
export function WhatsAppConnection({ verified, whatsappPhone, fallbackPhone, onVerified }: WhatsAppProps) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [phone, setPhone] = useState(whatsappPhone || fallbackPhone || '');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendCode = useMutation({
        mutationFn: async () => {
            const trimmed = phone.trim();
            if (!WHATSAPP_PHONE_PATTERN.test(trimmed)) throw new Error(t('cabinet.profile.whatsapp.phoneInvalid'));
            await apiRequest('/whatsapp/send-otp', { method: 'POST', body: JSON.stringify({ phone: trimmed }) });
        },
        onMutate: () => setError(null),
        onSuccess: () => {
            setCodeSent(true);
            showToast(t('cabinet.profile.whatsapp.codeSent'), 'success');
        },
        onError: (mutationError: unknown) => setError(getErrorMessage(mutationError, t('cabinet.profile.whatsapp.sendError'), t)),
    });

    const verifyCode = useMutation({
        mutationFn: async () => {
            if (!OTP_PATTERN.test(code.trim())) throw new Error(t('cabinet.profile.whatsapp.codeLength'));
            await apiRequest('/whatsapp/verify-otp', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
        },
        onMutate: () => setError(null),
        onSuccess: () => {
            showToast(t('cabinet.profile.whatsapp.verifiedSuccess'), 'success');
            setOpen(false);
            setCodeSent(false);
            setCode('');
            onVerified();
        },
        onError: (mutationError: unknown) => setError(getErrorMessage(mutationError, t('cabinet.profile.whatsapp.verifyError'), t)),
    });

    const busy = sendCode.isPending || verifyCode.isPending;

    return (
        <View style={styles.row} testID="profile-whatsapp-connection">
            <Text style={profileStyles.switchLabel}>{t('cabinet.profile.whatsapp.title')}</Text>
            <Text style={profileStyles.switchHint}>
                {verified && whatsappPhone
                    ? t('cabinet.profile.whatsapp.verified', { phone: whatsappPhone })
                    : t('cabinet.profile.whatsapp.notVerified')}
            </Text>

            {!verified && !open ? (
                <Button
                    title={t('cabinet.profile.whatsapp.verifyNumber')}
                    onPress={() => {
                        // The profile phone may arrive after this row first rendered.
                        setPhone((current) => current || whatsappPhone || fallbackPhone || '');
                        setOpen(true);
                    }}
                    variant="outline"
                    size="sm"
                    style={styles.action}
                />
            ) : null}

            {!verified && open ? (
                <View style={styles.form}>
                    <Input
                        label={t('cabinet.profile.whatsapp.phoneLabel')}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholder="+996 XXX XX XX XX"
                        editable={!busy}
                        testID="whatsapp-phone-input"
                    />
                    <Button
                        title={t(codeSent ? 'cabinet.profile.whatsapp.resendCode' : 'cabinet.profile.whatsapp.sendCode')}
                        onPress={() => sendCode.mutate()}
                        loading={sendCode.isPending}
                        disabled={busy}
                        variant={codeSent ? 'outline' : 'primary'}
                        size="sm"
                    />
                    {codeSent ? (
                        <>
                            <Input
                                label={t('cabinet.profile.whatsapp.codeLabel')}
                                value={code}
                                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                                keyboardType="number-pad"
                                placeholder="000000"
                                maxLength={6}
                                editable={!busy}
                                testID="whatsapp-code-input"
                                textContentType="oneTimeCode"
                            />
                            <Button
                                title={t('cabinet.profile.whatsapp.confirm')}
                                onPress={() => verifyCode.mutate()}
                                loading={verifyCode.isPending}
                                disabled={busy}
                                size="sm"
                            />
                        </>
                    ) : null}
                    {error ? (
                        <Text style={styles.error} accessibilityRole="alert">
                            {error}
                        </Text>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

type TelegramProps = {
    linked: boolean;
    username: string | null;
    onLink: () => void;
};

/**
 * C12: the Telegram link state; linking itself runs on the website (Telegram login widget or bot
 * link), opened signed in through the one-time web handoff.
 */
export function TelegramConnection({ linked, username, onLink }: TelegramProps) {
    const { t } = useLanguage();
    return (
        <View style={styles.row} testID="profile-telegram-connection">
            <Text style={profileStyles.switchLabel}>{t('cabinet.profile.telegram.title')}</Text>
            <Text style={profileStyles.switchHint}>
                {linked
                    ? username
                        ? t('cabinet.profile.telegram.linked', { username })
                        : t('cabinet.profile.telegram.linkedNoUsername')
                    : t('cabinet.profile.telegram.notLinked')}
            </Text>
            {!linked ? (
                <>
                    <Button title={t('cabinet.profile.telegram.link')} onPress={onLink} variant="outline" size="sm" style={styles.action} />
                    <Text style={styles.caption}>{t('cabinet.profile.telegram.linkHint')}</Text>
                </>
            ) : null}
        </View>
    );
}

type Props = WhatsAppProps & { telegramLinked: boolean; telegramUsername: string | null; onLinkTelegram: () => void };

export function MessengerConnectionsCard({ telegramLinked, telegramUsername, onLinkTelegram, ...whatsApp }: Props) {
    const { t } = useLanguage();
    return (
        <Card style={profileStyles.card}>
            <Text style={profileStyles.sectionTitle}>{t('cabinet.profile.connections.title')}</Text>
            <WhatsAppConnection {...whatsApp} />
            <TelegramConnection linked={telegramLinked} username={telegramUsername} onLink={onLinkTelegram} />
        </Card>
    );
}

const styles = StyleSheet.create({
    row: { paddingVertical: 8, gap: 4 },
    action: { alignSelf: 'flex-start', marginTop: 4 },
    form: { gap: 8, marginTop: 4 },
    error: { fontSize: 14, color: colors.status.danger },
    caption: { fontSize: 12, color: colors.text.tertiary },
});
