import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import DateTimePickerModal from "react-native-modal-datetime-picker";

export default function AddPetScreen ({ route, navigation }: { route: any; navigation: any }) {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [species, setSpecies] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

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
    // No permissions request is necessary for launching the image library
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

  const handleAddPet = async () => {
    if (!name || !breed || !birthDate || !species) {
      return Alert.alert('Error', 'Please fill in all fields and select an image.');
    }

    try {

      const token = await SecureStore.getItemAsync('userToken');
              if (!token) {
                Alert.alert('Error', 'No token found. Please log in again.');
                return;
              }
      const formData = new FormData();
      formData.append('name', name);
      formData.append('breed', breed);
      formData.append('birthDate', birthDate);
      formData.append('species', species);
      if (image) {
        formData.append('photo', {
          uri: image, // The URI string
          name: image.split('/').pop() || 'photo.jpg', // Extract file name from URI or use a default
          type: 'image/jpeg', // Specify the MIME type
          //deneme
        });
      }
      

      const response = await fetch('http://192.168.63.209:3001/api/add-pet', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', data.message, [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('MainTabs', {
                screen: 'MyPet',
              }), // Navigate to MyPet within the MainTabs
          },
        ]);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong.');
    }
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Add a New Pet</Text>

      <Text style={styles.label}>Pet's Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your pet's name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Breed</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter the breed"
        value={breed}
        onChangeText={setBreed}
      />


      <Text style={styles.label}>Birth Date</Text>
      <TouchableOpacity style={styles.button} onPress={showDatePicker}>
        <Text style={styles.inputButtonText}>
          {birthDate || 'Enter the birth date'}
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
        selectedValue={species}
        style={styles.picker}
        onValueChange={(itemValue) => setSpecies(itemValue)}
      >
        <Picker.Item label="Select Species" value="" />
        <Picker.Item label="Cat" value="cat" />
        <Picker.Item label="Dog" value="dog" />
        {/* Add more species as needed */}
      </Picker>
      </View>

      <TouchableOpacity style={styles.imageButton} onPress={handleSelectImage}>
        <Text style={styles.imageButtonText}>Select Image</Text>
      </TouchableOpacity>

      {image && <Image source={{ uri: image }} style={styles.imagePreview} />}

      <TouchableOpacity style={styles.saveButton} onPress={handleAddPet}>
        <Text style={styles.saveButtonText}>Save Pet</Text>
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
  button:{
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
  pickerview:{
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
