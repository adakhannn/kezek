import { useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { LanguageSwitcher, useLanguage } from '../../i18n';
import { AccountDeletionCard } from './AccountDeletionCard';
import { LoginConnectionsCard } from './MessengerConnections';
import { notificationEmailSourceLabel } from './profileConnections';
import { PushNotificationsSwitch } from './PushNotificationsSwitch';
import { styles } from './profileScreenStyles';
import { TelegramLinkSheet } from './TelegramLinkSheet';
import type { ProfileScreenData } from './useProfileScreenData';

type Props = { data: ProfileScreenData };

const switchColors = {
    trackColor: { false: colors.border.strong, true: colors.accent.indigo },
    thumbColor: colors.text.light,
};

export function ProfileScreenSections({ data }: Props) {
    const phoneInputRef = useRef<TextInput>(null);
    const { t } = useLanguage();
    const email = data.user?.email;
    const emailSourceLabels = {
        google: 'Google',
        yandex: t('parity.connections.yandex'),
        primary: t('parity.notifications.emailPrimary'),
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="profile-screen"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            refreshControl={
                <RefreshControl refreshing={data.isRefreshing} onRefresh={() => void data.retryLoad()} tintColor={colors.accent.primary} />
            }
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('cabinet.profile.title')}</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('cabinet.profile.personal')}</Text>

                <Input
                    label={t('cabinet.profile.name.label')}
                    placeholder={t('cabinet.profile.name.placeholder')}
                    value={data.fullName}
                    onChangeText={data.setFullName}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneInputRef.current?.focus()}
                />

                <Input
                    ref={phoneInputRef}
                    label={t('cabinet.profile.phone.label')}
                    placeholder="+996 XXX XX XX XX"
                    value={data.phone}
                    onChangeText={data.setPhone}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={data.saveProfile}
                    helperText={data.phone.trim() ? t('parity.profile.phoneHint') : t('parity.profile.phoneMissing')}
                />

                {email ? (
                    <View style={styles.emailContainer}>
                        <Text style={styles.label}>{t('cabinet.profile.email.label')}</Text>
                        <Text style={styles.emailValue}>{email}</Text>
                        <Text style={styles.emailHint}>{t('cabinet.profile.email.hint')}</Text>
                    </View>
                ) : null}
            </Card>

            <LoginConnectionsCard
                connections={data.connections}
                telegramUsername={data.telegramUsername}
                whatsApp={{
                    whatsappPhone: data.whatsappPhone,
                    fallbackPhone: data.phone.trim() || null,
                    onVerified: data.onWhatsAppVerified,
                }}
                onConnect={data.connect}
                onUnlink={data.unlink}
                connecting={data.connecting}
                unlinking={data.unlinking}
            />

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('cabinet.profile.notifications.title')}</Text>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>{t('cabinet.profile.notifications.email')}</Text>
                        <Text style={styles.switchHint}>{t('cabinet.profile.notifications.emailHint')}</Text>
                    </View>
                    <Switch
                        value={data.notifyEmail}
                        onValueChange={data.setNotifyEmail}
                        accessibilityLabel={t('cabinet.profile.notifications.email')}
                        {...switchColors}
                    />
                </View>

                <View style={[local.emails, data.notifyEmail ? null : local.dimmed]} testID="profile-notification-emails">
                    {data.notificationEmailsState === 'loading' ? (
                        <Text style={styles.switchHint}>{t('parity.notifications.emailLoading')}</Text>
                    ) : data.notificationEmailsState === 'error' ? (
                        <View style={local.emailError}>
                            <Text style={styles.switchHint}>{t('parity.notifications.emailLoadError')}</Text>
                            <Button title={t('cabinet.ui.retry')} onPress={data.retryNotificationEmails} variant="ghost" size="sm" />
                        </View>
                    ) : data.notificationEmails.length === 0 ? (
                        <Text style={local.warning}>{t('parity.notifications.emailEmpty')}</Text>
                    ) : (
                        data.notificationEmails.map((item) => (
                            <View key={item.email} style={local.emailRow}>
                                <View style={styles.switchLabelContainer}>
                                    <Text style={local.emailAddress} numberOfLines={1}>{item.email}</Text>
                                    <Text style={styles.switchHint}>{notificationEmailSourceLabel(item.sources, emailSourceLabels)}</Text>
                                </View>
                                <Switch
                                    value={item.enabled}
                                    onValueChange={(enabled) => data.toggleNotificationEmail(item.email, enabled)}
                                    disabled={!data.notifyEmail || !item.verified}
                                    accessibilityLabel={item.email}
                                    accessibilityState={{ disabled: !data.notifyEmail || !item.verified }}
                                    {...switchColors}
                                />
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>{t('cabinet.profile.notifications.whatsapp')}</Text>
                        <Text style={styles.switchHint}>
                            {data.whatsappVerified
                                ? t('cabinet.profile.notifications.whatsappHint')
                                : t('cabinet.profile.notifications.whatsappNotVerified')}
                        </Text>
                    </View>
                    <Switch
                        value={data.whatsappVerified && data.notifyWhatsApp}
                        onValueChange={data.setNotifyWhatsApp}
                        disabled={!data.whatsappVerified}
                        accessibilityLabel={t('cabinet.profile.notifications.whatsapp')}
                        accessibilityState={{ disabled: !data.whatsappVerified }}
                        testID="profile-whatsapp-switch"
                        {...switchColors}
                    />
                </View>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>{t('parity.notifications.telegram')}</Text>
                        <Text style={styles.switchHint}>
                            {data.telegramLinked
                                ? data.telegramUsername
                                    ? `@${data.telegramUsername.replace(/^@/, '')}`
                                    : t('parity.notifications.telegramConnected')
                                : t('parity.notifications.telegramNotConnected')}
                        </Text>
                    </View>
                    <Switch
                        value={data.telegramLinked && data.notifyTelegram}
                        onValueChange={data.setNotifyTelegram}
                        disabled={!data.telegramLinked}
                        accessibilityLabel={t('parity.notifications.telegram')}
                        accessibilityState={{ disabled: !data.telegramLinked }}
                        testID="profile-telegram-switch"
                        {...switchColors}
                    />
                </View>

                <PushNotificationsSwitch userId={data.user?.id} />
            </Card>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('common.language.title')}</Text>
                <Text style={[styles.switchHint, styles.languageHint]}>{t('common.language.hint')}</Text>
                <LanguageSwitcher />
            </Card>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('cabinet.profile.account.title')}</Text>
                <Button title={t('cabinet.profile.account.privacy')} onPress={data.openPrivacy} variant="outline" fullWidth />
                <Button title={t('cabinet.profile.account.terms')} onPress={data.openTerms} variant="outline" fullWidth style={styles.accountButton} />
            </Card>

            <AccountDeletionCard userId={data.user?.id} />

            <View style={styles.actions}>
                <Button
                    title={t('cabinet.profile.save')}
                    onPress={data.saveProfile}
                    loading={data.isSaving}
                    disabled={data.isSaving || data.isSigningOut}
                />
                <Button
                    title={data.isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.profile.signOut')}
                    onPress={data.confirmSignOut}
                    variant="outline"
                    style={styles.signOutButton}
                    loading={data.isSigningOut}
                    disabled={data.isSigningOut || data.isSaving}
                />
            </View>
        </ScrollView>
        <TelegramLinkSheet
            visible={data.telegramSheetOpen}
            onClose={data.closeTelegramSheet}
            onLinked={data.onTelegramLinked}
            onUnavailable={data.onTelegramUnavailable}
        />
        </KeyboardAvoidingView>
    );
}

const local = StyleSheet.create({
    emails: {
        paddingVertical: colors.layout.space2,
        paddingLeft: colors.layout.space3,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: colors.layout.space2,
    },
    dimmed: { opacity: 0.6 },
    emailRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    emailAddress: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
    emailError: { gap: 4 },
    warning: { fontSize: 13, color: colors.status.warning },
});
