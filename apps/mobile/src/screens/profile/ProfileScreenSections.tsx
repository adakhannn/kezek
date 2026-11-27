import { useRef } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FormField from '../../components/ui/FormField';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
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
    trackColor: { false: colors.fill.track, true: colors.accent.primary },
    thumbColor: colors.text.light,
};

/**
 * The header says "Профиль": the screen opens with the person (initials, name, email), then
 * titled sections on the page, each one surface deep.
 */
export function ProfileScreenSections({ data }: Props) {
    const phoneInputRef = useRef<TextInput>(null);
    const { t } = useLanguage();
    const email = data.user?.email;
    const emailSourceLabels = {
        google: 'Google',
        yandex: t('parity.connections.yandex'),
        primary: t('parity.notifications.emailPrimary'),
    };
    const displayName = data.fullName.trim() || email || '';

    return (
        <>
            <Screen
                tabBar
                keyboard
                refreshing={data.isRefreshing}
                onRefresh={() => void data.retryLoad()}
                testID="profile-screen"
            >
                <View style={local.hero}>
                    <Avatar name={displayName} size={64} />
                    <View style={local.heroText}>
                        <Text style={local.heroName} numberOfLines={1}>{displayName}</Text>
                    </View>
                </View>

                <Section title={t('cabinet.profile.personal')} gap={0}>
                    <Card variant="plain" padding="md" style={local.formCard}>
                        <FormField
                            label={t('cabinet.profile.name.label')}
                            placeholder={t('cabinet.profile.name.placeholder')}
                            value={data.fullName}
                            onChangeText={data.setFullName}
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => phoneInputRef.current?.focus()}
                        />
                        <FormField
                            ref={phoneInputRef}
                            label={t('cabinet.profile.phone.label')}
                            placeholder="+996 XXX XX XX XX"
                            value={data.phone}
                            onChangeText={data.setPhone}
                            keyboardType="phone-pad"
                            returnKeyType="done"
                            onSubmitEditing={data.saveProfile}
                            hint={data.phone.trim() ? t('parity.profile.phoneHint') : t('parity.profile.phoneMissing')}
                        />
                        {email ? (
                            <View style={local.readOnly}>
                                <Text style={styles.label}>{t('cabinet.profile.email.label')}</Text>
                                <Text style={styles.emailValue}>{email}</Text>
                                <Text style={local.readOnlyHint}>{t('cabinet.profile.email.hint')}</Text>
                            </View>
                        ) : null}
                    </Card>
                </Section>

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

                <Section title={t('cabinet.profile.notifications.title')} gap={0}>
                    <Card variant="plain" padding="md" style={local.groupCard}>
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
                                <Text style={[styles.switchLabel, data.whatsappVerified ? null : local.disabledLabel]}>{t('cabinet.profile.notifications.whatsapp')}</Text>
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
                                <Text style={[styles.switchLabel, data.telegramLinked ? null : local.disabledLabel]}>{t('parity.notifications.telegram')}</Text>
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
                </Section>

                <Button
                    title={t('cabinet.profile.save')}
                    onPress={data.saveProfile}
                    loading={data.isSaving}
                    disabled={data.isSaving || data.isSigningOut}
                    size="lg"
                    fullWidth
                />

                <Section title={t('common.language.title')} caption={t('common.language.hint')}>
                    <LanguageSwitcher />
                </Section>

                <Section title={t('cabinet.profile.account.title')} gap={space.md}>
                    <ListGroup inset>
                        <ListRow icon="shield-checkmark-outline" iconTone="neutral" title={t('cabinet.profile.account.privacy')} onPress={data.openPrivacy} />
                        <ListRow icon="document-text-outline" iconTone="neutral" title={t('cabinet.profile.account.terms')} onPress={data.openTerms} />
                        <ListRow
                            icon="log-out-outline"
                            title={data.isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.profile.signOut')}
                            onPress={data.confirmSignOut}
                            disabled={data.isSigningOut || data.isSaving}
                            destructive
                            chevron={false}
                        />
                    </ListGroup>
                    <AccountDeletionCard userId={data.user?.id} />
                </Section>
            </Screen>
            <TelegramLinkSheet
                visible={data.telegramSheetOpen}
                onClose={data.closeTelegramSheet}
                onLinked={data.onTelegramLinked}
                onUnavailable={data.onTelegramUnavailable}
            />
        </>
    );
}

const local = StyleSheet.create({
    hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    heroText: { flex: 1, minWidth: 0, gap: space.xxs },
    heroName: { ...typeScale.title, color: colors.text.primary },
    formCard: { paddingBottom: space.xs },
    groupCard: { paddingVertical: space.sm, borderRadius: radii.lg },
    readOnly: { gap: space.xxs, marginBottom: space.md },
    readOnlyHint: { ...typeScale.caption, color: colors.text.tertiary },
    emails: {
        paddingVertical: space.sm,
        paddingLeft: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border.subtle,
        gap: space.sm,
    },
    dimmed: { opacity: 0.6 },
    // A switch that cannot be turned on yet: its title is dimmed, its hint (the reason) stays readable.
    disabledLabel: { color: colors.text.tertiary },
    emailRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    emailAddress: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
    emailError: { gap: 4 },
    warning: { fontSize: 13, color: colors.status.warning },
});
