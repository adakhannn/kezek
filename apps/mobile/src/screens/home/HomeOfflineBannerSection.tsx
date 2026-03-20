import { View } from 'react-native';

import OfflineBanner from '../../components/ui/OfflineBanner';

type Props = {
    styles: any;
    visible: boolean;
};

export function HomeOfflineBannerSection({ styles, visible }: Props) {
    if (!visible) {
        return null;
    }

    return (
        <View style={styles.offlineBannerWrapper}>
            <OfflineBanner />
        </View>
    );
}
