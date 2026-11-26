import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import type { GuestContacts } from './bookingSelection';

type BookingGuestFormProps = {
    contacts: GuestContacts;
    onChange: (next: Partial<GuestContacts>) => void;
    error: string | null;
    onSubmit: () => void;
    onSignIn: () => void;
    submitting: boolean;
    disabled: boolean;
};

/**
 * Booking without an account (C1, web AuthChoiceModal + GuestBookingModal): name and phone are
 * required, email is optional; signing in instead keeps the chosen booking.
 */
export default function BookingGuestForm({
    contacts,
    onChange,
    error,
    onSubmit,
    onSignIn,
    submitting,
    disabled,
}: BookingGuestFormProps) {
    const { t } = useLanguage();
    const phoneRef = useRef<TextInput>(null);
    const emailRef = useRef<TextInput>(null);

    return (
        <Card style={styles.card}>
            <Text style={styles.title}>{t('booking.guest.title')}</Text>
            <Text style={styles.info}>{t('booking.guest.info')}</Text>

            <Input
                label={`${t('booking.guest.name')} *`}
                value={contacts.name}
                onChangeText={(name) => onChange({ name })}
                placeholder={t('booking.guest.namePlaceholder')}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                editable={!submitting}
            />
            <Input
                ref={phoneRef}
                label={`${t('booking.guest.phone')} *`}
                value={contacts.phone}
                onChangeText={(phone) => onChange({ phone })}
                placeholder={t('booking.guest.phonePlaceholder')}
                helperText={t('booking.guest.phoneHelper')}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!submitting}
            />
            <Input
                ref={emailRef}
                label={t('booking.guest.emailOptional')}
                value={contacts.email}
                onChangeText={(email) => onChange({ email })}
                placeholder={t('booking.guest.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                editable={!submitting}
            />

            {error ? (
                <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    {error}
                </Text>
            ) : null}

            <Button
                title={t('booking.guest.book')}
                onPress={onSubmit}
                loading={submitting}
                disabled={disabled}
                variant="primary"
                fullWidth
            />
            <View style={styles.signIn}>
                <Text style={styles.signInHint}>{t('booking.guest.signInHint')}</Text>
                <Button
                    title={t('booking.guest.signIn')}
                    onPress={onSignIn}
                    disabled={submitting}
                    variant="outline"
                    fullWidth
                />
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 6,
    },
    info: {
        fontSize: 13,
        lineHeight: 18,
        color: colors.text.secondary,
        marginBottom: 16,
    },
    error: {
        fontSize: 13,
        color: colors.status.danger,
        marginBottom: 12,
    },
    signIn: {
        marginTop: 16,
        gap: 8,
    },
    signInHint: {
        fontSize: 13,
        color: colors.text.secondary,
    },
});
