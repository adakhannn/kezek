import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ProfileScreenSections } from './profile/ProfileScreenSections';
import { useProfileScreenData } from './profile/useProfileScreenData';

export default function ProfileScreen() {
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
    saveProfile,
    confirmSignOut,
    isSaving,
    isSigningOut,
  } = useProfileScreenData();

  if (isLoading) {
    return <LoadingSpinner message="Загружаем данные..." />;
  }

  if (loadError) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Не удалось загрузить профиль"
        message="Проверьте соединение и попробуйте снова."
        action={<Button title="Повторить" onPress={() => void retryLoad()} variant="outline" fullWidth />}
      />
    );
  }

  return (
    <ProfileScreenSections
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
      isSaving={isSaving}
      isSigningOut={isSigningOut}
    />
  );
}

