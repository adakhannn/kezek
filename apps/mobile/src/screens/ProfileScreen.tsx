import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLanguage } from '../i18n';
import { ProfileScreenSections } from './profile/ProfileScreenSections';
import { useProfileScreenData } from './profile/useProfileScreenData';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const {
    user,
    isLoading,
    loadError,
    retryLoad,
    fullName,
    setFullName,
    phone,
    setPhone,
    notifyEmail,
    setNotifyEmail,
    notifyWhatsApp,
    setNotifyWhatsApp,
    whatsappVerified,
    whatsappPhone,
    onWhatsAppVerified,
    telegramLinked,
    telegramUsername,
    linkTelegram,
    isRefreshing,
    saveProfile,
    confirmSignOut,
    openPrivacy,
    openTerms,
    deleteAccount,
    isSaving,
    isSigningOut,
  } = useProfileScreenData();

  if (isLoading) {
    return <LoadingSpinner message={t('cabinet.profile.loading')} />;
  }

  if (loadError) {
    return (
      <EmptyState
        icon="alert-circle"
        title={t('cabinet.profile.loadError.title')}
        message={t('cabinet.profile.loadError.message')}
        action={<Button title={t('cabinet.ui.retry')} onPress={() => void retryLoad()} variant="outline" fullWidth />}
      />
    );
  }

  return (
    <ProfileScreenSections
      userId={user?.id}
      email={user?.email}
      fullName={fullName}
      phone={phone}
      notifyEmail={notifyEmail}
      notifyWhatsApp={notifyWhatsApp}
      onFullNameChange={setFullName}
      onPhoneChange={setPhone}
      onNotifyEmailChange={setNotifyEmail}
      onNotifyWhatsAppChange={setNotifyWhatsApp}
      onSave={saveProfile}
      onSignOut={confirmSignOut}
      onOpenPrivacy={openPrivacy}
      onOpenTerms={openTerms}
      onDeleteAccount={deleteAccount}
      isSaving={isSaving}
      isSigningOut={isSigningOut}
      whatsappVerified={whatsappVerified}
      whatsappPhone={whatsappPhone}
      onWhatsAppVerified={onWhatsAppVerified}
      telegramLinked={telegramLinked}
      telegramUsername={telegramUsername}
      onLinkTelegram={linkTelegram}
      isRefreshing={isRefreshing}
      onRefresh={() => void retryLoad()}
    />
  );
}

