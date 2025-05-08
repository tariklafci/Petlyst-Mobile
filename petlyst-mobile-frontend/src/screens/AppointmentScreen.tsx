import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

interface Pet {
  id: number;
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
  clinic_id: number;
  pet_id: number;
  date: string;
  rawDate: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  isVideoMeeting: boolean;
  notes: string;
  meeting_url: string;
  pet: Pet;
  clinic: Clinic;
}

const { width, height } = Dimensions.get('window');

const AppointmentScreen = ({ navigation }: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Review modal state
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [hygieneRating, setHygieneRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [priceRating, setPriceRating] = useState(0);
  const [reviewComments, setReviewComments] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const statusOptions = ['pending', 'confirmed', 'completed'];
  const displayOptions = ['Pending', 'Active', 'Completed'];

  // Map status to color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#FFA500';
      case 'confirmed':
        return '#4CAF50';
      case 'canceled':
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#808080';
    }
  };

  // Fetch appointments by status
  const fetchAppointments = async (status = statusOptions[selectedIndex]) => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        return;
      }
      const res = await fetch(
        `https://petlyst.com:3001/api/fetch-appointments?status=${status}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch appointments');
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load appointments. Pull to refresh and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Cancel pending appointment
  const cancelAppointment = async (id: number) => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) throw new Error('No token');
      const res = await fetch(
        `https://petlyst.com:3001/api/cancel-pending-appointment`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ appointment_id: id, appointment_status: 'canceled' }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      Alert.alert('Success', 'Appointment canceled');
      fetchAppointments();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not cancel appointment');
      setIsLoading(false);
    }
  };

  // Confirm cancellation
  const confirmCancel = (id: number) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => cancelAppointment(id) },
      ],
      { cancelable: false }
    );
  };

  // Fetch treatment details for completed
  const fetchTreatmentDetails = async (id: number, petName: string, date: string) => {
    try {
      navigation.navigate('TreatmentDetails', {
        appointmentId: id,
        petName: petName,
        date: date
      });
    } catch (err) {
      console.error('Navigation error:', err);
      Alert.alert('Error', 'Could not open treatment details');
    }
  };

  // Pull-to-refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAppointments();
  };

  // Change tab
  const onTabChange = (idx: number) => {
    setSelectedIndex(idx);
    fetchAppointments(statusOptions[idx]);
  };

  // Fetch on focus & when selectedIndex changes
  useFocusEffect(
    useCallback(() => {
      fetchAppointments(statusOptions[selectedIndex]);
    }, [selectedIndex])
  );

  // Open review modal
  const openReviewModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setHygieneRating(0);
    setStaffRating(0);
    setPriceRating(0);
    setReviewComments('');
    setIsReviewModalVisible(true);
  };

  // Submit review
  const submitReview = async () => {
    if (!selectedAppointment) return;

    // Validate ratings
    if (hygieneRating === 0 || staffRating === 0 || priceRating === 0) {
      Alert.alert('Missing Ratings', 'Please provide a rating for all categories');
      return;
    }

    try {
      setIsSubmittingReview(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) throw new Error('Authentication token not found');

      console.log('Submitting review with data:', {
        appointment_id: selectedAppointment.id,
        clinic_id: selectedAppointment.clinic_id,
        pet_id: selectedAppointment.pet_id
      });

      const response = await fetch('https://petlyst.com:3001/api/create-clinic-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          clinic_id: selectedAppointment.clinic_id,
          pet_id: selectedAppointment.pet_id,
          hygiene_rating: hygieneRating,
          staff_behaviour_rating: staffRating,
          price_rating: priceRating,
          comments: reviewComments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      Alert.alert('Success', 'Your review has been submitted successfully');
      setIsReviewModalVisible(false);
      fetchAppointments(statusOptions[selectedIndex]); // Refresh to reflect any changes
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', error.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Render star rating component
  const renderRatingStars = (rating: number, setRating: (rating: number) => void) => {
    return (
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={28}
              color={star <= rating ? '#FFC107' : '#BDBDBD'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render each card
  const renderAppointment = ({ item, index }: { item: Appointment; index: number }) => {
    const color = getStatusColor(item.status);
    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 100}
        style={styles.appointmentCard}
      >
        {/* Pet & Status */}
        <View style={styles.cardHeader}>
          <View style={styles.petImageContainer}>
            {item.pet.photo ? (
              <Image
                source={{ uri: item.pet.photo }}
                style={styles.petImage}
              />
            ) : (
              <View style={[styles.petImage, styles.placeholderImage]}>
                <Ionicons name="paw" size={20} color={color} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.petName}>{item.pet.name}</Text>
            <Text style={styles.petType}>
              {item.pet.species} • {item.pet.breed}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.statusText, { color }]} numberOfLines={1}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Details */}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6c63ff" />
          <Text style={styles.detailText}>
            {item.date} • {item.startTime} - {item.endTime}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={16} color="#6c63ff" />
          <Text style={styles.detailText}>{item.clinic.name}</Text>
        </View>
        {item.notes ? (
          <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
            <Ionicons name="document-text-outline" size={16} color="#6c63ff" />
            <Text style={[styles.detailText, { flex: 1 }]}>{item.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          {item.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'rgba(244,67,54,0.1)' }]}
              onPress={() => confirmCancel(item.id)}
            >
              <Ionicons name="close-circle-outline" size={16} color="#F44336" />
              <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          {item.status === 'confirmed' && item.isVideoMeeting && item.meeting_url && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'rgba(52,152,219,0.1)' }]}
              onPress={() =>
                navigation.navigate('Meeting', { meetingUrl: item.meeting_url })
              }
            >
              <Ionicons name="videocam" size={16} color="#3498db" />
              <Text style={[styles.actionButtonText, { color: '#3498db' }]}>
                Join Video
              </Text>
            </TouchableOpacity>
          )}
          {item.status === 'completed' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: 'rgba(76,175,80,0.1)' }]}
                onPress={() => openReviewModal(item)}
              >
                <Ionicons name="star-outline" size={16} color="#4CAF50" />
                <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                  Rate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: 'rgba(33,150,243,0.1)' }]}
                onPress={() => fetchTreatmentDetails(item.id, item.pet.name, item.date)}
              >
                <Ionicons name="document-text-outline" size={16} color="#2196F3" />
                <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
                  Details
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animatable.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Review Modal */}
      <Modal
        visible={isReviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Your Experience</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsReviewModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedAppointment && (
                <View style={styles.appointmentInfo}>
                  <Text style={styles.clinicName}>{selectedAppointment.clinic.name}</Text>
                  <Text style={styles.modalPetName}>
                    {selectedAppointment.pet.name} • {selectedAppointment.date}
                  </Text>
                </View>
              )}

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Hygiene</Text>
                {renderRatingStars(hygieneRating, setHygieneRating)}
              </View>

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Staff Behavior</Text>
                {renderRatingStars(staffRating, setStaffRating)}
              </View>

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Value for Price</Text>
                {renderRatingStars(priceRating, setPriceRating)}
              </View>

              <View style={styles.commentSection}>
                <Text style={styles.ratingLabel}>Comments</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Share your experience (optional)"
                  multiline={true}
                  numberOfLines={4}
                  value={reviewComments}
                  onChangeText={setReviewComments}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setIsReviewModalVisible(false)}
                disabled={isSubmittingReview}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gradient Header */}
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Appointments</Text>
        <Text style={styles.headerSubtitle}>
          Manage your pet's healthcare schedule
        </Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.segmentContainer}>
        {displayOptions.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.segment,
              selectedIndex === i && styles.selectedSegment,
            ]}
            onPress={() => onTabChange(i)}
          >
            <Text
              style={[
                styles.segmentText,
                selectedIndex === i && styles.selectedSegmentText,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List or Loading */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(a) => a.id.toString()}
          renderItem={renderAppointment}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.noAppointmentsContainer}>
              <Ionicons name="calendar-outline" size={80} color="#777" />
              <Text style={styles.noAppointmentsText}>
                No {displayOptions[selectedIndex]} appointments
              </Text>
              {selectedIndex === 0 && (
                <TouchableOpacity
                  style={styles.browseClinicsButton}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.browseClinicsText}>
                    Book an Appointment
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#6c63ff']}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff'},
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },

  // Tabs
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#eceff5',
    borderRadius: 25,
    marginHorizontal: 16,
    marginTop: 12,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  selectedSegment: { backgroundColor: '#fff', borderRadius: 25, elevation: 2 },
  segmentText: { color: '#555', fontWeight: '500' },
  selectedSegmentText: { color: '#000', fontWeight: 'bold' },

  // Loading & Empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noAppointmentsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noAppointmentsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  browseClinicsButton: {
    marginTop: 20,
    backgroundColor: '#6c63ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  browseClinicsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Card
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  petImageContainer: {
    marginRight: 12,
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderImage: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  petType: { fontSize: 14, color: '#777' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flexShrink: 1,
  },

  // Action Buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
    maxHeight: '70%',
  },
  appointmentInfo: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalPetName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#444',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starButton: {
    padding: 8,
  },
  commentSection: {
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelModalButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#6c63ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AppointmentScreen;
