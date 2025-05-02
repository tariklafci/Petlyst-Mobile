import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface EditPetScreenProps {
  route: any;
  navigation: any;
}

export default function EditPetScreen({ route, navigation }: EditPetScreenProps) {
  // Expect petId (and optionally petName) to be passed from MyPetScreen
  const { petId, petName, petBreed, petSpecies, petBirthDate } = route.params;

  const [breed, setBreed] = useState(petBreed || '');
  const [birthDate, setBirthDate] = useState(petBirthDate?.split('T')[0] || '');
  const [species, setSpecies] = useState(petSpecies || '');
  // image will be used for a new selection, while currentPhoto holds the existing S3 URL
  const [image, setImage] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const speciesOptions = [
    { label: 'Cat', value: 'cat', icon: 'paw' },
    { label: 'Dog', value: 'dog', icon: 'paw' },
    { label: 'Bird', value: 'bird', icon: 'airplane' },
    { label: 'Fish', value: 'fish', icon: 'water' },
    { label: 'Rabbit', value: 'rabbit', icon: 'paw' },
    { label: 'Hamster', value: 'hamster', icon: 'paw' },
  ];

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date: Date) => {
    setBirthDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    hideDatePicker();
  };

  const handleSelectImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpdatePet = async () => {
    if (!breed || !birthDate || !species) {
      Alert.alert('Missing Information', 'Please fill in all fields to continue.');
      return;
    }

    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        return;
      }

      // Build form data; note that pet_name is not updated per your schema.
      const formData = new FormData();
      formData.append('pet_name', petName);
      formData.append('pet_id', petId);
      formData.append('breed', breed);
      formData.append('birthDate', birthDate);
      formData.append('species', species);
      if (image) {
        formData.append('photo', {
          uri: image,
          name: image.split('/').pop() || 'photo.jpg',
          type: 'image/jpeg',
        } as any);
      }

      const response = await fetch('http://192.168.0.101:3001/api/edit-pet', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', data.message, [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MainTabs', {
              screen: 'MyPet',
            }),
          },
        ]);
      } else {
        Alert.alert('Error', data.error || 'Failed to update pet.');
      }
    } catch (error) {
      console.error('Error updating pet:', error);
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const getSpeciesIcon = (speciesValue: string) => {
    const option = speciesOptions.find(opt => opt.value === speciesValue);
    return option?.icon || 'paw';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.headerGradient}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.header}>Edit Pet Profile</Text>
        <Text style={styles.petName}>{petName}</Text>
      </LinearGradient>

      <View style={styles.imageContainer}>
        <TouchableOpacity onPress={handleSelectImage} style={styles.imagePicker}>
          {image ? (
            <Image source={{ uri: image }} style={styles.petImage} />
          ) : currentPhoto ? (
            <Image source={{ uri: currentPhoto }} style={styles.petImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="paw" size={60} color="#6c63ff" />
            </View>
          )}
          <View style={styles.cameraIconContainer}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Breed</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="paw-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter breed"
              value={breed}
              onChangeText={setBreed}
              placeholderTextColor="#aaa"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Birth Date</Text>
          <TouchableOpacity style={styles.inputContainer} onPress={showDatePicker}>
            <Ionicons name="calendar-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
            <Text style={birthDate ? styles.dateInputText : styles.dateInputPlaceholder}>
              {birthDate || "Select birth date"}
            </Text>
          </TouchableOpacity>
        </View>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          maximumDate={new Date()}
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Species</Text>
          <TouchableOpacity 
            style={styles.inputContainer}
            onPress={() => setPickerVisible(!pickerVisible)}
          >
            <Ionicons 
              name={getSpeciesIcon(species) + "-outline" as any} 
              size={20} 
              color="#6c63ff" 
              style={styles.inputIcon} 
            />
            <Text style={species ? styles.dateInputText : styles.dateInputPlaceholder}>
              {species ? speciesOptions.find(opt => opt.value === species)?.label : "Select species"}
            </Text>
            <Ionicons name={pickerVisible ? "chevron-up" : "chevron-down"} size={20} color="#6c63ff" />
          </TouchableOpacity>
        </View>

        {pickerVisible && (
          <View style={styles.customPickerContainer}>
            {speciesOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.speciesOption,
                  species === option.value && styles.selectedSpeciesOption
                ]}
                onPress={() => {
                  setSpecies(option.value);
                  setPickerVisible(false);
                }}
              >
                <Ionicons 
                  name={option.icon + (species === option.value ? "" : "-outline") as any} 
                  size={20} 
                  color={species === option.value ? "#fff" : "#6c63ff"} 
                />
                <Text style={[
                  styles.speciesOptionText,
                  species === option.value && styles.selectedSpeciesOptionText
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.updateButton}
        onPress={handleUpdatePet}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={styles.updateButtonText}>Update Pet</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
  },
  petName: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 5,
    paddingBottom: 30,
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: -50,
  },
  imagePicker: {
    position: 'relative',
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6c63ff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  formContainer: {
    padding: 20,
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dateInputText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dateInputPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#aaa',
  },
  customPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: -15,
    marginBottom: 20,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  speciesOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    marginVertical: 3,
  },
  selectedSpeciesOption: {
    backgroundColor: '#6c63ff',
  },
  speciesOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  selectedSpeciesOptionText: {
    color: '#fff',
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: '#6c63ff',
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
