import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { registerUser } from '../../src/services/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: 'driver' | 'vendor' }>();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!phone || !name) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Format phone number to E.164
    const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;

    setLoading(true);
    try {
      const additionalData: Record<string, string> = {};

      if (role === 'driver') {
        if (companyName) additionalData['custom:companyName'] = companyName;
        if (truckNumber) additionalData['custom:truckNumber'] = truckNumber;
      } else if (role === 'vendor') {
        if (companyName) additionalData['custom:businessName'] = companyName;
      }

      await registerUser(formattedPhone, name, role || 'driver', additionalData);

      router.push({
        pathname: '/(auth)/verify-otp',
        params: { phone: formattedPhone, role },
      });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {role === 'driver' ? 'Driver' : 'Vendor'} Registration
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Phone Number (+1234567890)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {role === 'driver' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Company Name (Optional)"
              value={companyName}
              onChangeText={setCompanyName}
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              placeholder="Truck Number (Optional)"
              value={truckNumber}
              onChangeText={setTruckNumber}
              autoCapitalize="characters"
            />
          </>
        )}

        {role === 'vendor' && (
          <TextInput
            style={styles.input}
            placeholder="Business Name"
            value={companyName}
            onChangeText={setCompanyName}
            autoCapitalize="words"
          />
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
