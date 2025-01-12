import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Pet {
  id: number;
  name: string;
  breed: string;
  imageUrl: string | null;
  age: string;
}

const MyPetScreen = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const navigation = useNavigation();
  const [editDeleteTab, setEditDeleteTab] = useState<boolean>(false);


  useEffect(() => {
    loadSelectedPetId();
    fetchPets();
    if(pets.length === 0){
      AsyncStorage.setItem('selectedPetName', '');
    }
  }, []);

  useFocusEffect(() => {
    if (pets.length === 0)
      AsyncStorage.setItem('selectedPetName', '');
  });

  const fetchPets = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        return;
      }

      const response = await fetch('http://192.168.1.100:3001/api/fetch-pets', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const formattedPets: Pet[] = data.map((pet: any) => ({
        id: pet.pet_id,
        name: pet.name,
        breed: pet.breed,
        imageUrl: pet.imageUrl,
        age: calculateAge(pet.birth_date),
        
      }));

      setPets(formattedPets);

       // Check if selectedPetId is already set in AsyncStorage because if pet is not selected before first pet should be selected default
    const storedPetId = await AsyncStorage.getItem('selectedPetId');
    if (!storedPetId && formattedPets.length > 0) {
      // Set the selectedPetId to the first pet's ID
      const firstPet = formattedPets[0];
      await selectPet(firstPet.id, firstPet.name); // Update AsyncStorage and state
    }
    } catch (error) {
      console.error('Error fetching pets:', error);
      Alert.alert('Error', 'Something went wrong fetching pets.');
    } finally {
      setLoading(false);
    }
  };

  const handleLongPress = async (id: number, name: string) => {
    try {
      setEditDeleteTab(true);
      await selectPet(id, name);
    } catch (error) {
      
    }
  }

  const handleEdit = async () => {

  }

  const handleDelete = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        setLoading(false);
        return;
      }
  
      const response = await fetch('http://192.168.1.100:3001/api/delete-pet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Add Content-Type for JSON
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedPetId, // Use the correct key `id` matching the server code
        }),
      });
  
      if (!response.ok) {
        // Check if the response is not successful
        const errorData = await response.json();
        console.error('Failed to delete pet:', errorData);
        Alert.alert('Error', errorData.message || 'Failed to delete pet');
        setLoading(false);
        return;
      }
  
      const data = await response.json();
  
      // Optional: Perform actions after deletion
      Alert.alert('Success', 'Pet deleted successfully');
      setPets((prevPets) => prevPets.filter((pet) => pet.id !== selectedPetId));
      setSelectedPetId(null); // Reset selected pet ID
      setEditDeleteTab(false);
    } catch (error) {
      console.error('Error deleting pet:', error);
      Alert.alert('Error', 'Something went wrong while deleting the pet');
    } finally {
      setLoading(false); // Ensure loading state is reset
    }
  };

  const calculateAge = (birth_date: Date | null): string => {
    if (!birth_date) return 'Unknown';
    const birth = new Date(birth_date);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age -= 1;
    }
    return `${age} ${age === 1 ? 'year' : 'years'}`;
  };

  const selectPet = async (id: number, name: string) => {
    try {
      await AsyncStorage.setItem('selectedPetId', id.toString());
      await AsyncStorage.setItem('selectedPetName', name)
      setSelectedPetId(id);
      await loadSelectedPetId();
    } catch (error) {
      console.error('Error storing selected pet ID:', error);
    }
  };


  const loadSelectedPetId = async () => {
    try {
      const storedId = await AsyncStorage.getItem('selectedPetId');
      if (storedId !== null) {
        setSelectedPetId(parseInt(storedId, 10));
      }
    } catch (error) {
      console.error('Error loading selected pet ID:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPets(); // Call fetchPets to re-fetch data
    setRefreshing(false);
  };

  const renderPetCard = ({ item }: { item: Pet }) => (
    <TouchableOpacity onPress={() => selectPet(item.id, item.name)} onLongPress={() => handleLongPress(item.id, item.name)} style={styles.petItem}>
      <View style={styles.petDetailsContainer}>
        <Image
          source={
            item.imageUrl
              ? { uri: item.imageUrl }
              : require('../../assets/splash-icon.png')
          }
          style={styles.petImage}
        />
        <View>
          <Text style={styles.petName}>{item.name}</Text>
          <Text style={styles.petDetails}>{`${item.age} - ${item.breed}`}</Text>
        </View>
      </View>
      <Ionicons
        name={selectedPetId === item.id ? 'radio-button-on' : 'radio-button-off'}
        size={24}
        color={selectedPetId === item.id ? '#007bff' : '#ccc'}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            You have no pets added to your account. Please add your pet first.
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddPet')}
          >
            <Text style={styles.addButtonText}>Let’s Add!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
  {editDeleteTab ? (
    // Show three TouchableOpacity buttons when editDeleteTab is true
    <View style={styles.editDeleteContainer}>
      <TouchableOpacity
        onPress={() => console.log('Edit pressed')}
        style={styles.editButton}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleDelete()}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setEditDeleteTab(false); // Set back to false to show the default header
        }}
        style={styles.cancelButton}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  ) : (
    // Show the default header when editDeleteTab is false
    <Text style={styles.headerTitle}>Your Pets</Text>
  )}
</View>
          <FlatList
            data={pets}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPetCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Add Pet</Text>
            <Text style={styles.footerSubText}>
              If you have more pets to add, you can do so below.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddPet')}
            >
              <Text style={styles.addButtonText}>Let’s Add!</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 10,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 24,
    paddingBottom: 10,
    fontWeight: 'bold',
  },
  editDeleteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  editButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#ff4d4d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  petItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  petDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#e0e0e0', // Placeholder background color
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  petDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  footerContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 20,
  },
  footerText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  footerSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default MyPetScreen;