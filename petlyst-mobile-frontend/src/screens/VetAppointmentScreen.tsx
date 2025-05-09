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
  Platform,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

interface Pet {
  name: string;
  species: string;
  breed: string;
  photo: string | null;
}

interface Clinic {
  id: number;
  name: string;
  address: string;
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

const VetAppointmentScreen = ({ navigation }: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0); // Default selection (Pending)
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<number | null>(null);

  const statusOptions = ['pending', 'confirmed', 'completed'];
  const displayOptions = ['Pending', 'Active', 'Completed'];

  // Function to fetch clinic ID
  const fetchClinicId = async () => {
    try {
      setError(null);
  
      const token = await SecureStore.getItemAsync('userToken');
      const userId = await SecureStore.getItemAsync('userId');
            
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setIsLoading(false);
        return null;
      }
      
      if (!userId) {
        setError('User ID not found. Please login again.');
        setIsLoading(false);
        return null;
      }
  
      const response = await fetch(`https://petlyst.com:3001/api/fetch-clinic-veterinarian?veterinarian_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to fetch clinic ID');
      }
      
      const data = await response.json();
  
      if (!data.clinic_id) {
        setError('Clinic ID not found in response.');
        setIsLoading(false);
        return null;
      }
  
      setClinicId(data.clinic_id);
  
      return data.clinic_id;
  
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error fetching clinic ID:', error.message);
        setError(error.message);
      } else {
        console.error('Unexpected error:', error);
        setError('An unexpected error occurred.');
      }
      setIsLoading(false);
      return null;
    }
  };

  const fetchAppointments = async (status = statusOptions[selectedIndex]) => {
    try {
      if (!clinicId) {
        return;
      }
      
      setError(null);
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setIsLoading(false);
        return;
      }
      
      // Fix endpoint to match backend route (clinics instead of clinic)
      const response = await fetch(`https://petlyst.com:3001/api/fetch-appointments-clinics?clinicId=${clinicId}${status ? `&status=${status}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to fetch appointments');
      }
      
      const data = await response.json();
      setAppointments(data.appointments || []);
      
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initialize clinic ID and appointments
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      const clinicId = await fetchClinicId();
      if (clinicId) {
        fetchAppointments(statusOptions[selectedIndex]);
      }
    };
    
    initialize();
  }, []);

  // Handle refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    const clinicId = await fetchClinicId();
    if (clinicId) {
      fetchAppointments(statusOptions[selectedIndex]);
    } else {
      setIsRefreshing(false);
    }
  };

  // Handle tab change
  const handleTabChange = (index: number) => {
    setSelectedIndex(index);
    setIsLoading(true);
    fetchAppointments(statusOptions[index]);
  };

  // Fetch appointments when the screen is focused if we have a clinicId
  useFocusEffect(
    useCallback(() => {
      if (clinicId) {
        setIsLoading(true);
        fetchAppointments(statusOptions[selectedIndex]);
      }
    }, [selectedIndex, clinicId])
  );

  // Add updateAppointmentStatus function after fetchAppointments
  const updateAppointmentStatus = async (appointmentId: number, newStatus: string) => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setIsLoading(false);
        return false;
      }
      
      const response = await fetch(`https://petlyst.com:3001/api/update-appointment-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appointment_id: appointmentId,
          appointment_status: newStatus
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to update appointment status to ${newStatus}`);
      }
      
      // Refresh the appointments list
      fetchAppointments(statusOptions[selectedIndex]);
      return true;
    } catch (err) {
      console.error('Error updating appointment status:', err);
      Alert.alert('Error', 'Failed to update appointment status. Please try again.');
      setIsLoading(false);
      return false;
    }
  };

  // Add showConfirmationDialog function
  const showConfirmationDialog = (appointmentId: number, currentStatus: string, newStatus: string) => {
    let title = '';
    let message = '';
    
    if (currentStatus === 'pending' && newStatus === 'confirmed') {
      title = 'Accept Appointment';
      message = 'Are you sure you want to accept this appointment?';
    } else if (currentStatus === 'confirmed' && newStatus === 'completed') {
      title = 'Complete Appointment';
      message = 'Are you sure you want to mark this appointment as completed?';
    } else if (newStatus === 'canceled') {
      title = 'Cancel Appointment';
      message = 'Are you sure you want to cancel this appointment?';
    }
    
    Alert.alert(
      title,
      message,
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Yes',
          onPress: () => updateAppointmentStatus(appointmentId, newStatus)
        }
      ],
      { cancelable: false }
    );
  };

  // Render each appointment card
  const renderAppointmentCard = ({ item, index }: { item: Appointment, index: number }) => {
    // Create badge style based on status
    const badgeStyle = {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor:
        item.status === 'pending' ? '#f39c12' :
        item.status === 'confirmed' ? '#27ae60' :
        item.status === 'canceled' ? '#e74c3c' :
        item.status === 'completed' ? '#6c63ff' :
        '#8e8e93'
    };

    // Create text style based on status
    const textStyle = {
      color: '#fff',
      fontWeight: '500' as const,
      fontSize: 12
    };

    // Determine the status display text
    const statusText = item.status === 'confirmed' ? 'Active' : 
                       item.status.charAt(0).toUpperCase() + item.status.slice(1);
    
    // Add animation with stagger effect based on index
    const animationDelay = index * 100;

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={500}
        delay={animationDelay}
      >
        <TouchableOpacity 
          style={styles.appointmentCard}
          onPress={() => {
            // Navigation logic if needed
          }}
        >
          <View style={styles.cardHeader}>
            <View style={styles.clinicIconContainer}>
              <Ionicons name="medkit-outline" size={20} color="#6c63ff" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.clinicName}>{item.clinic.name}</Text>
              <Text style={styles.appointmentDate}>{item.date} • {item.startTime} - {item.endTime}</Text>
            </View>
            {item.isVideoMeeting && (
              <View style={styles.videoContainer}>
                <Ionicons name="videocam" size={20} color="#6c63ff" />
              </View>
            )}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.petSection}>
            <View style={styles.petInfo}>
              <Image 
                source={item.pet.photo ? { uri: item.pet.photo } : require('../../assets/splash-icon.png')} 
                style={styles.petImage as any} 
              />
              <View>
                <Text style={styles.petName}>{item.pet.name}</Text>
                <Text style={styles.petBreed}>{item.pet.species} • {item.pet.breed}</Text>
              </View>
            </View>
            
            <View style={badgeStyle}>
              <Text style={textStyle}>
                {statusText}
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

          {/* Action buttons based on status */}
          <View style={styles.actionButtonsContainer}>
            {item.status === 'pending' && (
              <>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => showConfirmationDialog(item.id, item.status, 'confirmed')}
                >
                  <Ionicons name="checkmark-outline" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Accept</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => showConfirmationDialog(item.id, item.status, 'canceled')}
                >
                  <Ionicons name="close-outline" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Decline</Text>
                </TouchableOpacity>
              </>
            )}
            
            {item.status === 'confirmed' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.completeButton]}
                onPress={() => showConfirmationDialog(item.id, item.status, 'completed')}
              >
                <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Mark as Completed</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) return null;
    
    return (
      <Animatable.View 
        animation="fadeIn" 
        duration={800}
        style={styles.emptyContainer}
      >
        <Ionicons name="calendar-outline" size={80} color="#6c63ff" style={{ opacity: 0.5 }} />
        <Text style={styles.emptyTitle}>No {displayOptions[selectedIndex]} Appointments</Text>
        <Text style={styles.emptyText}>
          {selectedIndex === 0 
            ? "You don't have any pending appointments."
            : selectedIndex === 1 
              ? "You don't have any active appointments at the moment."
              : "You don't have any completed appointments yet."}
        </Text>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
      
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Clinic Appointments</Text>
        <Text style={styles.headerSubtitle}>Manage your veterinary practice schedule</Text>
      </LinearGradient>
      
      <Animatable.View 
        animation="fadeInUp"
        duration={800}
        style={styles.contentContainer}
      >
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
            <ActivityIndicator size="large" color="#6c63ff" />
            <Text style={styles.loadingText}>Loading appointments...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <LinearGradient
                colors={['#6c63ff', '#3b5998']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.retryButtonGradient}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </LinearGradient>
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
                colors={['#6c63ff']}
                tintColor="#6c63ff"
              />
            }
          />
        )}
      </Animatable.View>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  contentContainer: {
    flex: 1,
    marginTop: -20,
    backgroundColor: '#f9f9f9',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingTop: 20,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0ff',
    borderRadius: 25,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    width: width * 0.9,
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 25,
  },
  selectedSegment: {
    backgroundColor: '#ffffff',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  text: {
    fontSize: 14,
    color: '#777',
    fontWeight: '500',
  },
  selectedText: {
    color: '#6c63ff',
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
    maxWidth: width * 0.8,
  },
  retryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  retryButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  clinicIconContainer: {
    backgroundColor: '#f0f0ff',
    borderRadius: 20,
    padding: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#f0f0ff',
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
    marginTop: height * 0.1,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  acceptButton: {
    backgroundColor: '#27ae60',
  },
  completeButton: {
    backgroundColor: '#6c63ff',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
});

export default VetAppointmentScreen;