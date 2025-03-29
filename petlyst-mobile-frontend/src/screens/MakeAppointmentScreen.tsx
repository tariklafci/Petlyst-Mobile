// AppointmentDetailsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';



/**
 * Utility to generate a range of days (starting from "today" for 'count' days).
 * Returns objects with dayName (Mon, Tue, etc.), dateNum (e.g. 14), and a Date instance.
 */
function generateNextDays(count: number) {
  const days: { id: string; dayName: string; dateNum: string; dateObj: Date }[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Day abbreviation, e.g., 'MO', 'TU', etc.
    const weekday = date
      .toLocaleString('en-US', { weekday: 'short' })
      .toUpperCase() // e.g. "MON" => we'll just take first 2 letters
      .slice(0, 2);

    days.push({
      id: `${weekday} ${date.getDate()}`, // e.g. "MO 19"
      dayName: weekday,
      dateNum: date.getDate().toString(),
      dateObj: date,
    });
  }
  return days;
}

/**
 * Utility to generate time slots (e.g. "09.00 - 09.30") from opening to closing in intervals.
 * - openingTime, closingTime: "HH:MM" strings
 * - intervalMinutes: e.g. 30
 */
function generateTimeSlots(
  openingTime: string,
  closingTime: string,
  intervalMinutes: number
): string[] {
  const [openHour, openMinute] = openingTime.split(':').map(Number);
  const [closeHour, closeMinute] = closingTime.split(':').map(Number);

  let currentHour = openHour;
  let currentMinute = openMinute;
  const slots: string[] = [];

  while (
    currentHour < closeHour ||
    (currentHour === closeHour && currentMinute < closeMinute)
  ) {
    const startHour = currentHour.toString().padStart(2, '0');
    const startMin = currentMinute.toString().padStart(2, '0');

    let nextMinute = currentMinute + intervalMinutes;
    let nextHour = currentHour;

    if (nextMinute >= 60) {
      nextHour += 1;
      nextMinute -= 60;
    }

    // If we exceed closing time, break
    if (
      nextHour > closeHour ||
      (nextHour === closeHour && nextMinute > closeMinute)
    ) {
      break;
    }

    const endHour = nextHour.toString().padStart(2, '0');
    const endMin = nextMinute.toString().padStart(2, '0');

    // e.g. "09.00 - 09.30"
    slots.push(`${startHour}.${startMin} - ${endHour}.${endMin}`);

    currentHour = nextHour;
    currentMinute = nextMinute;
  }

  return slots;
}

/**
 * Helper to split an array into two roughly equal parts (for left & right columns).
 */
function splitIntoTwoColumns(arr: string[]): { left: string[]; right: string[] } {
  const midpoint = Math.ceil(arr.length / 2);
  return {
    left: arr.slice(0, midpoint),
    right: arr.slice(midpoint),
  };
}

interface Pet {
  id: number;
  name: string;
  breed: string;
  species: string;
  imageUrl: string | null;
  pet_birth_date: Date;
  age: string;
}

/**
 * Example AppointmentDetailsScreen:
 * - "Which Pet?" is selectable. Tapping it opens a modal of user's pets.
 * - "Which Date?" is a horizontal list from today's date forward (7 days).
 * - Time slots are generated from openingTime, closingTime, interval.
 * - Splits slots into two columns in dashed boxes.
 * - Final "Complete Appointment" button logs selections (or do your booking logic).
 */
const AppointmentDetailsScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  // Suppose you get these from route.params or a fetch:
  const openingTime = route?.params?.openingTime || '09:00';
  const closingTime = route?.params?.closingTime || '17:00';
  const interval = route?.params?.timeSlotInterval || 30; // in minutes

  // For demonstration, generate next 7 days:
  const [days, setDays] = useState<
    { id: string; dayName: string; dateNum: string; dateObj: Date }[]
  >([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');

  // Time slots
  const [allSlots, setAllSlots] = useState<string[]>([]);
  const [leftSlots, setLeftSlots] = useState<string[]>([]);
  const [rightSlots, setRightSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Pets
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showPetModal, setShowPetModal] = useState<boolean>(false);
  const [isLoadingPets, setIsLoadingPets] = useState<boolean>(true);
  const [petsError, setPetsError] = useState<string | null>(null);

  useEffect(() => {
    // Generate days from today
    const nextDays = generateNextDays(15);
    setDays(nextDays);

    // Default select the first day in the array
    if (nextDays.length > 0) {
      setSelectedDayId(nextDays[0].id);
    }

    // Generate time slots from opening/closing times
    const slots = generateTimeSlots(openingTime, closingTime, interval);
    setAllSlots(slots);

    // Split into two columns
    const { left, right } = splitIntoTwoColumns(slots);
    setLeftSlots(left);
    setRightSlots(right);

    // Fetch pets from API
    const fetchPets = async () => {
      setIsLoadingPets(true);
      setPetsError(null);
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch('https://petlyst.com:3001/api/fetch-pets', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch pets');
        }

        const data = await response.json();
        setPets(data);
        
        // Select the first pet by default if available
        if (data.length > 0) {
          setSelectedPet(data[0]);
        }
      } catch (error) {
        console.error('Error fetching pets:', error);
        setPetsError(error instanceof Error ? error.message : 'Failed to fetch pets');
      } finally {
        setIsLoadingPets(false);
      }
    };

    fetchPets();
  }, []);

  const fetchPets = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        return;
      }

      const response = await fetch('https://petlyst.com:3001/api/fetch-pets', {
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

  /** "Which Pet?" card tapped => show modal of pets */
  const handlePetCardPress = () => {
    setShowPetModal(true);
  };

  /** User picks a pet in the modal */
  const handlePetSelect = (pet: Pet) => {
    setSelectedPet(pet);
    setShowPetModal(false);
  };

  /** Day tapped in the horizontal list */
  const handleDayPress = (dayId: string) => {
    setSelectedDayId(dayId);
    setSelectedTime(null); // reset time selection
  };

  /** Time slot tapped */
  const handleTimePress = (time: string) => {
    setSelectedTime(time);
  };

  /** Final "Complete Appointment" */
  const handleCompleteAppointment = () => {
    // In a real app, you might navigate or call an API here
    const chosenDay = days.find((d) => d.id === selectedDayId);
    console.log('Selected Pet:', selectedPet?.name);
    console.log('Selected Day:', chosenDay?.dateObj?.toDateString());
    console.log('Selected Time:', selectedTime);

    // For demonstration, just log. You could do:
    // navigation.navigate('ConfirmScreen', { ...data });
  };

  /** Renders a single day in the horizontal list */
  const renderDayItem = ({ item }: { item: typeof days[0] }) => {
    const isSelected = item.id === selectedDayId;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.dayItem, isSelected && styles.dayItemSelected]}
        onPress={() => handleDayPress(item.id)}
      >
        <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
          {item.dayName}
        </Text>
        <Text style={[styles.dateNum, isSelected && styles.dateNumSelected]}>
          {item.dateNum}
        </Text>
      </TouchableOpacity>
    );
  };

  /** Renders a single time slot button in the columns */
  const renderTimeButton = (time: string, column: 'left' | 'right') => {
    const isSelected = time === selectedTime;
    return (
      <TouchableOpacity
        key={`${column}-${time}`}
        style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
        onPress={() => handleTimePress(time)}
      >
        <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
          {time}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 24 }} /> {/* placeholder for spacing */}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Which Pet? */}
        <Text style={styles.sectionTitle}>Which Pet?</Text>
        <TouchableOpacity style={styles.petCard} onPress={handlePetCardPress}>
          {selectedPet ? (
            <>
              <Image
                source={{ uri: selectedPet.imageUri }}
                style={styles.petImage}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.petName}>{selectedPet.name}</Text>
                <Text style={styles.petDesc}>
                  {selectedPet.age} - {selectedPet.breed}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.petName}>Select a pet</Text>
          )}
        </TouchableOpacity>

        {/* Which Date? */}
        <Text style={styles.sectionTitle}>Which Date?</Text>
        <FlatList
          data={days}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={renderDayItem}
          contentContainerStyle={{ paddingVertical: 8 }}
        />

        {/* Time slots in two columns */}
        <View style={styles.timeSlotsRow}>
          {/* Left Column */}
          <View style={styles.timeColumn}>
            {leftSlots.map((time) => renderTimeButton(time, 'left'))}
          </View>
          {/* Right Column */}
          <View style={styles.timeColumn}>
            {rightSlots.map((time) => renderTimeButton(time, 'right'))}
          </View>
        </View>

        {/* Complete Appointment Button */}
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteAppointment}>
          <Text style={styles.completeButtonText}>Complete Appointment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal for pet selection */}
      <Modal
        visible={showPetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select a Pet</Text>
            {isLoadingPets ? (
              <Text style={styles.petOptionName}>Loading pets...</Text>
            ) : petsError ? (
              <Text style={[styles.petOptionName, { color: 'red' }]}>{petsError}</Text>
            ) : pets.length > 0 ? (
              pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={styles.petOption}
                  onPress={() => handlePetSelect(pet)}
                >
                  <Image source={{ uri: pet.imageUri }} style={styles.petOptionImage} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.petOptionName}>{pet.name}</Text>
                    <Text style={styles.petOptionDesc}>
                      {pet.age} - {pet.breed}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.petOptionName}>No pets available</Text>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPetModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AppointmentDetailsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },

  // Pet card
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F9FD',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  petImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  petDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  // Day picker
  dayItem: {
    width: 50,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F6F9FD',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayItemSelected: {
    backgroundColor: '#006DFF',
  },
  dayName: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  dateNum: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dayNameSelected: {
    color: '#FFF',
  },
  dateNumSelected: {
    color: '#FFF',
  },

  // Time slots
  timeSlotsRow: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'space-between',
  },
  timeColumn: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#DDE7F0',
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 8,
  },
  timeSlot: {
    backgroundColor: '#F6F9FD',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeSlotSelected: {
    backgroundColor: '#006DFF',
  },
  timeText: {
    fontSize: 14,
    color: '#333',
  },
  timeTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },

  // Complete button
  completeButton: {
    marginTop: 24,
    backgroundColor: '#006DFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Pet selection modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  petOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  petOptionImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  petOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  petOptionDesc: {
    fontSize: 14,
    color: '#666',
  },
  modalCloseButton: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#EEE',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalCloseText: {
    fontSize: 14,
    color: '#333',
  },
});
