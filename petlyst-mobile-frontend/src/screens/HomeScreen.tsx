import React, { useEffect, useState, useRef } from 'react';
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
  ScrollView,
  Animated,
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
  const [filteredClinics, setFilteredClinics] = useState<ClinicItem[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [bestFor, setBestFor] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<ClinicItem | null>(null);
  
  // Track photo carousel index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollIndicatorOpacity] = useState(new Animated.Value(1));
  const scrollViewRef = useRef<ScrollView>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(() => {
    fetchSelectedPet();
  });

  // Add effect to filter clinics when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClinics(allClinics);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = allClinics.filter(clinic => 
        clinic.clinic_name.toLowerCase().includes(query) ||
        (clinic.clinic_description && clinic.clinic_description.toLowerCase().includes(query)) ||
        (clinic.clinic_address && clinic.clinic_address.toLowerCase().includes(query)) ||
        (clinic.clinic_type && clinic.clinic_type.toLowerCase().includes(query))
      );
      setFilteredClinics(filtered);
    }
  }, [searchQuery, allClinics]);

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
      setFilteredClinics(transformed); // Initialize filtered clinics with all clinics
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
    setIsDescriptionExpanded(false); // Reset description to collapsed state
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
    setModalVisible(false);
  };

  // Add a function to handle modal close
  const handleModalClose = () => {
    setModalVisible(false);
    setIsDescriptionExpanded(false); // Reset description to collapsed state
  };

  // Function to handle scroll events
  const handleScroll = (event: any) => {
    try {
      if (!event || !event.nativeEvent || 
          !event.nativeEvent.layoutMeasurement || 
          !event.nativeEvent.contentOffset || 
          !event.nativeEvent.contentSize) {
        return;
      }
      
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      
      // Ensure we have valid height values
      const layoutHeight = layoutMeasurement.height || 0;
      const contentOffsetY = contentOffset.y || 0;
      const contentHeight = contentSize.height || 0;
      
      const paddingToBottom = 20;
      const isCloseToBottom = layoutHeight + contentOffsetY >= 
        contentHeight - paddingToBottom;
      
      // Fade out the scroll indicator when near the bottom
      Animated.timing(scrollIndicatorOpacity, {
        toValue: isCloseToBottom ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error handling scroll event:', error);
    }
  };

  // Function to check if content is scrollable
  const checkIfScrollable = (event: any) => {
    try {
      // Check if all required properties exist
      if (!event || !event.nativeEvent || 
          !event.nativeEvent.layoutMeasurement || 
          !event.nativeEvent.contentSize) {
        return;
      }
      
      const { layoutMeasurement, contentSize } = event.nativeEvent;
      
      // Ensure we have valid height values
      const layoutHeight = layoutMeasurement.height || 0;
      const contentHeight = contentSize.height || 0;
      
      const isContentScrollable = contentHeight > layoutHeight;
      setIsScrollable(isContentScrollable);
      
      // Only show scroll indicator if content is scrollable
      Animated.timing(scrollIndicatorOpacity, {
        toValue: isContentScrollable ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error checking if content is scrollable:', error);
      // Default to not showing the scroll indicator if there's an error
      setIsScrollable(false);
      Animated.timing(scrollIndicatorOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  // Function to toggle description expansion
  const toggleDescription = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
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
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* All Clinics Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{bestFor}</Text>
        </View>
        <FlatList
          data={filteredClinics}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderClinicCard}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Ionicons name="search-outline" size={50} color="#ccc" />
              <Text style={styles.emptyListText}>No clinics found</Text>
              <Text style={styles.emptyListSubtext}>Try a different search term</Text>
            </View>
          }
        />
      </View>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalContainer}>
          {/* Top Header with "X" */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleModalClose}>
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

                {/* Pagination Dots - Enhanced */}
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
                
                {/* Image Counter */}
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentIndex + 1}/{selectedClinic.photos.length}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={{ color: '#999' }}>No clinic images</Text>
              </View>
            )}
          </View>

          {/* Bottom Card: Clinic Details - Now Scrollable */}
          <View style={styles.bottomCardContainer}>
            <ScrollView 
              ref={scrollViewRef}
              style={styles.bottomCard} 
              showsVerticalScrollIndicator={true}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={checkIfScrollable}
              onLayout={checkIfScrollable}
            >
              {selectedClinic && (
                <>
                  <Text style={styles.modalTitle}>{selectedClinic.clinic_name}</Text>

                  {/* Example star rating text (optional) */}
                  <Text style={styles.smallRatingText}>
                    {selectedClinic.average_rating
                      ? `★ ${selectedClinic.average_rating.toFixed(1)} / 5`
                      : 'No rating yet'}
                  </Text>

                  {/* Description with Show More button */}
                  <View style={styles.descriptionContainer}>
                    <Text 
                      style={[
                        styles.descriptionText,
                        !isDescriptionExpanded && styles.descriptionCollapsed
                      ]}
                      numberOfLines={isDescriptionExpanded ? undefined : 2}
                    >
                      {selectedClinic.clinic_description || 'N/A'}
                    </Text>
                    
                    {selectedClinic.clinic_description && 
                     selectedClinic.clinic_description.length > 80 && (
                      <TouchableOpacity 
                        style={styles.showMoreButton}
                        onPress={toggleDescription}
                      >
                        <Text style={styles.showMoreText}>
                          {isDescriptionExpanded ? 'Show less' : 'Show more'}
                        </Text>
                        <Ionicons 
                          name={isDescriptionExpanded ? "chevron-up" : "chevron-down"} 
                          size={16} 
                          color="#4285F4" 
                        />
                      </TouchableOpacity>
                    )}
                  </View>

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
                  
                  {/* Add some padding at the bottom to ensure buttons are fully visible */}
                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
            
            {/* Scroll indicator - only shown when content is scrollable */}
            {isScrollable && (
              <Animated.View style={[styles.scrollIndicator, { opacity: scrollIndicatorOpacity }]}>
                <View style={styles.scrollIndicatorInner}>
                  <Ionicons name="chevron-down" size={24} color="#4285F4" />
                  <Text style={styles.scrollIndicatorText}>Scroll for more</Text>
                </View>
              </Animated.View>
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
    color: '#333',
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
    height: 250, // Reduced from 300
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // Added to position dots and counter
  },
  carouselImage: {
    width: width,
    height: 250, // Reduced from 300
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  imageCounter: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  imageCounterText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  bottomCardContainer: {
    flex: 1,
    position: 'relative',
  },
  bottomCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: -20, // overlaps carousel slightly
    flex: 1,
    paddingBottom: 30, // Added more padding at the bottom

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
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionText: {
    color: '#555',
    lineHeight: 20,
  },
  descriptionCollapsed: {
    maxHeight: 40, // Approximately 2 lines of text (reduced from 60)
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  showMoreText: {
    color: '#4285F4',
    fontWeight: '600',
    marginRight: 5,
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
  scrollIndicator: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollIndicatorInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollIndicatorText: {
    marginLeft: 5,
    color: '#4285F4',
    fontWeight: '600',
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyListText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
});

export default HomeScreen;
