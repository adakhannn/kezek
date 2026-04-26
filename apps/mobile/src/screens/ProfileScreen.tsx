import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ProfileScreenSections } from './profile/ProfileScreenSections';
import { useProfileScreenData } from './profile/useProfileScreenData';

export default function ProfileScreen() {
    const {
        user,
        isLoading,
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
        return <LoadingSpinner message="Загрузка..." />;
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
