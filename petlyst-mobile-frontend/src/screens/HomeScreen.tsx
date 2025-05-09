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
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as SecureStore from 'expo-secure-store';

type ClinicPhoto = {
  photo_id: number;
  s3_url: string;
  presigned_url: string;
};

type PhoneNumber = {
  number: string;
  type?: string;
};

type SocialMedia = {
  platform: string;
  url: string;
};

type Location = {
  province?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

type ClinicItem = {
  id: number;
  name: string;
  email: string | null;
  address: string;
  clinic_operator_id: number;
  description: string;
  opening_time: Date;
  closing_time: Date;
  verification_status: string;
  establishment_year: number;
  show_phone_number: boolean;
  allow_direct_messages: boolean;
  show_mail_address: boolean;
  allow_online_meetings: boolean;
  available_days: boolean[];
  emergency_available_days: boolean[];
  clinic_time_slots?: number;
  is_open_24_7?: boolean;
  type?: string;
  operator_id: number;
  photos: ClinicPhoto[];
  phone_numbers: PhoneNumber[];
  social_media: SocialMedia[];
  location: Location;
  medical_services?: string[];
  allows_video_meetings?: boolean;
  average_rating?: number;
  total_reviews?: number;
};

const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');
const cardWidth = width * 0.42; // making cards fit two in a row with spacing

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
        clinic.name.toLowerCase().includes(query) ||
        (clinic.description && clinic.description.toLowerCase().includes(query)) ||
        (clinic.location.address && clinic.location.address.toLowerCase().includes(query)) ||
        (clinic.type && clinic.type.toLowerCase().includes(query))
      );
      setFilteredClinics(filtered);
    }
  }, [searchQuery, allClinics]);

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch('https://petlyst.com:3001/api/fetch-clinics', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
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
        name: clinic.name,
        email: clinic.email,
        address: clinic.address,
        clinic_operator_id: clinic.clinic_operator_id,
        description: clinic.description,
        opening_time: clinic.opening_time,
        closing_time: clinic.closing_time,
        verification_status: clinic.verification_status,
        establishment_year: clinic.establishment_year,
        show_phone_number: clinic.show_phone_number,
        allow_direct_messages: clinic.allow_direct_messages,
        show_mail_address: clinic.show_mail_address,
        allow_online_meetings: clinic.allow_online_meetings,
        available_days: clinic.available_days,
        emergency_available_days: clinic.emergency_available_days,
        clinic_time_slots: clinic.clinic_time_slots,
        is_open_24_7: clinic.is_open_24_7,
        type: clinic.type,
        operator_id: clinic.operator_id,
        photos: clinic.photos || [],
        phone_numbers: clinic.phone_numbers || [],
        social_media: clinic.social_media || [],
        location: {
          province: clinic.province,
          district: clinic.district,
          address: clinic.address,
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        },
        medical_services: clinic.medical_services,
        allows_video_meetings: clinic.allows_video_meetings,
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
    
    // Reset scrollability state to ensure it gets rechecked
    setIsScrollable(true);
    
    // Reset the scroll position and ensure scroll is enabled
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        scrollIndicatorOpacity.setValue(1);
      }, 100);
    }
  };

  const handleViewinTheMap = async () => {
    const clinicId = selectedClinic?.id;
    
    setModalVisible(false);
    navigation.navigate('MapScreen', { clinic_id: clinicId, }); // Pass the location string
  };

  const renderClinicCard = ({ item, index }: { item: ClinicItem, index: number }) => {
    const firstPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : null;
    
    // Create staggered animation effect
    const animationDelay = index * 100;

    return (
      <Animatable.View 
        animation="fadeInUp" 
        delay={animationDelay} 
        duration={500}
        style={styles.cardWrapper}
      >
        <TouchableOpacity 
          onPress={() => handleCardPress(item)} 
          style={styles.card}
          activeOpacity={0.9}
        >
          <View style={styles.imagePlaceholder}>
            {firstPhoto ? (
              <Image
                source={{ uri: firstPhoto.presigned_url }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.noImageContainer}>
                <Ionicons name="image" size={40} color="#ddd" />
              </View>
            )}
            {item.average_rating ? (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{item.average_rating.toFixed(1)}</Text>
              </View>
            ) : (
              <View style={styles.noRatingBadge}>
                <Text style={styles.noRatingText}>New</Text>
              </View>
            )}
            {item.allows_video_meetings && (
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={12} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.cardDetails}>
              <Ionicons name="location-outline" size={14} color="#6c63ff" />
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item.location?.address || item.address || 'No address provided'}
              </Text>
            </View>
            {item.type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  // Carousel scroll callback to track index
  const handleScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(newIndex);
  };

  const handleMakeAppointment = async (clinicId: any) => {
    const clinic_time_slots = selectedClinic?.clinic_time_slots;
    const clinic_is_open_24_7 = selectedClinic?.is_open_24_7;
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

  // Update the checkIfScrollable function to always enable scrolling
  const checkIfScrollable = (event: any) => {
    try {
      // Always set scrollable to true to avoid the issue
      setIsScrollable(true);
      
      // Always show scroll indicator initially
      Animated.timing(scrollIndicatorOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error checking if content is scrollable:', error);
      // Default to showing the scroll indicator if there's an error
      setIsScrollable(true);
      Animated.timing(scrollIndicatorOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  // Function to toggle description expansion
  const toggleDescription = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };

  // Add a callback for when the modal is shown
  const handleModalShow = () => {
    // Force scrollability check after modal is fully rendered
    setTimeout(() => {
      setIsScrollable(true);
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
        scrollIndicatorOpacity.setValue(1);
      }
    }, 300);
  };

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Petlyst</Text>
        <Text style={styles.headerSubtitle}>{bestFor}</Text>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8b8b8b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinics, services..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8b8b8b"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#8b8b8b" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Clinics Grid */}
      <View style={styles.clinicsContainer}>
        <FlatList
          data={filteredClinics}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderClinicCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#6c63ff']}
              tintColor={'#6c63ff'}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Ionicons name="search-outline" size={80} color="#e0e0ff" />
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
        onShow={handleModalShow}
      >
        <View style={styles.modalContainer}>
          {/* Top Header with "X" */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={styles.modalHeaderGradient}
          >
            <TouchableOpacity 
              onPress={handleModalClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Image Counter */}
            {selectedClinic?.photos && selectedClinic.photos.length > 0 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentIndex + 1}/{selectedClinic.photos.length}
                </Text>
              </View>
            )}
          </LinearGradient>

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
              <View style={styles.noCarouselImage}>
                <Ionicons name="images-outline" size={60} color="#ccc" />
                <Text style={styles.noImagesText}>No clinic images available</Text>
              </View>
            )}
          </View>

          {/* Bottom Card: Clinic Details - Now Scrollable */}
          <View style={styles.bottomCardContainer}>
            <ScrollView 
              ref={scrollViewRef}
              style={styles.bottomCard} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={checkIfScrollable}
              onLayout={checkIfScrollable}
              contentContainerStyle={styles.scrollContentContainer}
              alwaysBounceVertical={true} // Add this to ensure scrollability
            >
              {selectedClinic && (
                <>
                  <View style={styles.clinicHeaderRow}>
                    <View style={styles.clinicTitleContainer}>
                      <Text style={styles.modalTitle}>{selectedClinic.name}</Text>
                      <Text style={styles.clinicType}>{selectedClinic.type || 'Veterinary Clinic'}</Text>
                    </View>
                    
                    {selectedClinic.average_rating ? (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={styles.ratingValue}>{selectedClinic.average_rating.toFixed(1)}</Text>
                        <Text style={styles.reviewCount}>{`(${selectedClinic.total_reviews || 0})`}</Text>
                      </View>
                    ) : (
                      <View style={styles.noRatingContainer}>
                        <Ionicons name="star-outline" size={20} color="#aaa" />
                        <Text style={styles.noRatingText}>No reviews yet</Text>
                      </View>
                    )}
                  </View>

                  {/* Description with Show More button */}
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text 
                      style={[
                        styles.descriptionText,
                        !isDescriptionExpanded && styles.descriptionCollapsed
                      ]}
                      numberOfLines={isDescriptionExpanded ? undefined : 3}
                    >
                      {selectedClinic.description || 'No description available for this clinic.'}
                    </Text>
                    
                    {selectedClinic.description && 
                     selectedClinic.description.length > 120 && (
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
                          color="#6c63ff" 
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Clinic Info Section */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Clinic Information</Text>
                    
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <Ionicons name="location-outline" size={20} color="#6c63ff" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Address</Text>
                        <Text style={styles.infoValue}>
                          {selectedClinic?.location?.province && selectedClinic?.location?.district 
                            ? `${selectedClinic.location.address}, ${selectedClinic.location.district}, ${selectedClinic.location.province}`
                            : selectedClinic?.location?.address || selectedClinic?.address || 'Not provided'}
                        </Text>
                      </View>
                    </View>
                    
                    {selectedClinic?.phone_numbers && selectedClinic.phone_numbers.length > 0 && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIconContainer}>
                          <Ionicons name="call-outline" size={20} color="#6c63ff" />
                        </View>
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Phone</Text>
                          <Text style={styles.infoValue}>{selectedClinic.phone_numbers[0].number}</Text>
                        </View>
                      </View>
                    )}
                    
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <Ionicons name="time-outline" size={20} color="#6c63ff" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Working Hours</Text>
                        <Text style={styles.infoValue}>
                          {selectedClinic?.is_open_24_7 
                            ? '24/7' 
                            : `${selectedClinic?.opening_time || ''} - ${selectedClinic?.closing_time || ''}`
                          }
                        </Text>
                      </View>
                    </View>
                    
                    {selectedClinic?.email && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIconContainer}>
                          <Ionicons name="mail-outline" size={20} color="#6c63ff" />
                        </View>
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Email</Text>
                          <Text style={styles.infoValue}>{selectedClinic.email}</Text>
                        </View>
                      </View>
                    )}
                    
                    {selectedClinic?.medical_services && selectedClinic.medical_services.length > 0 && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIconContainer}>
                          <Ionicons name="medkit-outline" size={20} color="#6c63ff" />
                        </View>
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Services</Text>
                          <View style={styles.serviceContainer}>
                            {selectedClinic.medical_services.map((service, index) => (
                              <View key={index} style={styles.serviceBadge}>
                                <Text style={styles.serviceText}>{service}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {selectedClinic?.allows_video_meetings && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIconContainer}>
                          <Ionicons name="videocam-outline" size={20} color="#6c63ff" />
                        </View>
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Online Consultations</Text>
                          <Text style={styles.infoValue}>Available</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.buttonGroup}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => handleViewinTheMap()}
                    >
                      <Ionicons name="map-outline" size={20} color="#6c63ff" />
                      <Text style={styles.secondaryButtonText}>View on Map</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={() => handleMakeAppointment(selectedClinic.id)}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>
                        Book Appointment
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Add some padding at the bottom to ensure buttons are fully visible */}
                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
            
            {/* Scroll indicator - only shown when content is scrollable */}
            
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerGradient: {
    paddingTop: 30,
    paddingBottom: 8,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  clinicsContainer: {
    flex: 1,
    marginTop: 15,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  cardWrapper: {
    width: cardWidth,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imagePlaceholder: {
    width: '100%',
    height: cardWidth * 0.7,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 3,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAddress: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  typeText: {
    fontSize: 10,
    color: '#6c63ff',
    fontWeight: '500',
  },
  listContentContainer: {
    paddingTop: 20,
    paddingBottom: 80,
  },
  emptyListContainer: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#777',
    marginTop: 5,
  },
  
  /* MODAL STYLES */
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  modalHeaderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 10,
    paddingTop: 45,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselContainer: {
    width: '100%',
    height: height * 0.4,
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  noCarouselImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImagesText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
  carouselImage: {
    width,
    height: '100%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 15,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    marginTop: -25,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  clinicHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  clinicTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#333',
  },
  clinicType: {
    fontSize: 14,
    color: '#6c63ff',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 5,
  },
  reviewCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 3,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  descriptionCollapsed: {
    maxHeight: 66, // Approximately 3 lines of text
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  showMoreText: {
    color: '#6c63ff',
    fontWeight: '600',
    marginRight: 5,
    fontSize: 14,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: '#f0f0ff',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#777',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  buttonGroup: {
    flexDirection: 'row',
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f0f0ff',
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6c63ff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 5,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: '#6c63ff',
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 5,
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollIndicatorInner: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollIndicatorText: {
    color: '#6c63ff',
    fontWeight: '500',
    marginLeft: 5,
    fontSize: 14,
  },
  scrollContentContainer: {
    paddingBottom: 30, // Add extra padding at the bottom
    minHeight: height * 0.6, // Force minimum height to ensure scrollability
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serviceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  serviceBadge: {
    backgroundColor: '#f0f0ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  serviceText: {
    fontSize: 12,
    color: '#6c63ff',
    fontWeight: '500',
  },
  noRatingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noRatingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  noRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
});

export default HomeScreen;
