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
import type { LoginConnections, SocialProvider } from './profileConnections';
import { styles as profileStyles } from './profileScreenStyles';

const WHATSAPP_PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/;
const OTP_PATTERN = /^\d{6}$/;

type WhatsAppProps = {
    verified: boolean;
    /** The confirmed number (profiles.whatsapp_phone), or the number to propose for confirmation. */
    whatsappPhone: string | null;
    fallbackPhone: string | null;
    onVerified: () => void;
    /** Shown on a confirmed number: unlink WhatsApp as a sign-in and notification channel. */
    onUnlink?: () => void;
    unlinking?: boolean;
};

/**
 * B5: WhatsApp notifications need a number confirmed with a code, as on the website. The same
 * endpoints as the web profile (/api/whatsapp/send-otp, /verify-otp) take the app's Bearer token.
 * A confirmed number is changed by confirming the new one, as on the website.
 */
export function WhatsAppConnection({ verified, whatsappPhone, fallbackPhone, onVerified, onUnlink, unlinking = false }: WhatsAppProps) {
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
    const openForm = () => {
        // The profile phone may arrive after this row first rendered.
        setPhone((current) => (verified ? '' : current || whatsappPhone || fallbackPhone || ''));
        setCodeSent(false);
        setCode('');
        setError(null);
        setOpen(true);
    };

    return (
        <View style={styles.row} testID="profile-whatsapp-connection">
            <View style={styles.rowHeader}>
                <Text style={[profileStyles.switchLabel, styles.rowTitle]}>{t('cabinet.profile.whatsapp.title')}</Text>
                {verified ? <ConnectedBadge /> : null}
            </View>
            <Text style={profileStyles.switchHint}>
                {verified && whatsappPhone
                    ? t('cabinet.profile.whatsapp.verified', { phone: whatsappPhone })
                    : t('cabinet.profile.whatsapp.notVerified')}
            </Text>

            {!open ? (
                <View style={styles.actions}>
                    <Button
                        title={verified ? t('parity.whatsapp.changeNumber') : t('cabinet.profile.whatsapp.verifyNumber')}
                        onPress={openForm}
                        variant="outline"
                        size="sm"
                    />
                    {verified && onUnlink ? (
                        <Button
                            title={t('parity.connections.unlink')}
                            onPress={onUnlink}
                            variant="ghost"
                            size="sm"
                            loading={unlinking}
                            disabled={unlinking}
                            accessibilityLabel={t('parity.connections.unlinkA11y', { provider: 'WhatsApp' })}
                        />
                    ) : null}
                </View>
            ) : (
                <View style={styles.form}>
                    {verified ? <Text style={styles.warning}>{t('parity.whatsapp.changeHint')}</Text> : null}
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
                    {verified ? (
                        <Button title={t('cabinet.ui.cancel')} onPress={() => setOpen(false)} variant="ghost" size="sm" disabled={busy} />
                    ) : null}
                    {error ? (
                        <Text style={styles.error} accessibilityRole="alert">
                            {error}
                        </Text>
                    ) : null}
                </View>
            )}
        </View>
    );
}

function ConnectedBadge() {
    const { t } = useLanguage();
    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('parity.connections.connected')}</Text>
        </View>
    );
}

type ProviderRowProps = {
    label: string;
    linked: boolean;
    detail?: string | null;
    hint?: string;
    onConnect: () => void;
    onUnlink: () => void;
    connecting: boolean;
    unlinking: boolean;
    testID: string;
    connectVariant?: 'primary' | 'outline' | 'authTelegram';
};

function ProviderRow({ label, linked, detail, hint, onConnect, onUnlink, connecting, unlinking, testID, connectVariant = 'outline' }: ProviderRowProps) {
    const { t } = useLanguage();
    return (
        <View style={styles.row} testID={testID}>
            <View style={styles.rowHeader}>
                <Text style={[profileStyles.switchLabel, styles.rowTitle]}>{label}</Text>
                {linked ? <ConnectedBadge /> : null}
            </View>
            {detail ? <Text style={profileStyles.switchHint}>{detail}</Text> : null}
            <View style={styles.actions}>
                {linked ? (
                    <Button
                        title={t('parity.connections.unlink')}
                        onPress={onUnlink}
                        variant="ghost"
                        size="sm"
                        loading={unlinking}
                        disabled={unlinking}
                        accessibilityLabel={t('parity.connections.unlinkA11y', { provider: label })}
                    />
                ) : (
                    <Button
                        title={t('parity.connections.connect')}
                        onPress={onConnect}
                        variant={connectVariant}
                        size="sm"
                        loading={connecting}
                        disabled={connecting}
                        accessibilityLabel={t('parity.connections.connectA11y', { provider: label })}
                    />
                )}
            </View>
            {!linked && hint ? <Text style={styles.caption}>{hint}</Text> : null}
        </View>
    );
}

type Props = {
    connections: LoginConnections;
    telegramUsername: string | null;
    whatsApp: Omit<WhatsAppProps, 'verified' | 'onUnlink' | 'unlinking'>;
    onConnect: (provider: Exclude<SocialProvider, 'whatsapp'>) => void;
    onUnlink: (provider: SocialProvider, label: string) => void;
    connecting: SocialProvider | null;
    unlinking: SocialProvider | null;
};

/** The website's "Способы входа": Google, Yandex, Telegram and WhatsApp, linked or not. */
export function LoginConnectionsCard({ connections, telegramUsername, whatsApp, onConnect, onUnlink, connecting, unlinking }: Props) {
    const { t } = useLanguage();
    const yandex = t('parity.connections.yandex');
    return (
        <Card style={profileStyles.card} testID="profile-login-connections">
            <Text style={[profileStyles.sectionTitle, styles.cardTitle]}>{t('cabinet.profile.connections.title')}</Text>
            <Text style={[profileStyles.switchHint, styles.cardDescription]}>{t('parity.connections.desc')}</Text>
            <ProviderRow
                label="Google"
                linked={connections.google}
                onConnect={() => onConnect('google')}
                onUnlink={() => onUnlink('google', 'Google')}
                connecting={connecting === 'google'}
                unlinking={unlinking === 'google'}
                testID="profile-google-connection"
            />
            <ProviderRow
                label={yandex}
                linked={connections.yandex}
                hint={t('parity.connections.yandexWebHint')}
                onConnect={() => onConnect('yandex')}
                onUnlink={() => onUnlink('yandex', yandex)}
                connecting={connecting === 'yandex'}
                unlinking={unlinking === 'yandex'}
                testID="profile-yandex-connection"
            />
            <ProviderRow
                label="Telegram"
                linked={connections.telegram}
                detail={connections.telegram
                    ? telegramUsername
                        ? t('cabinet.profile.telegram.linked', { username: telegramUsername.replace(/^@/, '') })
                        : t('cabinet.profile.telegram.linkedNoUsername')
                    : t('cabinet.profile.telegram.notLinked')}
                hint={t('parity.telegramLink.startHint')}
                onConnect={() => onConnect('telegram')}
                onUnlink={() => onUnlink('telegram', 'Telegram')}
                connecting={connecting === 'telegram'}
                unlinking={unlinking === 'telegram'}
                testID="profile-telegram-connection"
                connectVariant="authTelegram"
            />
            <WhatsAppConnection
                {...whatsApp}
                verified={connections.whatsapp}
                onUnlink={() => onUnlink('whatsapp', 'WhatsApp')}
                unlinking={unlinking === 'whatsapp'}
            />
            <Text style={styles.caption}>{t('parity.connections.hint')}</Text>
        </Card>
    );
}

const styles = StyleSheet.create({
    cardTitle: { marginBottom: colors.layout.space2 },
    cardDescription: { marginBottom: colors.layout.space2 },
    row: {
        paddingVertical: 10,
        gap: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    rowTitle: { flex: 1, marginBottom: 0 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    form: { gap: 8, marginTop: 4 },
    error: { fontSize: 14, color: colors.status.danger },
    warning: { fontSize: 13, color: colors.status.warning },
    caption: { fontSize: 12, color: colors.text.tertiary, marginTop: 6 },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: colors.feedback.successSurface,
    },
    badgeText: { fontSize: 12, fontWeight: '600', color: colors.status.success },
});
