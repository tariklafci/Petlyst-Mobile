import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

interface Pet {
  id: number;
  name: string;
  breed: string;
  species: string;
  imageUrl: string | null;
  pet_birth_date: Date;
  age: string;
}

interface DayItem {
  id: string;
  dayName: string;
  dateNum: string;
  dateObj: Date;
}

const AppointmentDetailsScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  // Appointment configuration (fallback values provided)
  const clinic_id = route?.params?.clinic_id;
  const openingTime = route?.params?.openingTime || '10:00';
  const closingTime = route?.params?.closingTime || '17:00';
  const interval = route?.params?.clinic_time_slots || 30;

  // State variables
  const [days, setDays] = useState<DayItem[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [allSlots, setAllSlots] = useState<string[]>([]);
  const [leftSlots, setLeftSlots] = useState<string[]>([]);
  const [rightSlots, setRightSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [isLoadingPets, setIsLoadingPets] = useState<boolean>(true);
  const [petsError, setPetsError] = useState<string | null>(null);
  const [showPetModal, setShowPetModal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isVideoMeeting, setIsVideoMeeting] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Utility: Generate next N days starting from today
  const generateNextDays = (count: number): DayItem[] => {
    const daysArray: DayItem[] = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const weekday = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 2);
      daysArray.push({
        id: `${weekday} ${date.getDate()}`,
        dayName: weekday,
        dateNum: date.getDate().toString(),
        dateObj: date,
      });
    }
    return daysArray;
  };

  // Utility: Generate time slots based on opening/closing times and interval
  const generateTimeSlots = (open: string, close: string, intervalMinutes: number): string[] => {
    const [openHour, openMinute] = open.split(':').map(Number);
    const [closeHour, closeMinute] = close.split(':').map(Number);
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
      if (
        nextHour > closeHour ||
        (nextHour === closeHour && nextMinute > closeMinute)
      ) {
        break;
      }
      const endHour = nextHour.toString().padStart(2, '0');
      const endMin = nextMinute.toString().padStart(2, '0');
      slots.push(`${startHour}.${startMin} - ${endHour}.${endMin}`);
      currentHour = nextHour;
      currentMinute = nextMinute;
    }
    return slots;
  };

  // Utility: Split array into two columns
  const splitIntoTwoColumns = (arr: string[]): { left: string[]; right: string[] } => {
    const midpoint = Math.ceil(arr.length / 2);
    return { left: arr.slice(0, midpoint), right: arr.slice(midpoint) };
  };

  // Utility: Calculate pet age based on birth date
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

  // Utility: Set the first pet as default
  const selectFirstPet = async (id: number, name: string) => {
    try {
      await AsyncStorage.setItem('selectedPetId', id.toString());
      await AsyncStorage.setItem('selectedPetName', name);
      const pet = pets.find(p => p.id === id) || null;
      setSelectedPet(pet);
    } catch (error) {
      console.error('Error storing selected pet ID:', error);
    }
  };

  // Fetch pets from the API
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
        headers: { Authorization: `Bearer ${token}` },
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
      const storedPetId = await AsyncStorage.getItem('selectedPetId');
      if (storedPetId && formattedPets.length > 0) {
        const petId = parseInt(storedPetId, 10);
        const pet = formattedPets.find(p => p.id === petId);
        if (pet) {
          setSelectedPet(pet);
        } else if (formattedPets.length > 0) {
          await selectFirstPet(formattedPets[0].id, formattedPets[0].name);
        }
      } else if (formattedPets.length > 0) {
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

  // On component mount, generate days, time slots, and fetch pets
  useEffect(() => {
    const nextDays = generateNextDays(15);
    setDays(nextDays);
    if (nextDays.length > 0) {
      setSelectedDayId(nextDays[0].id);
    }
    const slots = generateTimeSlots(openingTime, closingTime, interval);
    setAllSlots(slots);
    const { left, right } = splitIntoTwoColumns(slots);
    setLeftSlots(left);
    setRightSlots(right);
    fetchPets();
  }, []);

  // Refresh pets when the screen gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPets);
    return unsubscribe;
  }, [navigation]);

  // Handlers for pet, day, and time selection
  const handlePetCardPress = () => setShowPetModal(true);
  const handlePetSelect = (pet: Pet) => {
    setSelectedPet(pet);
    setShowPetModal(false);
    AsyncStorage.setItem('selectedPetId', pet.id.toString());
    AsyncStorage.setItem('selectedPetName', pet.name);
  };
  const handleDayPress = (dayId: string) => {
    setSelectedDayId(dayId);
    setSelectedTime(null);
  };
  const handleTimePress = (time: string) => setSelectedTime(time);

  // Parse the selected time slot into start and end Date objects
  const parseTimeSlot = (timeSlotString: string | null): { start: Date | null; end: Date | null } => {
    if (!timeSlotString) return { start: null, end: null };
    try {
      const [startStr, endStr] = timeSlotString.split(' - ');
      const [startHour, startMinute] = startStr.split('.').map(Number);
      const [endHour, endMinute] = endStr.split('.').map(Number);
      const selectedDay = days.find(day => day.id === selectedDayId);
      if (!selectedDay) return { start: null, end: null };
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

  // Prepare appointment details for confirmation
  const getFormattedAppointmentDetails = () => {
    if (!selectedPet || !selectedDayId || !selectedTime) return null;
    const selectedDay = days.find(day => day.id === selectedDayId);
    if (!selectedDay) return null;
    const formattedDate = selectedDay.dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return {
      petName: selectedPet.name,
      petBreed: selectedPet.breed,
      date: formattedDate,
      time: selectedTime,
    };
  };

  // When the user taps to complete the appointment
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
    setShowConfirmModal(true);
  };

  // Submit appointment to the backend
  const submitAppointment = async () => {
    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        setIsSubmitting(false);
        return;
      }
      const petId = selectedPet?.id;
      if (!petId) {
        Alert.alert('Error', 'No pet selected.');
        setIsSubmitting(false);
        return;
      }
      const selectedDay = days.find(day => day.id === selectedDayId);
      if (!selectedDay) {
        Alert.alert('Error', 'No day selected.');
        setIsSubmitting(false);
        return;
      }
      const { start, end } = parseTimeSlot(selectedTime);
      if (!start || !end) {
        Alert.alert('Error', 'Invalid time selection.');
        setIsSubmitting(false);
        return;
      }

      // Create a function to format dates consistently
      const formatDateForServer = (date: Date): string => {
        const pad = (num: number): string => String(num).padStart(2, '0');
        
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // months are 0-indexed
        const day = pad(date.getDate());
        
        // Format: YYYY-MM-DD
        return `${year}-${month}-${day}`;
      };
      
      // Format date without timezone conversion - use the same function we use for time
      const appointmentDate = formatDateForServer(selectedDay.dateObj);
      
      // Create timezone-aware datetime strings that preserve the selected local time
      // This prevents the issue where toISOString() converts to UTC and shifts the time
      const formatDateTimeForServer = (date: Date): string => {
        const pad = (num: number): string => String(num).padStart(2, '0');
        
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // months are 0-indexed
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        
        // Format: YYYY-MM-DD HH:MM:SS (PostgreSQL timestamp format)
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };
      
      const appointmentData = {
        pet_id: petId,
        video_meeting: isVideoMeeting,
        appointment_start_hour: formatDateTimeForServer(start),
        appointment_end_hour: formatDateTimeForServer(end),
        notes: notes.trim(),
        appointment_date: appointmentDate,
        clinic_id: clinic_id,
        appointment_status: 'pending'
      };
      
      const response = await fetch('https://petlyst.com:3001/api/create-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appointmentData),
      });
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${response.status}).`);
      }
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Failed to parse server response.');
      }
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create appointment');
      }
      setShowConfirmModal(false);
      setNotes('');
      setIsVideoMeeting(false);
      Alert.alert(
        'Appointment Created',
        `Your appointment has been successfully scheduled.${isVideoMeeting ? '\n\nYou will receive a video meeting link before your appointment.' : ''}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      let errorMessage = 'Failed to create appointment';
      if (error instanceof Error) errorMessage = error.message;
      Alert.alert('Error', errorMessage, [
        { text: 'Try Again', style: 'cancel' },
        { text: 'Cancel', onPress: () => setShowConfirmModal(false) },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render functions for day and time selections
  const renderDayItem = ({ item }: { item: DayItem }) => {
    const isSelected = item.id === selectedDayId;
    return (
      <TouchableOpacity
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
      <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
      
      {/* Header */}
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.headerGradient}
      >
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {isLoadingPets ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>Loading your pets...</Text>
        </View>
      ) : pets.length === 0 ? (
        <Animatable.View
          animation="fadeIn"
          duration={800}
          style={styles.emptyContainer}
        >
          <Ionicons name="paw-outline" size={60} color="#6c63ff" style={{ opacity: 0.5 }} />
          <Text style={styles.emptyText}>No Pets Found</Text>
          <Text style={styles.emptySubText}>
            To proceed with booking an appointment, you need to add a pet to your profile first.
          </Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => navigation.navigate('AddPet')}
          >
            <LinearGradient
              colors={['#6c63ff', '#3b5998']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addButtonGradient}
            >
              <Text style={styles.addButtonText}>Add a Pet</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>
      ) : (
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          style={styles.contentContainer}
        >
          <ScrollView contentContainerStyle={styles.scrollContentContainer}>
            {/* Which Pet? */}
            <Text style={styles.sectionTitle}>Which Pet?</Text>
            <TouchableOpacity style={styles.petCard} onPress={handlePetCardPress}>
              {selectedPet ? (
                <>
                  <Image
                    source={selectedPet.imageUrl ? { uri: selectedPet.imageUrl } : require('../../assets/splash-icon.png')}
                    style={styles.petImage}
                  />
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{selectedPet.name}</Text>
                    <Text style={styles.petDetails}>{selectedPet.age} - {selectedPet.breed}</Text>
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
              contentContainerStyle={styles.daysList}
            />

            {/* Time slots (split into two columns) */}
            <View style={styles.timeSlotsContainer}>
              <View style={styles.timeColumn}>
                {leftSlots.map(time => renderTimeButton(time, 'left'))}
              </View>
              <View style={styles.timeColumn}>
                {rightSlots.map(time => renderTimeButton(time, 'right'))}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.completeButton, 
                (!selectedPet || !selectedTime) && styles.completeButtonDisabled
              ]}
              onPress={handleCompleteAppointment}
              disabled={!selectedPet || !selectedTime}
            >
              <LinearGradient
                colors={['#6c63ff', '#3b5998']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.completeButtonGradient,
                  (!selectedPet || !selectedTime) && { opacity: 0.7 }
                ]}
              >
                <Text style={styles.completeButtonText}>Complete Appointment</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animatable.View>
      )}

      {/* Pet Selection Modal */}
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
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Loading pets...</Text>
              </View>
            ) : petsError ? (
              <Text style={{ color: 'red' }}>{petsError}</Text>
            ) : pets.length > 0 ? (
              pets.map(pet => (
                <TouchableOpacity
                  key={pet.id}
                  style={styles.petOption}
                  onPress={() => handlePetSelect(pet)}
                >
                  <Image
                    source={pet.imageUrl ? { uri: pet.imageUrl } : require('../../assets/splash-icon.png')}
                    style={styles.petOptionImage}
                  />
                  <View style={styles.petOptionInfo}>
                    <Text style={styles.petOptionName}>{pet.name}</Text>
                    <Text style={styles.petOptionDesc}>{pet.age} - {pet.breed}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text>No pets available</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => {
                    setShowPetModal(false);
                    navigation.navigate('AddPet');
                  }}
                >
                  <Text style={styles.addButtonText}>Add a Pet</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowPetModal(false)}>
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
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Video Meeting:</Text>
              <Switch
                trackColor={{ false: "#ccc", true: "#007bff" }}
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
            <Text style={styles.notesLabel}>Additional Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Any specific concerns or questions?"
              value={notes}
              onChangeText={setNotes}
            />
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowConfirmModal(false)} disabled={isSubmitting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={submitAppointment} disabled={isSubmitting}>
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

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
    marginTop: -20,
    backgroundColor: '#f9f9f9',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 25,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 30,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    marginTop: 20,
  },
  addButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    color: '#333',
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  petImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#f0f0ff',
  },
  petInfo: {
    flex: 1,
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
  daysList: {
    paddingVertical: 8,
  },
  dayItem: {
    width: 50,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f0f0ff',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayItemSelected: {
    backgroundColor: '#6c63ff',
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
  timeSlotsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'space-between',
  },
  timeColumn: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e0e0ff',
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 8,
  },
  timeSlot: {
    backgroundColor: '#f0f0ff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeSlotSelected: {
    backgroundColor: '#6c63ff',
  },
  timeText: {
    fontSize: 14,
    color: '#333',
  },
  timeTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  completeButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  completeButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.7,
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
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
  petOptionInfo: {
    marginLeft: 10,
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
    backgroundColor: '#007bff',
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
