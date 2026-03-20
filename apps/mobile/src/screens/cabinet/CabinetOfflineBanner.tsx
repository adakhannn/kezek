import { Text, View } from 'react-native';

import { formatDate, formatTime } from '../../utils/format';
import { styles } from './styles';

export function CabinetOfflineBanner({ lastSyncAt }: { lastSyncAt: string | null }) {
    return (
        <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
                Нет подключения к интернету — показаны сохранённые данные
                {lastSyncAt ? ` (последняя синхронизация: ${formatDate(lastSyncAt)} ${formatTime(lastSyncAt)})` : ''}
            </Text>
        </View>
    );
}
