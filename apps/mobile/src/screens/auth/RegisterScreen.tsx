import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { roadcallApi } from '@/src/api/roadcallApi';
import { useAuthStore } from '@/src/store/authStore';
import { TruckType } from '@/src/types';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

const TRUCK_TYPES: TruckType[] = [
  'Day Cab',
  'Sleeper',
  'Box Truck',
  'Flatbed',
  'Reefer',
  'Tanker',
  'Other',
];

export function RegisterScreen({
  onNavigateToLogin,
  onRegisterSuccess,
}: RegisterScreenProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    truckingCompany: '',
    truckNumber: '',
    truckType: 'Day Cab' as TruckType,
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login } = useAuthStore();

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.truckingCompany.trim())
      newErrors.truckingCompany = 'Trucking company is required';
    if (!formData.truckNumber.trim())
      newErrors.truckNumber = 'Truck number is required';
    if (!formData.password.trim() || formData.password.length < 6)
      newErrors.password = 'Password must be at least 6 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await roadcallApi.register({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        truckingCompany: formData.truckingCompany.trim(),
        truckNumber: formData.truckNumber.trim(),
        truckType: formData.truckType,
        password: formData.password,
      });

      await login(response.accessToken, response.refreshToken, response.user);
      onRegisterSuccess();
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join RoadCall Assist</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            value={formData.name}
            onChangeText={(value) => updateField('name', value)}
            placeholder="John Doe"
            error={errors.name}
          />

          <Input
            label="Phone Number"
            value={formData.phone}
            onChangeText={(value) => updateField('phone', value)}
            placeholder="+1 (555) 123-4567"
            keyboardType="phone-pad"
            error={errors.phone}
          />

          <Input
            label="Email (Optional)"
            value={formData.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="john@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="Trucking Company"
            value={formData.truckingCompany}
            onChangeText={(value) => updateField('truckingCompany', value)}
            placeholder="ABC Trucking"
            error={errors.truckingCompany}
          />

          <Input
            label="Truck Number"
            value={formData.truckNumber}
            onChangeText={(value) => updateField('truckNumber', value)}
            placeholder="TRK-123"
            error={errors.truckNumber}
          />

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Truck Type</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerValue}>{formData.truckType}</Text>
            </View>
          </View>

          <Input
            label="Password"
            value={formData.password}
            onChangeText={(value) => updateField('password', value)}
            placeholder="At least 6 characters"
            secureTextEntry
            error={errors.password}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.button}
          />

          <Button
            title="Back to Login"
            onPress={onNavigateToLogin}
            variant="secondary"
            style={styles.button}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  pickerValue: {
    fontSize: 17,
    color: '#000000',
  },
});
