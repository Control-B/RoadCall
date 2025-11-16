import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { Chip } from '@/src/components/Chip';
import { Card } from '@/src/components/Card';
import { useLocation } from '@/src/hooks/useLocation';
import { roadcallApi } from '@/src/api/roadcallApi';
import { useAuthStore } from '@/src/store/authStore';
import { useRequestStore } from '@/src/store/requestStore';
import { ProblemType } from '@/src/types';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface NewRequestScreenProps {
  onRequestCreated: (requestId: string) => void;
  onCancel: () => void;
}

const PROBLEM_TYPES: ProblemType[] = [
  'Tire',
  'Engine',
  'Battery',
  'Fuel',
  'Tow',
  'Brakes',
  'Other',
];

export function NewRequestScreen({
  onRequestCreated,
  onCancel,
}: NewRequestScreenProps) {
  const { user } = useAuthStore();
  const { setActiveRequest } = useRequestStore();
  const {
    location,
    loading: locationLoading,
    error: locationError,
    getCurrentLocation,
    hasPermission,
    requestPermission,
  } = useLocation();

  const [problemType, setProblemType] = useState<ProblemType | null>(null);
  const [hasTrailer, setHasTrailer] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [manualAddress, setManualAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Location Permission',
          'Location access is required to request roadside help. Please enable location in settings.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    await getCurrentLocation();
  };

  const handlePickImage = async () => {
    if (photos.length >= 3) {
      Alert.alert('Maximum Photos', 'You can only upload up to 3 photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!problemType) {
      Alert.alert('Validation Error', 'Please select a problem type');
      return false;
    }

    if (hasTrailer === null) {
      Alert.alert('Validation Error', 'Please indicate if trailer is attached');
      return false;
    }

    if (!location && !manualAddress.trim()) {
      Alert.alert(
        'Validation Error',
        'Please allow location access or enter your location manually'
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;

    setLoading(true);
    try {
      const finalLocation = location || {
        lat: 0,
        lng: 0,
        address: manualAddress,
      };

      const request = await roadcallApi.createRequest({
        location: finalLocation,
        problemType: problemType!,
        hasTrailer: hasTrailer!,
        notes: notes.trim(),
        photos,
        truckType: user.truckType,
        truckNumber: user.truckNumber,
      });

      setActiveRequest(request);
      onRequestCreated(request.id);
    } catch (error: any) {
      Alert.alert('Request Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Request Roadside Help</Text>
        <Text style={styles.subtitle}>
          Tell us about your situation and we'll find help
        </Text>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Your Location</Text>
        {locationLoading ? (
          <Text style={styles.locationText}>Getting your location...</Text>
        ) : location?.address ? (
          <Text style={styles.locationText}>{location.address}</Text>
        ) : (
          <Input
            value={manualAddress}
            onChangeText={setManualAddress}
            placeholder="Enter your location manually"
            multiline
          />
        )}
        {!locationLoading && (
          <Button
            title="Refresh Location"
            onPress={getCurrentLocation}
            variant="secondary"
            style={styles.refreshButton}
          />
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>What's the problem?</Text>
        <View style={styles.chipContainer}>
          {PROBLEM_TYPES.map((type) => (
            <Chip
              key={type}
              label={type}
              selected={problemType === type}
              onPress={() => setProblemType(type)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Is trailer attached?</Text>
        <View style={styles.trailerButtons}>
          <TouchableOpacity
            style={[
              styles.trailerButton,
              hasTrailer === true && styles.trailerButtonSelected,
            ]}
            onPress={() => setHasTrailer(true)}>
            <Text
              style={[
                styles.trailerButtonText,
                hasTrailer === true && styles.trailerButtonTextSelected,
              ]}>
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.trailerButton,
              hasTrailer === false && styles.trailerButtonSelected,
            ]}
            onPress={() => setHasTrailer(false)}>
            <Text
              style={[
                styles.trailerButtonText,
                hasTrailer === false && styles.trailerButtonTextSelected,
              ]}>
              No
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Notes</Text>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the issue in detail..."
          multiline
          style={styles.notesInput}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Photos (Optional)</Text>
        <Text style={styles.photoSubtitle}>Up to 3 photos</Text>
        <View style={styles.photoContainer}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoWrapper}>
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={() => removePhoto(index)}>
                <Text style={styles.removePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 3 && (
            <TouchableOpacity
              style={styles.addPhoto}
              onPress={handlePickImage}>
              <Text style={styles.addPhotoText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      <Button
        title="Send Request"
        onPress={handleSubmit}
        loading={loading}
        style={styles.submitButton}
      />

      <Button
        title="Cancel"
        onPress={onCancel}
        variant="secondary"
        style={styles.cancelButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxlarge,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: '#000000',
    marginBottom: spacing.md,
  },
  locationText: {
    fontSize: fontSize.regular,
    color: '#000000',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  refreshButton: {
    marginTop: spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  trailerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trailerButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: moderateScale(12),
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  trailerButtonSelected: {
    backgroundColor: '#007AFF',
  },
  trailerButtonText: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: '#000000',
  },
  trailerButtonTextSelected: {
    color: '#FFFFFF',
  },
  notesInput: {
    minHeight: moderateScale(100),
  },
  photoSubtitle: {
    fontSize: fontSize.small,
    color: '#8E8E93',
    marginBottom: spacing.md,
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoWrapper: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(8),
    backgroundColor: '#E5E5EA',
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: fontSize.regular,
    fontWeight: '700',
  },
  addPhoto: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(8),
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: fontSize.huge,
    color: '#007AFF',
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
