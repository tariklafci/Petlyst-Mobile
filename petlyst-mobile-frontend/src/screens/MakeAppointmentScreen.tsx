import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
//import { generateTimeSlots } from '../utils/timeSlotUtils';

interface Clinic {
  id: number;  // Clinic ID
  name: string;  // Clinic Name
  openingTime: string; // Time format as string (e.g., "08:00:00")
  closingTime: string; // Time format as string (e.g., "20:00:00")
  allowOnlineMeetings: boolean; // Whether online meetings are allowed
  availableDays: boolean[]; // Boolean array for available days [7]
  emergencyAvailableDays: boolean[]; // Boolean array for emergency available days [7]
  clinicTimeSlots: number; // Number of time slots available
}



const MakeAppointmentScreen = ({ route, navigation }: { route: any; navigation: any })  => {
  const { clinic_id } = route.params;

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [videoMeeting, setVideoMeeting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

//   useEffect(() => {
//     // Generate time slots from clinic data
//     const slots = generateTimeSlots(
//       clinic.start_hour,
//       clinic.end_hour,
//       clinic.time_block_minutes
//     );
//     setTimeSlots(slots);
//   }, [clinic]);

useEffect(() => {
    fetchClinicDetails(clinic_id);
  }, []);

  const handleTimeSlotPress = (slot: string) => {
    setSelectedTimeSlot(slot);
  };

  const handleToggleVideo = () => {
    setVideoMeeting((prev) => !prev);
  };

  const fetchClinicDetails = async (clinicId: number) => {
    setLoading(true);
    try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) {
            Alert.alert('Error', 'No token found. Please log in again.');
            return;
        }

        const response = await fetch(`https://petlyst.com:3001/api/fetch-clinic-info-appointments?clinic_id=${clinicId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const clinic = await response.json();

        // Format the clinic data
        const formattedClinic: Clinic = {
            id: clinic.clinic_id,
            name: clinic.clinic_name,
            openingTime: clinic.opening_time, // "HH:MM:SS" format
            closingTime: clinic.closing_time, // "HH:MM:SS" format
            allowOnlineMeetings: clinic.allow_online_meetings,
            availableDays: clinic.available_days, // Boolean array [7]
            emergencyAvailableDays: clinic.emergency_available_days, // Boolean array [7]
            clinicTimeSlots: clinic.clinic_time_slots, // Integer
        };

        setClinics([formattedClinic]); 

    } catch (error) {
        console.error('Error fetching clinic details:', error);
        Alert.alert('Error', 'Something went wrong fetching clinic details.');
    } finally {
        setLoading(false);
    }
};


  const handleConfirmAppointment = async () => {
    try {
      // Retrieve pet_id from AsyncStorage
      const petId = await AsyncStorage.getItem('selectedPetId');
      // You might parse JSON if you stored as JSON
      // e.g. const petId = JSON.parse(await AsyncStorage.getItem('selectedPetId'));

      if (!petId) {
        alert('No pet selected');
        return;
      }

      if (!selectedTimeSlot) {
        alert('Please select a time slot');
        return;
      }

      // Convert selectedTimeSlot label to a real DateTime
      // Example: "8:00 AM - 8:30 AM" → pick the start part "8:00 AM"
      const [startLabel] = selectedTimeSlot.split(' - ');
      // Convert that to a Date object for the chosen day. 
      // (If you allow choosing a future date, you might also store the date from a DatePicker.)

      // For simplicity, let's assume the date is "today"
      const appointmentDate = convertToDateTime(startLabel); 
      // implement convertToDateTime() yourself or parse with moment/Date-fns

      // Make a request to your backend to create an appointment
      const response = await fetch('https://petlyst.com:3001/api/set-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pet_id: Number(petId),
          clinic_id: clinic.clinic_id,
          appointment_date: appointmentDate, // or a properly formatted string
          video_meeting: videoMeeting,
          appointment_status: 'pending',
          // meeting_url will be generated on the server if video_meeting = true
          notes: 'Some note from user input', 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create appointment');
      }

      alert('Appointment created! Status is pending.');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      alert('Error creating appointment.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Make Appointment at</Text>

      <Text style={{ marginTop: 16 }}>Available Time Slots:</Text>
      <FlatList
        data={timeSlots}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const isSelected = item === selectedTimeSlot;
          return (
            <TouchableOpacity
              onPress={() => handleTimeSlotPress(item)}
              style={{
                backgroundColor: isSelected ? 'lightblue' : 'white',
                padding: 8,
                marginVertical: 4,
              }}
            >
              <Text>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        onPress={handleToggleVideo}
        style={{
          marginTop: 16,
          padding: 8,
          backgroundColor: videoMeeting ? 'lightgreen' : 'white',
        }}
      >
        <Text>{videoMeeting ? 'Video Meeting: ON' : 'Video Meeting: OFF'}</Text>
      </TouchableOpacity>

      <Button
        title="Confirm Appointment"
        onPress={handleConfirmAppointment}
      />
    </View>
  );
};

export default MakeAppointmentScreen;
