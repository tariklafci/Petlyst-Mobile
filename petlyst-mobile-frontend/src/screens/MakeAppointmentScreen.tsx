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
  ActivityIndicator,
  TextInput,
  Switch,
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

  // Appointment confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isVideoMeeting, setIsVideoMeeting] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Function to navigate to AddPet screen
  const handleNavigateToAddPet = () => {
    // Store the current route name in AsyncStorage to return here after adding a pet
    AsyncStorage.setItem('previousScreen', 'AppointmentDetails');
    navigation.navigate('AddPet');
  };

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
    fetchPets();

    // Check if we're returning from AddPet screen
    const checkPreviousScreen = async () => {
      const prevScreen = await AsyncStorage.getItem('previousScreen');
      if (prevScreen === 'AppointmentDetails') {
        // We're returning from Add Pet screen, refetch pets
        fetchPets();
        // Clear the stored value
        await AsyncStorage.removeItem('previousScreen');
      }
    };
    
    checkPreviousScreen();
  }, []);

  useEffect(() => {
    // This will run when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      // Refetch pets when the screen is focused
      fetchPets();
    });

    // Clean up the listener when component unmounts
    return unsubscribe;
  }, [navigation]);

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

  const selectFirstPet = async (id: number, name: string) => {
    try {
      await AsyncStorage.setItem('selectedPetId', id.toString());
      await AsyncStorage.setItem('selectedPetName', name);
      setSelectedPet(pets.find(pet => pet.id === id) || null);
    } catch (error) {
      console.error('Error storing selected pet ID:', error);
    }
  };

  const fetchPets = async () => {
    setIsLoadingPets(true);
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

      // Check if selectedPetId is already set in AsyncStorage
      const storedPetId = await AsyncStorage.getItem('selectedPetId');
      if (storedPetId && formattedPets.length > 0) {
        const petId = parseInt(storedPetId, 10);
        const pet = formattedPets.find(p => p.id === petId);
        if (pet) {
          setSelectedPet(pet);
        } else if (formattedPets.length > 0) {
          // If stored pet not found, default to first pet
          await selectFirstPet(formattedPets[0].id, formattedPets[0].name);
        }
      } else if (formattedPets.length > 0) {
        // No stored pet ID, set the first pet
        await selectFirstPet(formattedPets[0].id, formattedPets[0].name);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
      setPetsError(error instanceof Error ? error.message : 'Failed to fetch pets');
      Alert.alert('Error', 'Something went wrong fetching pets.');
    } finally {
      setIsLoadingPets(false);
    }
  };

  /** "Which Pet?" card tapped => show modal of pets */
  const handlePetCardPress = () => {
    setShowPetModal(true);
  };

  /** User picks a pet in the modal */
  const handlePetSelect = (pet: Pet) => {
    setSelectedPet(pet);
    setShowPetModal(false);
    // Also update AsyncStorage
    AsyncStorage.setItem('selectedPetId', pet.id.toString());
    AsyncStorage.setItem('selectedPetName', pet.name);
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

  /** Parse time string "HH.MM - HH.MM" into start and end objects */
  const parseTimeSlot = (timeSlotString: string | null): { start: Date | null, end: Date | null } => {
    if (!timeSlotString) return { start: null, end: null };

    try {
      const [startStr, endStr] = timeSlotString.split(' - ');
      const [startHour, startMinute] = startStr.split('.').map(Number);
      const [endHour, endMinute] = endStr.split('.').map(Number);

      // Find the selected day
      const selectedDay = days.find(day => day.id === selectedDayId);
      if (!selectedDay) return { start: null, end: null };

      // Create new date objects for start and end times
      const startDate = new Date(selectedDay.dateObj);
      startDate.setHours(startHour, startMinute, 0, 0);

      const endDate = new Date(selectedDay.dateObj);
      endDate.setHours(endHour, endMinute, 0, 0);

      return { start: startDate, end: endDate };
    } catch (error) {
      console.error('Error parsing time slot:', error);
      return { start: null, end: null };
    }
  };

  /** Final "Complete Appointment" */
  const handleCompleteAppointment = () => {
    if (!selectedPet) {
      Alert.alert('Missing Information', 'Please select a pet for the appointment.');
      return;
    }

    if (!selectedDayId) {
      Alert.alert('Missing Information', 'Please select a day for the appointment.');
      return;
    }

    if (!selectedTime) {
      Alert.alert('Missing Information', 'Please select a time slot for the appointment.');
      return;
    }

    // Show the confirmation modal to collect additional details
    setShowConfirmModal(true);
  };

  /** Submit the appointment to the backend */
  const submitAppointment = async () => {
    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      // Get the selected pet ID
      const petId = selectedPet?.id;
      if (!petId) {
        Alert.alert('Error', 'No pet selected.');
        setIsSubmitting(false);
        return;
      }

      // Get the selected day
      const selectedDay = days.find(day => day.id === selectedDayId);
      if (!selectedDay) {
        Alert.alert('Error', 'No day selected.');
        setIsSubmitting(false);
        return;
      }

      // Parse the time slot
      const { start, end } = parseTimeSlot(selectedTime);
      if (!start || !end) {
        Alert.alert('Error', 'Invalid time selection.');
        setIsSubmitting(false);
        return;
      }

      // Format the date for the API (YYYY-MM-DD)
      const appointmentDate = selectedDay.dateObj.toISOString().split('T')[0];

      // Create the appointment data
      const appointmentData = {
        pet_id: petId,
        video_meeting: isVideoMeeting,
        appointment_start_hour: start.toISOString(),
        appointment_end_hour: end.toISOString(),
        notes: notes.trim(),
        appointment_date: appointmentDate
      };

      console.log('Sending appointment data:', JSON.stringify(appointmentData));

      // Log the API endpoint we're using
      console.log('API endpoint:', 'https://petlyst.com:3001/api/create-appointment');

      // Send the data to the backend
      const response = await fetch('https://petlyst.com:3001/api/create-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(appointmentData)
      });

      // Log the response status and headers
      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      
      // Check for non-JSON responses
      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);
      
      // Get the response text regardless of content type
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response:', responseText);
        throw new Error(`Server returned non-JSON response (${response.status}). Please contact support.`);
      }

      // Parse the JSON response
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Failed to parse server response. Please contact support.');
      }
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create appointment');
      }
      
      // Close the modal and reset form
      setShowConfirmModal(false);
      setNotes('');
      setIsVideoMeeting(false);
      
      // Show success message
      Alert.alert(
        'Appointment Created', 
        `Your appointment has been successfully scheduled.${isVideoMeeting ? '\n\nYou will receive a video meeting link before your appointment.' : ''}`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('Error creating appointment:', error);
      let errorMessage = 'Failed to create appointment';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Error', 
        errorMessage,
        [
          { 
            text: 'Try Again',
            style: 'cancel'
          },
          {
            text: 'Cancel',
            onPress: () => setShowConfirmModal(false)
          }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Format the appointment details for display */
  const getFormattedAppointmentDetails = () => {
    if (!selectedPet || !selectedDayId || !selectedTime) return null;

    const selectedDay = days.find(day => day.id === selectedDayId);
    
    if (!selectedDay) return null;

    // Format the date: e.g., "Monday, January 1, 2023"
    const formattedDate = selectedDay.dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      petName: selectedPet.name,
      petBreed: selectedPet.breed,
      date: formattedDate,
      time: selectedTime
    };
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

      {isLoadingPets ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#006DFF" />
          <Text style={styles.loadingText}>Loading your pets...</Text>
        </View>
      ) : pets.length === 0 ? (
        // No pets view
        <View style={styles.noPetsContainer}>
          <Ionicons name="paw-outline" size={60} color="#006DFF" />
          <Text style={styles.noPetsTitle}>No Pets Found</Text>
          <Text style={styles.noPetsMessage}>
            To proceed with booking an appointment, you need to add a pet to your profile first.
          </Text>
          <TouchableOpacity 
            style={styles.addPetButton}
            onPress={handleNavigateToAddPet}
          >
            <Text style={styles.addPetButtonText}>Add a Pet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {/* Which Pet? */}
          <Text style={styles.sectionTitle}>Which Pet?</Text>
          <TouchableOpacity style={styles.petCard} onPress={handlePetCardPress}>
            {selectedPet ? (
              <>
                <Image
                  source={
                    selectedPet.imageUrl
                      ? { uri: selectedPet.imageUrl }
                      : require('../../assets/splash-icon.png')
                  }
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
          <TouchableOpacity 
            style={[
              styles.completeButton,
              (!selectedPet || !selectedTime) && styles.completeButtonDisabled
            ]} 
            onPress={handleCompleteAppointment}
            disabled={!selectedPet || !selectedTime}
          >
            <Text style={styles.completeButtonText}>Complete Appointment</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

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
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#006DFF" />
                <Text style={styles.loadingText}>Loading pets...</Text>
              </View>
            ) : petsError ? (
              <Text style={[styles.petOptionName, { color: 'red' }]}>{petsError}</Text>
            ) : pets.length > 0 ? (
              pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={styles.petOption}
                  onPress={() => handlePetSelect(pet)}
                >
                  <Image 
                    source={
                      pet.imageUrl
                        ? { uri: pet.imageUrl }
                        : require('../../assets/splash-icon.png')
                    }
                    style={styles.petOptionImage} 
                  />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.petOptionName}>{pet.name}</Text>
                    <Text style={styles.petOptionDesc}>
                      {pet.age} - {pet.breed}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noPetsModalContent}>
                <Text style={styles.petOptionName}>No pets available</Text>
                <TouchableOpacity
                  style={styles.addPetModalButton}
                  onPress={() => {
                    setShowPetModal(false);
                    handleNavigateToAddPet();
                  }}
                >
                  <Text style={styles.addPetButtonText}>Add a Pet</Text>
                </TouchableOpacity>
              </View>
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

      {/* Appointment Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.modalTitle}>Confirm Appointment</Text>
            
            {/* Appointment Details Summary */}
            {getFormattedAppointmentDetails() && (
              <View style={styles.appointmentSummary}>
                <Text style={styles.summaryTitle}>Appointment Details</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pet:</Text>
                  <Text style={styles.summaryValue}>
                    {getFormattedAppointmentDetails()?.petName} ({getFormattedAppointmentDetails()?.petBreed})
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date:</Text>
                  <Text style={styles.summaryValue}>{getFormattedAppointmentDetails()?.date}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Time:</Text>
                  <Text style={styles.summaryValue}>{getFormattedAppointmentDetails()?.time}</Text>
                </View>
              </View>
            )}

            {/* Video Meeting Option */}
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Video Meeting:</Text>
              <Switch
                trackColor={{ false: "#ccc", true: "#006DFF" }}
                thumbColor={isVideoMeeting ? "#fff" : "#f4f3f4"}
                onValueChange={setIsVideoMeeting}
                value={isVideoMeeting}
              />
            </View>
            
            {isVideoMeeting && (
              <Text style={styles.videoMeetingNote}>
                A secure meeting link will be sent to you before the appointment.
              </Text>
            )}

            {/* Notes Input */}
            <Text style={styles.notesLabel}>Additional Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Any specific concerns or questions?"
              value={notes}
              onChangeText={setNotes}
            />

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={submitAppointment}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  noPetsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noPetsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  noPetsMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    lineHeight: 22,
  },
  addPetButton: {
    backgroundColor: '#006DFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 10,
  },
  addPetButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  noPetsModalContent: {
    alignItems: 'center',
    padding: 10,
  },
  addPetModalButton: {
    backgroundColor: '#006DFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
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
  completeButtonDisabled: {
    backgroundColor: '#A5C7F0',
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
    maxHeight: '80%',
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

  // Appointment Confirmation Modal
  confirmModalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '90%',
  },
  appointmentSummary: {
    backgroundColor: '#F6F9FD',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    width: 60,
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
  },
  videoMeetingNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#DDE7F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F6F9FD',
    height: 100,
    textAlignVertical: 'top',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    backgroundColor: '#EEE',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#006DFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});
