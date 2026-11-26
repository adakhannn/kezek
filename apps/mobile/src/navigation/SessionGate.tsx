import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { colors } from '../constants/colors';
import { useLanguage, type MobileI18nKey } from '../i18n';
import { useNavigationSession } from './NavigationSessionContext';
import type { RootStackParamList } from './types';

/** Which account screen asks for the sign-in: the text says what the account opens. */
export type SessionGateReason = 'cabinet' | 'profile' | 'booking' | 'workspace';

const MESSAGE_KEYS: Record<SessionGateReason, MobileI18nKey> = {
    cabinet: 'discovery.signIn.message.cabinet',
    profile: 'discovery.signIn.message.profile',
    booking: 'discovery.signIn.message.booking',
    workspace: 'discovery.signIn.message.workspace',
};

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * The sign-in entry of an account screen opened without a session (a tab, or a deep link such as
 * kezek://booking/<id>). The screen's route stays in the stack under the sign-in screen, so after
 * the sign-in the user is back on it and sees its content.
 */
export function SignInPromptScreen({ reason }: { reason: SessionGateReason }) {
    const navigation = useNavigation<RootNavigation>();
    const { t } = useLanguage();

    return (
        <View style={styles.container} testID="sign-in-prompt">
            <EmptyState
                icon="person-circle-outline"
                title={t('discovery.signIn.title')}
                message={t(MESSAGE_KEYS[reason])}
                action={
                    <Button
                        title={t('discovery.signIn.button')}
                        onPress={() => navigation.navigate('Auth', { screen: 'SignIn' })}
                        fullWidth
                        accessibilityHint={t('discovery.signIn.buttonHint')}
                    />
                }
            />
        </View>
    );
}

/** `Screen` with a session, the sign-in entry without one. */
export function withSessionGate<P extends object>(Screen: ComponentType<P>, reason: SessionGateReason) {
    function SessionGate(props: P) {
        const { hasSession } = useNavigationSession();

        if (!hasSession) {
            return <SignInPromptScreen reason={reason} />;
        }

        return <Screen {...props} />;
    }

    SessionGate.displayName = `SessionGate(${Screen.displayName || Screen.name || 'Screen'})`;
    return SessionGate;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: colors.surface.page,
    },
});
