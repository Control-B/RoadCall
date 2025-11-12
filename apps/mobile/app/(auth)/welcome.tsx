import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Roadcall Assistant</Text>
        <Text style={styles.subtitle}>
          Get help when you need it most
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.driverButton]}
            onPress={() => router.push('/(auth)/register?role=driver')}
          >
            <Text style={styles.buttonText}>I'm a Driver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.vendorButton]}
            onPress={() => router.push('/(auth)/register?role=vendor')}
          >
            <Text style={styles.buttonText}>I'm a Vendor</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 60,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  driverButton: {
    backgroundColor: '#007AFF',
  },
  vendorButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
