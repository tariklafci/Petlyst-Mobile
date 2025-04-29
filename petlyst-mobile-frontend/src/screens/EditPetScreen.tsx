import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

interface EditPetScreenProps {
  route: any;
  navigation: any;
}

export default function EditPetScreen({ route, navigation }: EditPetScreenProps) {
  // Expect petId (and optionally petName) to be passed from MyPetScreen
  const { petId, petName, petBreed, petSpecies, petBirthDate } = route.params;

  
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [species, setSpecies] = useState('');
  // image will be used for a new selection, while currentPhoto holds the existing S3 URL
  const [image, setImage] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
  }, []);

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    console.warn("A date has been picked: ", date);
    setBirthDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    hideDatePicker();
  };

  const handleSelectImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      Alert.alert('Error', 'Please fill in all fields.');
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

      const response = await fetch('http://192.168.84.209:3001/api/edit-pet', {
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Edit Pet {petName ? `- ${petName}` : ''}</Text>

      <Text style={styles.label}>Breed</Text>
      <TextInput
        style={styles.input}
        placeholder={petBreed}
        value={breed}
        onChangeText={setBreed}
      />

      <Text style={styles.label}>Birth Date</Text>
      <TouchableOpacity style={styles.button} onPress={showDatePicker}>
        <Text style={styles.inputButtonText}>
          {birthDate || petBirthDate.split('T')[0]}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />

      <Text style={styles.label}>Species</Text>
      <View style={styles.pickerview}>
        <Picker
          selectedValue={petSpecies}
          style={styles.picker}
          onValueChange={(itemValue) => setSpecies(itemValue)}
        >
          <Picker.Item label="Select Species" value="" />
          <Picker.Item label="Cat" value="cat" />
          <Picker.Item label="Dog" value="dog" />
          {/* Add more species if needed */}
        </Picker>
      </View>

      <TouchableOpacity style={styles.imageButton} onPress={handleSelectImage}>
        <Text style={styles.imageButtonText}>Select New Image</Text>
      </TouchableOpacity>

      {/* Show the new image if one is selected; otherwise show the current photo */}
      {image ? (
        <Image source={{ uri: image }} style={styles.imagePreview} />
      ) : currentPhoto ? (
        <Image source={{ uri: currentPhoto }} style={styles.imagePreview} />
      ) : null}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleUpdatePet}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>{loading ? 'Updating...' : 'Update Pet'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefefe',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  button: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  inputButtonText: {
    fontSize: 16,
    color: '#C7C7CD',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  pickerview: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  imageButton: {
    backgroundColor: '#ccc',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  imageButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePreview: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 15,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#6c63ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
