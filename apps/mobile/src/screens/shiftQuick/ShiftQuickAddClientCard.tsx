import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import Card from '../../components/ui/Card';
import { styles } from './styles';

type AddClientFormState = {
    showAddClient: boolean;
    setShowAddClient: (value: boolean) => void;
    newClientName: string;
    setNewClientName: (value: string) => void;
    newServiceName: string;
    setNewServiceName: (value: string) => void;
    newServiceAmount: string;
    setNewServiceAmount: (value: string) => void;
    newConsumablesAmount: string;
    setNewConsumablesAmount: (value: string) => void;
    resetForm: () => void;
};

type Props = {
    form: AddClientFormState;
    isSaving: boolean;
    onSave: () => void;
};

export function ShiftQuickAddClientCard({ form, isSaving, onSave }: Props) {
    return (
        <Card style={styles.addClientCard}>
            {!form.showAddClient ? (
                <TouchableOpacity
                    style={styles.addClientButton}
                    onPress={() => form.setShowAddClient(true)}
                >
                    <Ionicons name="add-circle" size={24} color="#4f46e5" />
                    <Text style={styles.addClientButtonText}>Добавить клиента</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.addClientForm}>
                    <Text style={styles.addClientFormTitle}>Новый клиент</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Имя клиента *"
                        value={form.newClientName}
                        onChangeText={form.setNewClientName}
                        autoFocus
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Услуга"
                        value={form.newServiceName}
                        onChangeText={form.setNewServiceName}
                    />
                    <View style={styles.amountRow}>
                        <TextInput
                            style={[styles.input, styles.amountInput]}
                            placeholder="Сумма"
                            value={form.newServiceAmount}
                            onChangeText={form.setNewServiceAmount}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={[styles.input, styles.amountInput]}
                            placeholder="Расходники"
                            value={form.newConsumablesAmount}
                            onChangeText={form.setNewConsumablesAmount}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.addClientActions}>
                        <TouchableOpacity
                            style={[styles.addClientActionButton, styles.cancelButton]}
                            onPress={form.resetForm}
                        >
                            <Text style={styles.cancelButtonText}>Отмена</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.addClientActionButton, styles.saveButton]}
                            onPress={onSave}
                            disabled={isSaving || !form.newClientName.trim()}
                        >
                            <Text style={styles.saveButtonText}>Добавить</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </Card>
    );
}
