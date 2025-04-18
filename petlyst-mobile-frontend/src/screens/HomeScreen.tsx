import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';


type ClinicPhoto = {
  photo_id: number;
  created_at: string;
  presigned_url: string;
};

type ClinicItem = {
  id: number;
  clinic_name: string;
  clinic_email: string;
  clinic_operator_id: number;
  clinic_description: string;
  clinic_opening_time: Date;
  clinic_closing_time: Date;
  verification_status: string;
  clinic_establishment_year: number;
  clinic_show_phone_number: boolean;
  clinic_allow_direct_messages: boolean;
  clinic_show_mail_address: boolean;
  clinic_allow_online_meetings: boolean;
  clinic_available_days: boolean[];
  clinic_emergency_days: boolean[];
  clinic_time_slots?: number;
  clinic_is_open_24_7?: boolean;
  clinic_type?: string;
  clinic_slug?: string;
  clinic_address?: string;
  clinic_phone?: string;
  operator_id: number;
  location: string;
  photos: ClinicPhoto[];
  working_hours?: string;
  average_rating?: number;
  total_reviews?: number;
};

const { width } = Dimensions.get('window');
const cardWidth = width * 0.9; // making the card take most of the width for vertical layout

const HomeScreen = ({ navigation }: { navigation: any }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allClinics, setAllClinics] = useState<ClinicItem[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [bestFor, setBestFor] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<ClinicItem | null>(null);
  
  // Track photo carousel index
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(() => {
    fetchSelectedPet();
  });

  const fetchData = async () => {
    try {
      const response = await fetch('https://petlyst.com:3001/api/fetch-clinics');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return;
      }
      const data = await response.json();

      // Filter clinics to include only those with verification_status === 'verified'
      const verifiedClinics = data.filter((clinic: any) => clinic.verification_status === 'verified');

      const transformed: ClinicItem[] = verifiedClinics.map((clinic: any) => ({
        id: clinic.id,
        clinic_name: clinic.name,
        clinic_email: clinic.email,
        clinic_operator_id: clinic.clinic_operator_id,
        clinic_description: clinic.description,
        clinic_opening_time: clinic.opening_time,
        clinic_closing_time: clinic.closing_time,
        verification_status: clinic.verification_status,
        clinic_establishment_year: clinic.establishment_year,
        clinic_show_phone_number: clinic.show_phone_number,
        clinic_allow_direct_messages: clinic.allow_direct_messages,
        clinic_show_mail_address: clinic.show_mail_address,
        clinic_allow_online_meetings: clinic.allow_online_meetings,
        clinic_available_days: clinic.available_days,
        clinic_emergency_days: clinic.emergency_days,
        clinic_time_slots: clinic.clinic_time_slots,
        clinic_is_open_24_7: clinic.is_open_24_7,
        clinic_type: clinic.type,
        clinic_slug: clinic.slug,
        clinic_address: clinic.address,
        clinic_phone: clinic.phone,
        operator_id: clinic.operator_id,
        location: clinic.location || '',
        photos: clinic.photos || [],
        working_hours: clinic.working_hours,
        average_rating: clinic.average_rating,
        total_reviews: clinic.total_reviews,
      }));

      setAllClinics(transformed);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchSelectedPet = async () => {
    try {
      const storedName = await AsyncStorage.getItem('selectedPetName');
      if (!storedName) {
        setBestFor(`Recommended by Petlyst`);
      } else {
        setBestFor(`Best for ${storedName}`);
      }
    } catch (error) {
      console.error('Error loading selected pet name:', error);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchSelectedPet();
    setRefreshing(false);
  };

  const handleCardPress = (clinic: ClinicItem) => {
    setSelectedClinic(clinic);
    setModalVisible(true);
    setCurrentIndex(0); // reset carousel index
  };

  const handleViewinTheMap = async () => {
    const address = selectedClinic?.clinic_address;
    
    setModalVisible(false);
    navigation.navigate('MapScreen', { address }); // Pass the location string
  };

  const renderClinicCard = ({ item }: { item: ClinicItem }) => {
    const firstPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : null;

    return (
      <TouchableOpacity onPress={() => handleCardPress(item)} style={styles.card}>
        <View style={styles.imagePlaceholder}>
          {firstPhoto ? (
            <Image
              source={{ uri: firstPhoto.presigned_url }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="image" size={48} color="#ccc" />
          )}
        </View>
        <Text style={styles.cardTitle}>{item.clinic_name}</Text>
      </TouchableOpacity>
    );
  };

  // Carousel scroll callback to track index
  const handleScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(newIndex);
  };

  const handleMakeAppointment = async (clinicId: any) => {
    const clinic_time_slots = selectedClinic?.clinic_time_slots;
    const clinic_is_open_24_7 = selectedClinic?.clinic_is_open_24_7;
    navigation.navigate('MakeAppointment', { clinic_id: clinicId, clinic_time_slots});
    console.log(`${clinicId} + ${clinic_time_slots} + ${clinic_is_open_24_7}`);
    setModalVisible(false);
};

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={24} color="#ccc" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search on Petlyst"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* All Clinics Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{bestFor}</Text>
        </View>
        <FlatList
          data={allClinics}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderClinicCard}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Top Header with "X" */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Carousel Area */}
          <View style={styles.carouselContainer}>
            {selectedClinic?.photos && selectedClinic.photos.length > 0 ? (
              <>
                <FlatList
                  data={selectedClinic.photos}
                  keyExtractor={(photo) => String(photo.photo_id)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleScrollEnd}
                  renderItem={({ item: photo }) => (
                    <Image
                      source={{ uri: photo.presigned_url }}
                      style={styles.carouselImage}
                      resizeMode="cover"
                    />
                  )}
                />

                {/* Pagination Dots */}
                <View style={styles.dotsContainer}>
                  {selectedClinic.photos.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        index === currentIndex && styles.activeDot,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={{ color: '#999' }}>No clinic images</Text>
              </View>
            )}
          </View>

          {/* Bottom Card: Clinic Details */}
          <View style={styles.bottomCard}>
            {selectedClinic && (
              <>
                <Text style={styles.modalTitle}>{selectedClinic.clinic_name}</Text>

                {/* Example star rating text (optional) */}
                <Text style={styles.smallRatingText}>
                  {selectedClinic.average_rating
                    ? `★ ${selectedClinic.average_rating.toFixed(1)} / 5`
                    : 'No rating yet'}
                </Text>

                <Text style={styles.descriptionText}>
                  {selectedClinic.clinic_description || 'N/A'}
                </Text>

                {/* More info in detail rows */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address: {selectedClinic.clinic_address} </Text>
                  <Text style={styles.detailValue}>
                    
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone: {selectedClinic.clinic_phone}</Text>
                  <Text style={styles.detailValue}>
                    {selectedClinic.clinic_phone}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Working Hours:</Text>
                  <Text style={styles.detailValue}>
                    {`${selectedClinic.clinic_opening_time} - ${selectedClinic.clinic_closing_time}` || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Reviews:</Text>
                  <Text style={styles.detailValue}>
                    {selectedClinic.total_reviews ?? 'N/A'}
                  </Text>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => handleViewinTheMap()}
                >
                  <Text style={styles.detailsButtonText}>View in the Map</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleMakeAppointment(selectedClinic.id)} style={styles.appointmentButton}>
                  <Text style={styles.appointmentButtonText}>
                    Make an Appointment
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  /* Existing Styles Outside the Modal */
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 15,
    margin: 15,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  section: {
    marginBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    width: cardWidth,
    alignSelf: 'center',
    marginBottom: 20,
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: cardWidth,
    height: cardWidth * 0.5,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  cardTitle: {
    fontSize: 16,
    textAlign: 'center',
  },

  /* MODAL STYLES */
  modalContainer: {
    flex: 1,
    backgroundColor: '#f4f8fe', // Light background to mimic the screenshot
  },
  modalHeader: {
    height: 50,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
  },
  carouselContainer: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: width,
    height: 300,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#4285F4',
  },
  bottomCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: -20, // overlaps carousel slightly
    flex: 1,

    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    // Android elevation
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  smallRatingText: {
    fontSize: 14,
    marginBottom: 10,
    color: '#666',
  },
  descriptionText: {
    color: '#555',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    width: 120,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    flex: 1,
    flexWrap: 'wrap',
    color: '#555',
  },
  detailsButton: {
    backgroundColor: '#fff',
    borderColor: '#4285F4',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  detailsButtonText: {
    color: '#4285F4',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  appointmentButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    borderRadius: 5,
    marginTop: 10,
  },
  appointmentButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center', 
    fontSize: 16,
  },
});

export default HomeScreen;
