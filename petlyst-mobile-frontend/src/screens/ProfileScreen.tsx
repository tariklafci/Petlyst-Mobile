import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

interface Pet {
  name: string;
  species: string;
  breed: string;
  photo: string | null;
}

interface Clinic {
  name: string;
  address: string;
  photo: string | null;
}

interface Appointment {
  id: number;
  date: string;
  rawDate: string;
  startTime: string;
  endTime: string;
  status: string;
  isVideoMeeting: boolean;
  notes: string;
  pet: Pet;
  clinic: Clinic;
}

const ProfileScreen = ({ navigation }: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0); // Default selection (Pending)
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = ['pending', 'active', 'completed'];
  const displayOptions = ['Pending', 'Active', 'Completed'];

  // Function to fetch appointments
  const fetchAppointments = async (status = statusOptions[selectedIndex]) => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        return;
      }
      
      const response = await fetch(`https://petlyst.com:3001/api/fetch-appointments?status=${status}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch appointments');
      }
      
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAppointments();
  };

  // Handle tab change
  const handleTabChange = (index: number) => {
    setSelectedIndex(index);
    setIsLoading(true);
    fetchAppointments(statusOptions[index]);
  };

  // Fetch appointments on initial load and when the screen is focused
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchAppointments(statusOptions[selectedIndex]);
      return () => {
        // Clean up if needed
      };
    }, [selectedIndex])
  );

  // Render each appointment card
  const renderAppointmentCard = ({ item }: { item: Appointment }) => (
    <TouchableOpacity 
      style={styles.appointmentCard}
      onPress={() => {
        // Navigate to appointment details screen if you have one
        // navigation.navigate('AppointmentDetails', { appointmentId: item.id });
      }}
    >
      <View style={styles.cardHeader}>
        <Image 
          source={item.clinic.photo ? { uri: item.clinic.photo } : require('../../assets/splash-icon.png')} 
          style={styles.clinicImage} 
        />
        <View style={styles.headerInfo}>
          <Text style={styles.clinicName}>{item.clinic.name}</Text>
          <Text style={styles.appointmentDate}>{item.date} • {item.startTime} - {item.endTime}</Text>
        </View>
        {item.isVideoMeeting && (
          <View style={styles.videoContainer}>
            <Ionicons name="videocam" size={20} color="#007bff" />
          </View>
        )}
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.petSection}>
        <View style={styles.petInfo}>
          <Image 
            source={item.pet.photo ? { uri: item.pet.photo } : require('../../assets/splash-icon.png')} 
            style={styles.petImage} 
          />
          <View>
            <Text style={styles.petName}>{item.pet.name}</Text>
            <Text style={styles.petBreed}>{item.pet.species} • {item.pet.breed}</Text>
          </View>
        </View>
        
        <View style={styles.statusContainer}>
          <Text 
            style={[
              styles.statusText, 
              item.status === 'pending' && styles.pendingText,
              item.status === 'active' && styles.activeText,
              item.status === 'completed' && styles.completedText,
            ]}
          >
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      {item.notes && (
        <>
          <View style={styles.divider} />
          <Text style={styles.notesTitle}>Notes:</Text>
          <Text style={styles.notesText}>{item.notes}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>No {displayOptions[selectedIndex]} Appointments</Text>
        <Text style={styles.emptyText}>
          {selectedIndex === 0 
            ? "You don't have any pending appointments. Book an appointment to get started!"
            : selectedIndex === 1 
              ? "You don't have any active appointments at the moment."
              : "You don't have any completed appointments yet."}
        </Text>
        {selectedIndex === 0 && (
          <TouchableOpacity 
            style={styles.bookButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.bookButtonText}>Book an Appointment</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <Text style={styles.appointmentsText}>My Appointments</Text>
      
      {/* Status tabs */}
      <View style={styles.segmentContainer}>
        {displayOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.segment,
              selectedIndex === index && styles.selectedSegment,
            ]}
            onPress={() => handleTabChange(index)}
          >
            <Text
              style={[
                styles.text,
                selectedIndex === index && styles.selectedText,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Appointment list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={appointments}
          renderItem={renderAppointmentCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#007bff']}
              tintColor="#007bff"
            />
          }
        />
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 20,
  },
  appointmentsText: {
    alignSelf: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f7fb',
    borderRadius: 25,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: width * 0.9,
    alignSelf: 'center',
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 25,
    marginHorizontal: 2,
  },
  selectedSegment: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  selectedText: {
    color: '#000',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clinicImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  appointmentDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  videoContainer: {
    backgroundColor: '#e6f2ff',
    borderRadius: 20,
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  petSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  petName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  petBreed: {
    fontSize: 13,
    color: '#777',
  },
  statusContainer: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pendingText: {
    color: '#f39c12',
  },
  activeText: {
    color: '#27ae60',
  },
  completedText: {
    color: '#3498db',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    marginBottom: 20,
  },
  bookButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;