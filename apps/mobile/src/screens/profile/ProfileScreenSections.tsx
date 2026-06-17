import { useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
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
import { styles } from './profileScreenStyles';

type Props = {
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
    isSaving: boolean;
    isSigningOut: boolean;
};

export function ProfileScreenSections({
    email,
    fullName,
    phone,
    notifyEmail,
    notifyWhatsApp,
    onFullNameChange,
    onPhoneChange,
    onNotifyEmailChange,
    onNotifyWhatsAppChange,
    onSave,
    onSignOut,
    isSaving,
    isSigningOut,
}: Props) {
    const phoneInputRef = useRef<TextInput>(null);

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
        >
            <View style={styles.header}>
                <Text style={styles.title}>Профиль</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Личная информация</Text>

                <Input
                    label="Имя"
                    placeholder="Введите ваше имя"
                    value={fullName}
                    onChangeText={onFullNameChange}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneInputRef.current?.focus()}
                />

                <Input
                    ref={phoneInputRef}
                    label="Телефон"
                    placeholder="+996 XXX XX XX XX"
                    value={phone}
                    onChangeText={onPhoneChange}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={onSave}
                />

                {email ? (
                    <View style={styles.emailContainer}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.emailValue}>{email}</Text>
                        <Text style={styles.emailHint}>Email нельзя изменить</Text>
                    </View>
                ) : null}
            </Card>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Уведомления</Text>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>Email уведомления</Text>
                        <Text style={styles.switchHint}>Получать уведомления на email</Text>
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
                        <Text style={styles.switchLabel}>WhatsApp уведомления</Text>
                        <Text style={styles.switchHint}>Получать уведомления в WhatsApp</Text>
                    </View>
                    <Switch
                        value={notifyWhatsApp}
                        onValueChange={onNotifyWhatsAppChange}
                        trackColor={{ false: colors.border.strong, true: colors.accent.indigo }}
                        thumbColor={colors.text.light}
                    />
                </View>
            </Card>

            <View style={styles.actions}>
                <Button
                    title="Сохранить"
                    onPress={onSave}
                    loading={isSaving}
                    disabled={isSaving || isSigningOut}
                />
                <Button
                    title={isSigningOut ? 'Выходим...' : 'Выйти'}
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
