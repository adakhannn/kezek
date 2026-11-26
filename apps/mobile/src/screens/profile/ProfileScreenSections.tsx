import { useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
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
import { MessengerConnectionsCard } from './MessengerConnections';
import { PushNotificationsSwitch } from './PushNotificationsSwitch';
import { styles } from './profileScreenStyles';

type Props = {
    userId?: string;
    email: string | undefined;
    fullName: string;
    phone: string;
    notifyEmail: boolean;
    notifyWhatsApp: boolean;
    onFullNameChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
    onNotifyEmailChange: (value: boolean) => void;
    onNotifyWhatsAppChange: (value: boolean) => void;
    onSave: () => void;
    onSignOut: () => void;
    onOpenPrivacy: () => void;
    onOpenTerms: () => void;
    onDeleteAccount: () => void;
    isSaving: boolean;
    isSigningOut: boolean;
    /** B5: WhatsApp notifications only for a confirmed number. Absent: treated as confirmed (old callers). */
    whatsappVerified?: boolean;
    whatsappPhone?: string | null;
    onWhatsAppVerified?: () => void;
    telegramLinked?: boolean;
    telegramUsername?: string | null;
    onLinkTelegram?: () => void;
    isRefreshing?: boolean;
    onRefresh?: () => void;
};

export function ProfileScreenSections({
    userId,
    email,
    fullName,
    phone,
    notifyEmail,
    notifyWhatsApp,
    onOpenPrivacy,
    onOpenTerms,
    onDeleteAccount,
    onFullNameChange,
    onPhoneChange,
    onNotifyEmailChange,
    onNotifyWhatsAppChange,
    onSave,
    onSignOut,
    isSaving,
    isSigningOut,
    whatsappVerified = true,
    whatsappPhone = null,
    onWhatsAppVerified,
    telegramLinked = false,
    telegramUsername = null,
    onLinkTelegram,
    isRefreshing = false,
    onRefresh,
}: Props) {
    const phoneInputRef = useRef<TextInput>(null);
    const { t } = useLanguage();

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
                onRefresh ? (
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
                ) : undefined
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
                    value={fullName}
                    onChangeText={onFullNameChange}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneInputRef.current?.focus()}
                />

                <Input
                    ref={phoneInputRef}
                    label={t('cabinet.profile.phone.label')}
                    placeholder="+996 XXX XX XX XX"
                    value={phone}
                    onChangeText={onPhoneChange}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={onSave}
                />

                {email ? (
                    <View style={styles.emailContainer}>
                        <Text style={styles.label}>{t('cabinet.profile.email.label')}</Text>
                        <Text style={styles.emailValue}>{email}</Text>
                        <Text style={styles.emailHint}>{t('cabinet.profile.email.hint')}</Text>
                    </View>
                ) : null}
            </Card>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('cabinet.profile.notifications.title')}</Text>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>{t('cabinet.profile.notifications.email')}</Text>
                        <Text style={styles.switchHint}>{t('cabinet.profile.notifications.emailHint')}</Text>
                    </View>
                    <Switch
                        value={notifyEmail}
                        onValueChange={onNotifyEmailChange}
                        trackColor={{ false: colors.border.strong, true: colors.accent.indigo }}
                        thumbColor={colors.text.light}
                    />
                </View>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>{t('cabinet.profile.notifications.whatsapp')}</Text>
                        <Text style={styles.switchHint}>
                            {whatsappVerified
                                ? t('cabinet.profile.notifications.whatsappHint')
                                : t('cabinet.profile.notifications.whatsappNotVerified')}
                        </Text>
                    </View>
                    <Switch
                        value={whatsappVerified && notifyWhatsApp}
                        onValueChange={onNotifyWhatsAppChange}
                        disabled={!whatsappVerified}
                        accessibilityState={{ disabled: !whatsappVerified }}
                        testID="profile-whatsapp-switch"
                        trackColor={{ false: colors.border.strong, true: colors.accent.indigo }}
                        thumbColor={colors.text.light}
                    />
                </View>

                <PushNotificationsSwitch userId={userId} />
            </Card>

            {onWhatsAppVerified && onLinkTelegram ? (
                <MessengerConnectionsCard
                    verified={whatsappVerified}
                    whatsappPhone={whatsappPhone}
                    fallbackPhone={phone.trim() || null}
                    onVerified={onWhatsAppVerified}
                    telegramLinked={telegramLinked}
                    telegramUsername={telegramUsername}
                    onLinkTelegram={onLinkTelegram}
                />
            ) : null}

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('common.language.title')}</Text>
                <Text style={[styles.switchHint, styles.languageHint]}>{t('common.language.hint')}</Text>
                <LanguageSwitcher />
            </Card>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>{t('cabinet.profile.account.title')}</Text>
                <Button title={t('cabinet.profile.account.privacy')} onPress={onOpenPrivacy} variant="outline" fullWidth />
                <Button title={t('cabinet.profile.account.terms')} onPress={onOpenTerms} variant="outline" fullWidth style={styles.accountButton} />
                <Text style={[styles.switchHint, styles.accountHint]}>{t('cabinet.profile.account.deleteHint')}</Text>
                <Button title={t('cabinet.profile.account.delete')} onPress={onDeleteAccount} variant="outline" fullWidth disabled={isSigningOut} />
            </Card>

            <View style={styles.actions}>
                <Button
                    title={t('cabinet.profile.save')}
                    onPress={onSave}
                    loading={isSaving}
                    disabled={isSaving || isSigningOut}
                />
                <Button
                    title={isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.profile.signOut')}
                    onPress={onSignOut}
                    variant="outline"
                    style={styles.signOutButton}
                    loading={isSigningOut}
                    disabled={isSigningOut || isSaving}
                />
            </View>
        </ScrollView>
        </KeyboardAvoidingView>
    );
}
