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
  // --- Clinic ID from params ---
  const clinic_id = route?.params?.clinic_id;
  console.log('CLINIC ID:', clinic_id);

  // --- 1) Move clinic hours & interval into state with fallbacks ---
  const [openingTime, setOpeningTime] = useState<string>(
    route?.params?.clinic_opening_hour ??
    route?.params?.opening_hour      ??
    route?.params?.openingTime      ??
    route?.params?.openingHour      ??
    '10:00'
  );
  const [closingTime, setClosingTime] = useState<string>(
    route?.params?.clinic_closing_hour ??
    route?.params?.closing_hour      ??
    route?.params?.closingTime       ??
    route?.params?.closingHour       ??
    '17:00'
  );
  const routeIntervalParam = 
    route?.params?.clinic_time_slots ??
    route?.params?.time_slot        ??
    route?.params?.timeSlot;
  const initialInterval = typeof routeIntervalParam === 'number'
    ? routeIntervalParam
    : parseInt(routeIntervalParam, 10) || 30;
  const [interval, setInterval] = useState<number>(initialInterval);

  // --- Other state vars ---
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
  const [reservedSlots, setReservedSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // --- Utility: Generate next N days ---
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

  // --- Utility: Generate time slots (supports both "HH:MM" & "HH.MM") ---
  const generateTimeSlots = (open: string, close: string, intervalMinutes: number): string[] => {
    try {
      if (!open || !close) return [];
      const normalizeTime = (timeStr: string) => {
        const normalized = timeStr.replace('.', ':');
        let [h, m] = normalized.split(':');
        if (!m) m = '0';
        const hour = parseInt(h, 10), minute = parseInt(m, 10);
        return isNaN(hour) || isNaN(minute) ? { hour: 0, minute: 0 } : { hour, minute };
      };
      const { hour: openHour, minute: openMinute } = normalizeTime(open);
      const { hour: closeHour, minute: closeMinute } = normalizeTime(close);

      let currH = openHour, currM = openMinute;
      const slots: string[] = [];
      while (
        currH < closeHour ||
        (currH === closeHour && currM < closeMinute)
      ) {
        const startH = String(currH).padStart(2, '0');
        const startM = String(currM).padStart(2, '0');
        let nextM = currM + intervalMinutes;
        let nextH = currH;
        if (nextM >= 60) {
          nextH += 1;
          nextM -= 60;
        }
        if (
          nextH > closeHour ||
          (nextH === closeHour && nextM > closeMinute)
        ) break;
        const endH = String(nextH).padStart(2, '0');
        const endM = String(nextM).padStart(2, '0');
        slots.push(`${startH}.${startM} - ${endH}.${endM}`);
        currH = nextH;
        currM = nextM;
      }
      return slots;
    } catch {
      return [];
    }
  };

  // --- Utility: Split array into two columns ---
  const splitIntoTwoColumns = (arr: string[]) => {
    const mid = Math.ceil(arr.length / 2);
    return { left: arr.slice(0, mid), right: arr.slice(mid) };
  };

  // --- Utility: Calculate pet age ---
  const calculateAge = (birth_date: Date | null): string => {
    if (!birth_date) return 'Unknown';
    const birth = new Date(birth_date);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (now.getDate() < birth.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    const y = years > 0 ? `${years} ${years === 1 ? 'year' : 'years'}` : '';
    const m = months > 0 ? `${months} ${months === 1 ? 'month' : 'months'}` : '';
    return y && m ? `${y} ${m}` : y || m || 'Less than a month';
  };

  // --- Utility: Persist first pet ---
  const selectFirstPet = async (id: number, name: string) => {
    try {
      await AsyncStorage.setItem('selectedPetId', id.toString());
      await AsyncStorage.setItem('selectedPetName', name);
      const pet = pets.find(p => p.id === id) || null;
      setSelectedPet(pet);
    } catch (e) {
      console.error(e);
    }
  };

  // --- Fetch clinic details including opening and closing hours ---
  const fetchClinicDetails = async () => {
    if (!clinic_id) {
      console.log('No clinic_id provided, using default hours');
      return;
    }
    
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      
      console.log(`Fetching details for clinic ${clinic_id}...`);
      
      // Direct fetch from the API
      const response = await fetch(
        `https://petlyst.com:3001/api/fetch-clinic?clinic_id=${clinic_id}`,
        { 
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch clinic details: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Clinic details response:', data);
      
      // Extract the opening and closing hours, with fallbacks
      const clinic = data.clinic;
      if (clinic) {
        // Try all possible field names
        const newOpeningTime = clinic.clinic_opening_hour || clinic.opening_hour || clinic.opening_time;
        const newClosingTime = clinic.clinic_closing_hour || clinic.closing_hour || clinic.closing_time;
        const newTimeSlot = clinic.clinic_time_slots || clinic.time_slot || clinic.timeSlot;
        
        console.log('Clinic hours from API:', { newOpeningTime, newClosingTime, newTimeSlot });
        
        // Update state with actual clinic hours if available
        if (newOpeningTime && newClosingTime) {
          console.log(`Setting clinic hours: ${newOpeningTime} - ${newClosingTime}`);
          setOpeningTime(newOpeningTime);
          setClosingTime(newClosingTime);
          
          if (newTimeSlot && typeof newTimeSlot === 'number') {
            setInterval(newTimeSlot);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching clinic details:', error);
    }
  };

  // --- Fetch pets (unchanged, minus the clinic‐hours bit) ---
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
      if (!response.ok) throw new Error('Network response was not ok');
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

      const stored = await AsyncStorage.getItem('selectedPetId');
      if (stored && formattedPets.length) {
        const petId = parseInt(stored, 10);
        const p = formattedPets.find(p => p.id === petId);
        if (p) setSelectedPet(p);
        else await selectFirstPet(formattedPets[0].id, formattedPets[0].name);
      } else if (formattedPets.length) {
        await selectFirstPet(formattedPets[0].id, formattedPets[0].name);
      }
    } catch (error) {
      console.error(error);
      setPetsError(error instanceof Error ? error.message : 'Failed to fetch pets');
      Alert.alert('Error', 'Something went wrong fetching pets.');
    } finally {
      setIsLoadingPets(false);
    }
  };

  // --- Fetch reserved slots (unchanged) ---
  const fetchReservedSlots = async (selectedDate: Date) => {
    if (!clinic_id) return;
    setIsLoadingSlots(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${d}`;
      const response = await fetch(
        `https://petlyst.com:3001/api/fetch-clinic-appointments?clinic_id=${clinic_id}&date=${dateString}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch reserved slots');
      const data = await response.json();
      const reserved: string[] = [];
      (data.appointments || []).forEach((appt: any) => {
        const tryParse = (str: string) => {
          let hh = '00', mm = '00';
          if (str.includes('T')) {
            const tp = str.split('T')[1]?.split(':') || [];
            hh = tp[0] || hh; mm = tp[1] || mm;
          } else if (str.includes(' ')) {
            const tp = str.split(' ')[1]?.split(':') || [];
            hh = tp[0] || hh; mm = tp[1] || mm;
          } else if (str.includes(':')) {
            const tp = str.split(':');
            hh = tp[0] || hh; mm = tp[1] || mm;
          }
          return { hh: hh.padStart(2, '0'), mm: mm.padStart(2, '0') };
        };
        if (appt.appointment_start_hour && appt.appointment_end_hour) {
          const s = tryParse(String(appt.appointment_start_hour));
          const e = tryParse(String(appt.appointment_end_hour));
          reserved.push(`${s.hh}.${s.mm} - ${e.hh}.${e.mm}`);
        }
      });
      setReservedSlots(reserved);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Initialize component with fetched clinic data
  useEffect(() => {
    const nextDays = generateNextDays(15);
    setDays(nextDays);
    
    if (nextDays.length > 0) {
      setSelectedDayId(nextDays[0].id);
      fetchReservedSlots(nextDays[0].dateObj);
    }
    
    // Fetch pets and clinic details on mount
    fetchPets();
    fetchClinicDetails();
  }, []);

  // Regenerate slots whenever hours or interval changes
  useEffect(() => {
    console.log(`Generating time slots: ${openingTime} - ${closingTime} (${interval}min)`);
    const slots = generateTimeSlots(openingTime, closingTime, interval);
    setAllSlots(slots);
    const { left, right } = splitIntoTwoColumns(slots);
    setLeftSlots(left);
    setRightSlots(right);
  }, [openingTime, closingTime, interval]);

  // --- Refresh pets on screen focus (unchanged) ---
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPets);
    return unsubscribe;
  }, [navigation]);

  // --- Handlers & render functions (unchanged) ---
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
    const sel = days.find(d => d.id === dayId);
    if (sel) fetchReservedSlots(sel.dateObj);
  };
  const handleTimePress = (time: string) => setSelectedTime(time);

  const parseTimeSlot = (timeSlotString: string | null) => {
    if (!timeSlotString) return { start: null, end: null };
    try {
      const [startStr, endStr] = timeSlotString.split(' - ');
      const [sh, sm] = startStr.split('.').map(Number);
      const [eh, em] = endStr.split('.').map(Number);
      const sel = days.find(d => d.id === selectedDayId);
      if (!sel) return { start: null, end: null };
      const s = new Date(sel.dateObj); s.setHours(sh, sm, 0);
      const e = new Date(sel.dateObj); e.setHours(eh, em, 0);
      return { start: s, end: e };
    } catch {
      return { start: null, end: null };
    }
  };

  const isTimeSlotInPast = (time: string) => {
    try {
      const [sh, sm] = time.split(' - ')[0].split('.').map(Number);
      const sel = days.find(d => d.id === selectedDayId);
      if (!sel) return false;
      const slot = new Date(sel.dateObj); slot.setHours(sh, sm, 0);
      return slot < new Date();
    } catch {
      return false;
    }
  };

  const getFormattedAppointmentDetails = () => {
    if (!selectedPet || !selectedDayId || !selectedTime) return null;
    const sel = days.find(d => d.id === selectedDayId);
    if (!sel) return null;
    return {
      petName: selectedPet.name,
      petBreed: selectedPet.breed,
      date: sel.dateObj.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      time: selectedTime,
    };
  };

  const handleCompleteAppointment = () => {
    if (!selectedPet) {
      Alert.alert('Missing Information', 'Please select a pet.');
      return;
    }
    if (!selectedDayId) {
      Alert.alert('Missing Information', 'Please select a day.');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Missing Information', 'Please select a time.');
      return;
    }
    setShowConfirmModal(true);
  };

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
      const { start, end } = parseTimeSlot(selectedTime!);
      if (!start || !end) {
        Alert.alert('Error', 'Invalid time.');
        setIsSubmitting(false);
        return;
      }
      const pad = (n: number) => String(n).padStart(2, '0');
      const appointmentDate = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
      const formatDT = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const appointmentData = {
        pet_id: petId,
        video_meeting: isVideoMeeting,
        appointment_start_hour: formatDT(start),
        appointment_end_hour: formatDT(end),
        notes: notes.trim(),
        appointment_date: appointmentDate,
        clinic_id,
        appointment_status: 'pending'
      };
      const res = await fetch('https://petlyst.com:3001/api/create-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appointmentData),
      });
      const text = await res.text();
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(json.message || 'Failed to create appointment');
      setShowConfirmModal(false);
      setNotes('');
      setIsVideoMeeting(false);
      Alert.alert(
        'Appointment Created',
        `Your appointment has been successfully scheduled.${isVideoMeeting ? '\n\nA video link will be sent.' : ''}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create appointment', [
        { text: 'Try Again', style: 'cancel' },
        { text: 'Cancel', onPress: () => setShowConfirmModal(false) },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDayItem = ({ item }: { item: DayItem }) => {
    const sel = item.id === selectedDayId;
    return (
      <TouchableOpacity
        style={[styles.dayItem, sel && styles.dayItemSelected]}
        onPress={() => handleDayPress(item.id)}
      >
        <Text style={[styles.dayName, sel && styles.dayNameSelected]}>
          {item.dayName}
        </Text>
        <Text style={[styles.dateNum, sel && styles.dateNumSelected]}>
          {item.dateNum}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTimeButton = (time: string, col: 'left'|'right') => {
    const sel = time === selectedTime;
    const resv = reservedSlots.includes(time);
    const past = isTimeSlotInPast(time);
    return (
      <TouchableOpacity
        key={`${col}-${time}`}
        style={[
          styles.timeSlot,
          sel && styles.timeSlotSelected,
          resv && styles.timeSlotReserved,
          past && styles.timeSlotPast
        ]}
        onPress={() => !resv && !past && handleTimePress(time)}
        disabled={resv || past}
      >
        <Text
          style={[
            styles.timeText,
            sel && styles.timeTextSelected,
            resv && styles.timeTextReserved,
            past && styles.timeTextPast
          ]}
        >
          {time}
        </Text>
        {resv && <Text style={styles.reservedText}>Reserved</Text>}
        {past && <Text style={styles.pastText}>Past</Text>}
      </TouchableOpacity>
    );
  };

  // --- Render UI (unchanged) ---
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
            To proceed with booking an appointment, you need to add a pet first.
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
            {/* Pet */}
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

            {/* Date */}
            <Text style={styles.sectionTitle}>Which Date?</Text>
            <FlatList
              data={days}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id}
              renderItem={renderDayItem}
              contentContainerStyle={styles.daysList}
            />

            {/* Time slots */}
            <View style={styles.timeSlotsContainer}>
              <View style={styles.timeColumn}>
                {leftSlots.map(t => renderTimeButton(t, 'left'))}
              </View>
              <View style={styles.timeColumn}>
                {rightSlots.map(t => renderTimeButton(t, 'right'))}
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

      {/* Pet Modal */}
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
            ) : pets.length ? (
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

      {/* Confirmation Modal */}
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
                    {getFormattedAppointmentDetails()!.petName} ({getFormattedAppointmentDetails()!.petBreed})
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date:</Text>
                  <Text style={styles.summaryValue}>{getFormattedAppointmentDetails()!.date}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Time:</Text>
                  <Text style={styles.summaryValue}>{getFormattedAppointmentDetails()!.time}</Text>
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
                A secure meeting link will be sent before your appointment.
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
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
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
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 30,
  },
  emptyText: {
    fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8,
  },
  emptySubText: {
    fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20,
  },
  addButton: {
    borderRadius: 12, overflow: 'hidden', shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3,
    shadowRadius: 5, elevation: 5, marginTop: 20,
  },
  addButtonGradient: { paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 12, color: '#333' },
  petCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 16, borderRadius: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  petImage: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#f0f0ff' },
  petInfo: { flex: 1 },
  petName: { fontSize: 16, fontWeight: '600', color: '#333' },
  petDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  daysList: { paddingVertical: 8 },
  dayItem: {
    width: 50, height: 60, borderRadius: 12, backgroundColor: '#f0f0ff',
    marginRight: 8, justifyContent: 'center', alignItems: 'center',
  },
  dayItemSelected: { backgroundColor: '#6c63ff' },
  dayName: { fontSize: 13, color: '#888', marginBottom: 2 },
  dateNum: { fontSize: 16, fontWeight: '600', color: '#333' },
  dayNameSelected: { color: '#FFF' },
  dateNumSelected: { color: '#FFF' },
  timeSlotsContainer: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  timeColumn: {
    width: '48%', borderWidth: 1, borderColor: '#e0e0ff',
    borderRadius: 12, borderStyle: 'dashed', padding: 8,
  },
  timeSlot: {
    backgroundColor: '#f0f0ff', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, marginBottom: 8,
  },
  timeSlotSelected: { backgroundColor: '#6c63ff' },
  timeSlotReserved: {
    backgroundColor: '#f0f0f0', borderColor: '#e0e0e0',
    borderWidth: 1, opacity: 0.7,
  },
  timeSlotPast: {
    backgroundColor: '#f0f0f0', borderColor: '#e0e0e0',
    borderWidth: 1, opacity: 0.5,
  },
  timeText: { fontSize: 14, color: '#333' },
  timeTextSelected: { color: '#FFF', fontWeight: '600' },
  timeTextReserved: { color: '#aaa' },
  timeTextPast: { color: '#999' },
  reservedText: { fontSize: 10, color: '#999', fontStyle: 'italic', marginTop: 2 },
  pastText: { fontSize: 10, color: '#999', fontStyle: 'italic', marginTop: 2 },
  completeButton: {
    marginTop: 24, borderRadius: 12, overflow: 'hidden',
    shadowColor: '#6c63ff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  completeButtonGradient: { paddingVertical: 15, alignItems: 'center' },
  completeButtonDisabled: { opacity: 0.7 },
  completeButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  modalContainer: {
    width: '85%', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#333', textAlign: 'center' },
  petOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  petOptionImage: { width: 44, height: 44, borderRadius: 22 },
  petOptionInfo: { marginLeft: 10 },
  petOptionName: { fontSize: 16, fontWeight: '600', color: '#333' },
  petOptionDesc: { fontSize: 14, color: '#666' },
  modalCloseButton: {
    marginTop: 16, alignSelf: 'center', backgroundColor: '#EEE',
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
  },
  modalCloseText: { fontSize: 14, color: '#333' },
  confirmModalContainer: {
    width: '90%', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, maxHeight: '90%',
  },
  appointmentSummary: {
    backgroundColor: '#F6F9FD', borderRadius: 8, padding: 12, marginVertical: 16,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', marginBottom: 6 },
  summaryLabel: {
    fontSize: 14, fontWeight: '500', color: '#666', width: 60,
  },
  summaryValue: { fontSize: 14, color: '#333', flex: 1 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  optionLabel: { fontSize: 16, color: '#333' },
  videoMeetingNote: {
    fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 16,
  },
  notesLabel: {
    fontSize: 16, fontWeight: '500', color: '#333', marginTop: 16, marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1, borderColor: '#DDE7F0', borderRadius: 8, padding: 12,
    fontSize: 14, color: '#333', backgroundColor: '#F6F9FD', height: 100, textAlignVertical: 'top',
  },
  actionButtonsRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 24,
  },
  cancelButton: {
    backgroundColor: '#EEE', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, color: '#333' },
  confirmButton: {
    backgroundColor: '#007bff', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center',
  },
  confirmButtonText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
});
