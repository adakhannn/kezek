import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import {
  getMobileApiUrl,
  handleDeepLinkAuth,
  tryRestorePendingSession,
} from '../../navigation/useRootNavigationSession';
import { getValidationError } from '../../utils/validation';
import { useAuthAppStateRecovery } from './hooks/useAuthAppStateRecovery';
import {
  type AuthUiState,
  isBusyAuthState,
  transitionAuthUiState,
} from './hooks/authUiState';
import { useGoogleSignInFlow } from './hooks/useGoogleSignInFlow';
import { useTelegramSignInFlow } from './hooks/useTelegramSignInFlow';
import { useWhatsAppSignInFlow } from './hooks/useWhatsAppSignInFlow';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

const MOBILE_REDIRECT = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';

const TELEGRAM_STATUS_LABEL: Record<AuthUiState, string | null> = {
  idle: null,
  loading: 'Запускаем вход через Telegram...',
  pending: 'Ожидаем подтверждение',
  success: 'Подтверждено',
  error: 'Ошибка входа через Telegram',
  cancel: 'Вход через Telegram отменен',
  expired: 'Срок подтверждения истек',
};

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<AuthUiState>('idle');
  const [errors, setErrors] = useState<{ email?: string }>({});
  const apiUrl = getMobileApiUrl();

  const ensureSessionRestored = async (callbackUrl?: string, attempts = 4) => {
    if (callbackUrl) {
      await handleDeepLinkAuth(callbackUrl, apiUrl);
    }

    for (let i = 0; i < attempts; i += 1) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        return true;
      }

      const restored = await tryRestorePendingSession(apiUrl).catch(() => false);
      if (restored) {
        const {
          data: { session: restoredSession },
        } = await supabase.auth.getSession();
        if (restoredSession) {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    return false;
  };

  const { googleLoading, googleState, handleGoogleSignIn, recoverGoogleOnAppActive } =
    useGoogleSignInFlow({
      apiUrl,
      showToast,
    });

  const {
    telegramLoading,
    telegramState,
    telegramNonce,
    startTelegramMobileLogin,
    openTelegramAgain,
    cancelTelegramLogin,
    recoverTelegramOnAppActive,
    telegramDeeplinkEnabled,
  } = useTelegramSignInFlow({
    apiUrl,
    showToast,
    ensureSessionRestored,
  });

  const { whatsAppMobileAuthEnabled, openWhatsAppSignIn } = useWhatsAppSignInFlow();

  useAuthAppStateRecovery({
    onAppActive: useCallback(async () => {
      await recoverGoogleOnAppActive();
      await recoverTelegramOnAppActive();
    }, [recoverGoogleOnAppActive, recoverTelegramOnAppActive]),
  });

  const handleSignIn = async () => {
    const emailError = getValidationError('email', email);
    if (emailError) {
      setErrors({ email: emailError });
      setEmailState((prev) => transitionAuthUiState(prev, 'fail'));
      showToast(emailError, 'error');
      return;
    }

    setErrors({});
    setEmailState((prev) => transitionAuthUiState(prev, 'start'));

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: MOBILE_REDIRECT,
        },
      });

      if (error) {
        throw error;
      }

      setEmailState((prev) => transitionAuthUiState(prev, 'succeed'));
      showToast('Проверьте email и перейдите по ссылке', 'success');
    } catch (error: unknown) {
      setEmailState((prev) => transitionAuthUiState(prev, 'fail'));
      const errorMessage = error instanceof Error ? error.message : 'Не удалось отправить код';
      showToast(errorMessage, 'error');
    } finally {
      setEmailState((prev) => transitionAuthUiState(prev, 'reset'));
    }
  };

  const emailLoading = emailState === 'loading';
  const anyBusyAuth =
    isBusyAuthState(emailState) || isBusyAuthState(googleState) || isBusyAuthState(telegramState);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Вход в Kezek</Text>
      <Text style={styles.subtitle}>Выберите способ входа</Text>

      <Input
        label="Email"
        placeholder="example@mail.com"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (errors.email) {
            setErrors({});
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
        helperText="Введите email, чтобы получить ссылку для входа."
        containerStyle={styles.field}
      />

      <Button
        title="Отправить код"
        onPress={handleSignIn}
        loading={emailLoading}
        disabled={anyBusyAuth}
        accessibilityHint="Отправляет ссылку для входа на указанный email."
        fullWidth
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>или</Text>
        <View style={styles.dividerLine} />
      </View>

      <Button
        title={googleLoading ? 'Вход...' : 'Продолжить с Google'}
        onPress={() => void handleGoogleSignIn()}
        disabled={anyBusyAuth}
        variant="outline"
        style={styles.socialButton}
        accessibilityHint="Открывает авторизацию Google."
        fullWidth
      />

      <Button
        title={telegramLoading ? 'Вход...' : 'Войти через Telegram'}
        onPress={() => void startTelegramMobileLogin()}
        disabled={anyBusyAuth || !telegramDeeplinkEnabled}
        variant="outline"
        style={styles.telegramButton}
        accessibilityHint="Открывает Telegram для подтверждения входа."
        fullWidth
      />
      {telegramState !== 'idle' && TELEGRAM_STATUS_LABEL[telegramState] && (
        <Text accessibilityLiveRegion="polite" style={styles.telegramStatusText}>
          {TELEGRAM_STATUS_LABEL[telegramState]}
        </Text>
      )}
      {telegramNonce && (
        <View style={styles.telegramFlowActions}>
          <Button
            title="Открыть Telegram снова"
            onPress={() => void openTelegramAgain()}
            variant="outline"
            style={styles.telegramActionButton}
            accessibilityHint="Повторно открывает Telegram для подтверждения входа."
            fullWidth
          />
          <Button
            title="Отменить вход"
            onPress={cancelTelegramLogin}
            variant="ghost"
            style={styles.telegramActionButton}
            accessibilityHint="Прерывает текущую попытку входа через Telegram."
            fullWidth
          />
        </View>
      )}

      {whatsAppMobileAuthEnabled && (
        <Button
          title="Войти через WhatsApp"
          onPress={openWhatsAppSignIn}
          disabled={anyBusyAuth}
          variant="secondary"
          style={styles.whatsAppButton}
          textStyle={styles.whatsAppButtonText}
          accessibilityHint="Переход к экрану входа по коду из WhatsApp."
          fullWidth
        />
      )}

      <Button
        title="Регистрация"
        onPress={() => navigation.navigate('SignUp')}
        variant="ghost"
        style={styles.secondaryButton}
        accessibilityHint="Переход на экран регистрации."
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.page,
  },
  content: {
    padding: colors.layout.space5,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.text.secondary,
    marginBottom: colors.layout.space6,
  },
  field: {
    marginBottom: colors.layout.space5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: colors.layout.space5,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  dividerText: {
    marginHorizontal: colors.layout.space4,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  socialButton: {
    marginBottom: colors.layout.space3,
  },
  telegramButton: {
    marginBottom: colors.layout.space3,
    borderColor: colors.brand.telegram,
  },
  telegramStatusText: {
    marginTop: -6,
    marginBottom: colors.layout.space3,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  telegramFlowActions: {
    marginBottom: colors.layout.space3,
    gap: colors.layout.space2,
  },
  telegramActionButton: {
    marginBottom: 0,
  },
  whatsAppButton: {
    marginBottom: colors.layout.space3,
    backgroundColor: colors.brand.whatsapp,
    borderColor: colors.brand.whatsapp,
  },
  whatsAppButtonText: {
    color: colors.text.light,
  },
  secondaryButton: {
    marginTop: colors.layout.space2,
  },
});
