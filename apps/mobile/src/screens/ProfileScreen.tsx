import { ScrollView, View, Text } from 'react-native';

import { ProfileActionsSection } from './profile/ProfileActionsSection';
import { ProfileNotificationsSection } from './profile/ProfileNotificationsSection';
import { ProfilePersonalInfoSection } from './profile/ProfilePersonalInfoSection';
import { ProfileScreenLoading } from './profile/ProfileScreenState';
import { styles } from './profile/styles';
import { useProfileScreen } from './profile/useProfileScreen';

export default function ProfileScreen() {
    const {
        user,
        isLoading,
        fullName,
        phone,
        notifyEmail,
        notifyWhatsApp,
        isSaving,
        setFullName,
        setPhone,
        setNotifyEmail,
        setNotifyWhatsApp,
        handleSave,
        handleSignOut,
    } = useProfileScreen();

    if (isLoading) {
        return <ProfileScreenLoading />;
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>РџСЂРѕС„РёР»СЊ</Text>
            </View>

            <ProfilePersonalInfoSection
                fullName={fullName}
                phone={phone}
                email={user?.email}
                onChangeFullName={setFullName}
                onChangePhone={setPhone}
            />

            <ProfileNotificationsSection
                notifyEmail={notifyEmail}
                notifyWhatsApp={notifyWhatsApp}
                onChangeNotifyEmail={setNotifyEmail}
                onChangeNotifyWhatsApp={setNotifyWhatsApp}
            />

            <ProfileActionsSection
                saving={isSaving}
                onSave={handleSave}
                onSignOut={handleSignOut}
            />
        </ScrollView>
    );
}
