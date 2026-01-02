import { View, Text, StyleSheet } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/types';

type VerifyScreenRouteProp = RouteProp<AuthStackParamList, 'Verify'>;

type Props = {
    route: VerifyScreenRouteProp;
};

export default function VerifyScreen({ route }: Props) {
    const { phone, email } = route.params || {};

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Подтверждение</Text>
            {phone && <Text>Телефон: {phone}</Text>}
            {email && <Text>Email: {email}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
});

