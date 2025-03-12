// MakeAppointmentScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Utility function to generate time slots in "HH:MM - HH:MM" format
 * e.g. ("08:00 - 08:30", "08:30 - 09:00", etc.)
 */
const generateTimeSlots = (
  openingTime: string,
  closingTime: string,
  interval: number
): string[] => {
  const slots: string[] = [];
  let [openHour, openMinute] = openingTime.split(':').map(Number);
  let [closeHour, closeMinute] = closingTime.split(':').map(Number);

  let currentHour = openHour;
  let currentMinute = openMinute;

  while (
    currentHour < closeHour ||
    (currentHour === closeHour && currentMinute < closeMinute)
  ) {
    let nextMinute = currentMinute + interval;
    let nextHour = currentHour;

    if (nextMinute >= 60) {
      nextHour += 1;
      nextMinute -= 60;
    }

    // If next block goes past closing, break
    if (
      nextHour > closeHour ||
      (nextHour === closeHour && nextMinute > closeMinute)
    ) {
      break;
    }

    const startTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute
      .toString()
      .padStart(2, '0')}`;
    const endTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute
      .toString()
      .padStart(2, '0')}`;

    slots.push(`${startTime} - ${endTime}`);

    currentHour = nextHour;
    currentMinute = nextMinute;
  }

  return slots;
};

interface Clinic {
  id: number;
  name: string;
  openingTime: string;        // e.g. "08:00"
  closingTime: string;        // e.g. "20:00"
  allowOnlineMeetings: boolean;
  availableDays: boolean[];   // e.g. [false, true, true, true, true, true, false] => Sunday-Saturday
  emergencyAvailableDays: boolean[];
  clinicTimeSlots: number;    // e.g. 30 (minutes)
}

const MakeAppointmentScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { clinic_id } = route.params;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // For day/time selection
  const [daysArray, setDaysArray] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // For time slot selection
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Toggle for video meeting
  const [videoMeeting, setVideoMeeting] = useState<boolean>(false);

  useEffect(() => {
    fetchClinicDetails(clinic_id);
  }, []);

  /**
   * Fetch clinic details from your backend
   */
  const fetchClinicDetails = async (clinicId: number) => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://petlyst.com:3001/api/fetch-clinic-info-appointments?clinic_id=${clinicId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const clinicData = await response.json();

      const formattedClinic: Clinic = {
        id: clinicData.clinic_id,
        name: clinicData.clinic_name,
        openingTime: clinicData.opening_time,       // e.g. "08:00"
        closingTime: clinicData.closing_time,       // e.g. "20:00"
        allowOnlineMeetings: clinicData.allow_online_meetings,
        availableDays: clinicData.available_days,   // boolean array [Sun..Sat]
        emergencyAvailableDays: clinicData.emergency_available_days,
        clinicTimeSlots: clinicData.clinic_time_slots, // e.g. 30
      };

      setClinic(formattedClinic);

      // Generate an array of upcoming days (e.g. next 14 days)
      const upcomingDays: Date[] = [];
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        upcomingDays.push(date);
      }
      setDaysArray(upcomingDays);

      // Generate the time slots (same for every day, but you might change that if needed)
      const slots = generateTimeSlots(
        formattedClinic.openingTime,
        formattedClinic.closingTime,
        formattedClinic.clinicTimeSlots
      );
      setTimeSlots(slots);
    } catch (error) {
      console.error('Error fetching clinic details:', error);
      Alert.alert('Error', 'Something went wrong fetching clinic details.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user selecting a day from the horizontal list
   */
  const handleSelectDate = (day: Date, isAvailable: boolean) => {
    if (!isAvailable) {
      Alert.alert('Not Available', 'Clinic is closed on this day.');
      return;
    }
    setSelectedDate(day);
    setSelectedTimeSlot(null); // reset time slot when day changes
    setVideoMeeting(false);    // also reset the video toggle
  };

  /**
   * Handle user tapping on a specific time slot
   */
  const handleTimeSlotPress = (slot: string) => {
    setSelectedTimeSlot(slot);
    // If you want to show the video toggle immediately after selection, that's fine
    // Otherwise you can keep it always visible if `allowOnlineMeetings` is true
  };

  /**
   * Toggle video meeting
   */
  const handleToggleVideo = () => {
    setVideoMeeting((prev) => !prev);
  };

  /**
   * Confirm appointment: send data to your backend
   */
  const handleConfirmAppointment = async () => {
    try {
      // Make sure we have a pet selected
      const petId = await AsyncStorage.getItem('selectedPetId');
      if (!petId) {
        Alert.alert('Error', 'No pet selected. Please select a pet first.');
        return;
      }

      // Must have selected a date and time slot
      if (!selectedDate || !selectedTimeSlot || !clinic) {
        Alert.alert('Error', 'Please select a day and time slot.');
        return;
      }

      // Convert the selected time slot (e.g. "08:00 - 08:30") into a Date object
      const [startLabel] = selectedTimeSlot.split(' - ');
      const [hours, minutes] = startLabel.split(':').map(Number);

      // Create a new date/time for the selected day
      const appointmentDate = new Date(selectedDate);
      appointmentDate.setHours(hours, minutes, 0, 0);

      // Example: POST to your API
      const response = await fetch('https://petlyst.com:3001/api/set-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: Number(petId),
          clinic_id: clinic.id,
          appointment_date: appointmentDate.toISOString(),
          video_meeting: videoMeeting, // only relevant if clinic.allowOnlineMeetings is true
          appointment_status: 'pending',
          notes: 'Some note from user input', // Or collect from a TextInput
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create appointment');
      }

      Alert.alert('Success', 'Appointment created! Status is pending.');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Error creating appointment.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" />
      ) : !clinic ? (
        <Text style={styles.errorText}>Error loading clinic details.</Text>
      ) : (
        <>
          <Text style={styles.headerText}>Make Appointment at {clinic.name}</Text>

          {/* Horizontal list of upcoming days */}
          <Text style={styles.sectionTitle}>Select Day:</Text>
          <FlatList
            data={daysArray}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.toDateString()}
            style={{ marginBottom: 20 }}
            renderItem={({ item }) => {
              const dayOfWeek = item.getDay(); // 0=Sun,1=Mon,...6=Sat
              const isAvailable = clinic.availableDays[dayOfWeek];
              const isSelected =
                selectedDate && item.toDateString() === selectedDate.toDateString();

              return (
                <TouchableOpacity
                  disabled={!isAvailable}
                  onPress={() => handleSelectDate(item, isAvailable)}
                  style={[
                    styles.dayItem,
                    isAvailable ? styles.dayAvailable : styles.dayNotAvailable,
                    isSelected && styles.daySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isAvailable && { color: '#999' },
                      isSelected && { color: '#FFF' },
                    ]}
                  >
                    {item.toDateString().slice(0, 3)}
                  </Text>
                  <Text
                    style={[
                      styles.dayText,
                      !isAvailable && { color: '#999' },
                      isSelected && { color: '#FFF' },
                    ]}
                  >
                    {item.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Time Slots */}
          <Text style={styles.sectionTitle}>Available Time Slots:</Text>
          <FlatList
            data={timeSlots}
            keyExtractor={(item) => item}
            style={{ marginBottom: 30 }}
            renderItem={({ item }) => {
              const isSelected = item === selectedTimeSlot;
              return (
                <TouchableOpacity
                  onPress={() => handleTimeSlotPress(item)}
                  style={[styles.slotItem, isSelected && styles.slotSelected]}
                >
                  <Text
                    style={[
                      styles.slotText,
                      isSelected && { color: '#FFF', fontWeight: '600' },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Video meeting toggle (only if clinic allows and a slot is selected) */}
          {clinic.allowOnlineMeetings && selectedTimeSlot && (
            <TouchableOpacity
              onPress={handleToggleVideo}
              style={[
                styles.videoToggle,
                { backgroundColor: videoMeeting ? '#4CAF50' : '#FFF' },
              ]}
            >
              <Text style={{ color: videoMeeting ? '#FFF' : '#333' }}>
                {videoMeeting ? 'Video Meeting: ON' : 'Video Meeting: OFF'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Confirm Button */}
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmAppointment}>
            <Text style={styles.confirmButtonText}>Confirm Appointment</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

export default MakeAppointmentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    padding: 16,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    margin: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  dayItem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayAvailable: {
    backgroundColor: '#FFF',
    borderColor: '#007BFF',
    borderWidth: 1,
  },
  dayNotAvailable: {
    backgroundColor: '#EEE',
    borderColor: '#CCC',
    borderWidth: 1,
  },
  daySelected: {
    backgroundColor: '#007BFF',
  },
  dayText: {
    color: '#333',
    fontSize: 14,
  },
  slotItem: {
    backgroundColor: '#FFF',
    padding: 10,
    marginVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  slotSelected: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  slotText: {
    color: '#333',
    fontSize: 14,
  },
  videoToggle: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCC',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#28A745',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
