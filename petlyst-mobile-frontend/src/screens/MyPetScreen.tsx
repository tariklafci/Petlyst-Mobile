import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

interface Pet {
  id: number;
  name: string;
  breed: string;
  species: string;
  imageUrl: string | null;
  pet_birth_date: Date;
  age: string;
}

const MyPetScreen = ({ navigation }: { navigation: any }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetName, setSelectedPetName] = useState<string | null>(null);
  const [selectedPetBreed, setSelectedPetBreed] = useState<string | null>(null);
  const [selectedPetSpecies, setSelectedPetSpecies] = useState<string | null>(null);
  const [selectedPetBirthDate, setSelectedPetBirthDate] = useState<Date | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [editDeleteTab, setEditDeleteTab] = useState<boolean>(false);


  useEffect(() => {
    loadSelectedPetId();
    fetchPets();
    if(pets.length === 0){
      AsyncStorage.setItem('selectedPetName', '');
    }
  }, []);


  //Use Focus Effect --> when first pet is created, set selectedPetName is AsyncStorage and make its radiobutton active, if there is no pet set selectedPetName as null
  useFocusEffect(
    useCallback(() => {
      const updateSelectedPetName = async () => {
        try {
          const storedPetName = await AsyncStorage.getItem('selectedPetName');
  
          if (pets.length === 0) {
            // If no pets exist, clear the selected pet
            await AsyncStorage.removeItem('selectedPetName');
            await AsyncStorage.removeItem('selectedPetId');
            setSelectedPetId(null);
          } else if (!storedPetName) {
            // If no pet is selected and pets exist, set the first pet as default
            await AsyncStorage.setItem('selectedPetName', pets[0].name);
            await AsyncStorage.setItem('selectedPetId', pets[0].id.toString());
            setSelectedPetId(pets[0].id);
          }
        } catch (error) {
          console.error('Error updating selected pet:', error);
        }
      };
  
      updateSelectedPetName();
    }, [pets]) // Runs when `pets` changes
  );
  
  

  const fetchPets = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        return;
      }

      const response = await fetch('http://192.168.0.101:3001/api/fetch-pets', {
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
        name: pet.pet_name,
        breed: pet.pet_breed,
        species: pet.pet_species,
        imageUrl: pet.pet_photo,
        pet_birth_date: pet.pet_birth_date,
        age: calculateAge(pet.pet_birth_date),
        
      }));

      setPets(formattedPets);

       // Check if selectedPetId is already set in AsyncStorage because if pet is not selected before first pet should be selected default
    const storedPetId = await AsyncStorage.getItem('selectedPetId');
    if (!storedPetId && formattedPets.length > 0) {
      // Set the selectedPetId to the first pet's ID
      const firstPet = formattedPets[0];
      await selectFirstPet(firstPet.id, firstPet.name); // Update AsyncStorage and state
    }
    } catch (error) {
      console.error('Error fetching pets:', error);
      Alert.alert('Error', 'Something went wrong fetching pets.');
    } finally {
      setLoading(false);
    }
  };

  const handleLongPress = async (id: number, name: string, breed: string, species: string, birth_date: Date) => {
    try {
      setEditDeleteTab(true);
      await selectPet(id, name, breed, species, birth_date);
    } catch (error) {
      
    }
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
  
      const response = await fetch('http://192.168.0.101:3001/api/delete-pet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedPetId,
        }),
      });
  
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Failed to delete pet:', responseData);
        
        // Show specific error message if pet has appointments
        if (response.status === 400 && responseData.message && responseData.message.includes('appointment')) {
          Alert.alert(
            'Cannot Delete Pet', 
            responseData.message,
            [
              {
                text: 'OK',
                style: 'default'
              }
            ]
          );
        } else {
          // Generic error for other cases
          Alert.alert('Error', responseData.message || 'Failed to delete pet');
        }
        
        setLoading(false);
        return;
      }
  
      Alert.alert('Success', 'Pet deleted successfully');
  
      // Remove the deleted pet from the pets list
      const updatedPets = pets.filter((pet) => pet.id !== selectedPetId);
      setPets(updatedPets);
  
      // If the deleted pet was selected, reassign selection
      if (selectedPetId !== null) {
        if (updatedPets.length > 0) {
          // Assign the first remaining pet as the new selected pet
          await AsyncStorage.setItem('selectedPetName', updatedPets[0].name);
          await AsyncStorage.setItem('selectedPetId', updatedPets[0].id.toString());
          setSelectedPetId(updatedPets[0].id);
        } else {
          // No pets left, clear selection
          await AsyncStorage.removeItem('selectedPetName');
          await AsyncStorage.removeItem('selectedPetId');
          setSelectedPetId(null);
        }
      }
  
      setEditDeleteTab(false);
    } catch (error) {
      console.error('Error deleting pet:', error);
      Alert.alert('Error', 'Something went wrong while deleting the pet');
    } finally {
      setLoading(false);
    }
  };
  

  const calculateAge = (birth_date: Date | null): string => {
    if (!birth_date) return 'Unknown';
  
    const birth = new Date(birth_date);
    const now = new Date();
  
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
  
    if (now.getDate() < birth.getDate()) {
      months -= 1; // not a full month yet
    }
  
    if (months < 0) {
      years -= 1;
      months += 12;
    }
  
    const yearPart = years > 0 ? `${years} ${years === 1 ? 'year' : 'years'}` : '';
    const monthPart = months > 0 ? `${months} ${months === 1 ? 'month' : 'months'}` : '';
  
    if (yearPart && monthPart) {
      return `${yearPart} ${monthPart}`;
    } else if (yearPart) {
      return yearPart;
    } else if (monthPart) {
      return monthPart;
    } else {
      return 'Less than a month';
    }
  };
  

  const selectFirstPet = async (id: number, name: string) => {
    try {
      await AsyncStorage.setItem('selectedPetId', id.toString());
      await AsyncStorage.setItem('selectedPetName', name)
      setSelectedPetId(id);
      await loadSelectedPetId();
    } catch (error) {
      console.error('Error storing selected pet ID:', error);
    }
  };

  const selectPet = async (id: number, name: string, breed: string, species: string, birthDate: Date) => {
    try {
      await AsyncStorage.setItem('selectedPetId', id.toString());
      await AsyncStorage.setItem('selectedPetName', name)
      setSelectedPetId(id);
      setSelectedPetName(name);
      setSelectedPetBreed(breed);
      setSelectedPetSpecies(species);
      setSelectedPetBirthDate(birthDate);
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

  const getPetSpeciesIcon = (species: string) => {
    switch(species.toLowerCase()) {
      case 'dog':
        return 'paw';
      case 'cat':
        return 'paw';
      case 'bird':
        return 'airplane';
      case 'fish':
        return 'water';
      default:
        return 'paw';
    }
  };

  const renderPetCard = ({ item, index }: { item: Pet, index: number }) => {
    // Add animation with stagger effect based on index
    const animationDelay = index * 100;
    
    return (
      <Animatable.View
        animation="fadeIn"
        duration={600}
        delay={animationDelay}
      >
        <TouchableOpacity 
          onPress={() => selectPet(item.id, item.name, item.breed, item.species, item.pet_birth_date)} 
          onLongPress={() => handleLongPress(item.id, item.name, item.breed, item.species, item.pet_birth_date)}
          style={[styles.petItem, selectedPetId === item.id && styles.selectedPetItem]}
          activeOpacity={0.8}
        >
          <View style={styles.petDetailsContainer}>
            <View style={styles.petImageContainer}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.petImage}
                />
              ) : (
                <View style={[styles.petImage, styles.placeholderImage]}>
                  <Ionicons name={getPetSpeciesIcon(item.species) as any} size={24} color="#6c63ff" />
                </View>
              )}
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{item.name}</Text>
              <View style={styles.petMetaRow}>
                <Text style={styles.petAge}>{item.age}</Text>
                <View style={styles.breedBadge}>
                  <Text style={styles.breedText}>{item.breed}</Text>
                </View>
              </View>
            </View>
          </View>
          <Ionicons
            name={selectedPetId === item.id ? 'radio-button-on' : 'radio-button-off'}
            size={24}
            color={selectedPetId === item.id ? '#6c63ff' : '#ccc'}
          />
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        {editDeleteTab ? (
          <View style={styles.editDeleteContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditPet', {
                petId: selectedPetId, 
                petName: selectedPetName, 
                petBreed: selectedPetBreed, 
                petSpecies: selectedPetSpecies, 
                petBirthDate: selectedPetBirthDate})}
              style={styles.editButton}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleDelete()}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setEditDeleteTab(false)}
              style={styles.cancelButton}
            >
              <Ionicons name="close-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Your Pets</Text>
        )}
        <Text style={styles.headerSubtitle}>Manage your furry friends</Text>
      </LinearGradient>

      {pets.length === 0 ? (
        <Animatable.View 
          style={styles.emptyContainer}
          animation="fadeIn"
          duration={800}
        >
          <Ionicons name="paw-outline" size={80} color="#e0e0ff" />
          <Text style={styles.emptyTitle}>No Pets Yet</Text>
          <Text style={styles.emptyText}>
            You have no pets added to your account. Let's add your pet to get started!
          </Text>
          <TouchableOpacity
            style={styles.addButtonPrimary}
            onPress={() => navigation.navigate('AddPet')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add My Pet</Text>
          </TouchableOpacity>
        </Animatable.View>
      ) : (
        <>
          <FlatList
            data={pets}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPetCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                colors={['#6c63ff']}
                tintColor={'#6c63ff'}
              />
            }
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                {pets.length === 1 ? '1 Pet' : `${pets.length} Pets`}
              </Text>
            }
            ListFooterComponent={
              <View style={styles.footerContainer}>
                <Animatable.View 
                  animation="fadeInUp"
                  duration={600}
                >
                  <LinearGradient
                    colors={['#f0f0ff', '#e0e0ff']}
                    style={styles.addPetCard}
                  >
                    <View style={styles.addPetContent}>
                      <Ionicons name="add-circle" size={50} color="#6c63ff" />
                      <View style={styles.addPetTextContainer}>
                        <Text style={styles.addPetTitle}>Add another pet</Text>
                        <Text style={styles.addPetSubText}>
                          Register more pets to your profile
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.addPetButton}
                      onPress={() => navigation.navigate('AddPet')}
                    >
                      <Text style={styles.addPetButtonText}>Add Pet</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </Animatable.View>
              </View>
            }
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editDeleteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  addButtonPrimary: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 15,
    marginLeft: 5,
  },
  petItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedPetItem: {
    borderWidth: 2,
    borderColor: '#6c63ff',
    backgroundColor: '#f8f8ff',
  },
  petDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  petImageContainer: {
    marginRight: 15,
  },
  petImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  placeholderImage: {
    backgroundColor: '#e0e0ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  petMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petAge: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  breedBadge: {
    backgroundColor: '#e0e0ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  breedText: {
    fontSize: 12,
    color: '#6c63ff',
    fontWeight: '500',
  },
  footerContainer: {
    marginTop: 20,
  },
  addPetCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  addPetContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  addPetTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  addPetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  addPetSubText: {
    fontSize: 14,
    color: '#666',
  },
  addPetButton: {
    backgroundColor: '#6c63ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addPetButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MyPetScreen;