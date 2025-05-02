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
            {item.average_rating && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{item.average_rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.clinic_name}</Text>
            <View style={styles.cardDetails}>
              <Ionicons name="location-outline" size={14} color="#6c63ff" />
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item.clinic_address || 'No address provided'}
              </Text>
            </View>
            {item.clinic_type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.clinic_type}</Text>
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
            >
              {selectedClinic && (
                <>
                  <View style={styles.clinicHeaderRow}>
                    <View style={styles.clinicTitleContainer}>
                      <Text style={styles.modalTitle}>{selectedClinic.clinic_name}</Text>
                      <Text style={styles.clinicType}>{selectedClinic.clinic_type || 'Veterinary Clinic'}</Text>
                    </View>
                    
                    {selectedClinic.average_rating && (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={styles.ratingValue}>{selectedClinic.average_rating.toFixed(1)}</Text>
                        <Text style={styles.reviewCount}>{`(${selectedClinic.total_reviews || 0})`}</Text>
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
                      {selectedClinic.clinic_description || 'No description available for this clinic.'}
                    </Text>
                    
                    {selectedClinic.clinic_description && 
                     selectedClinic.clinic_description.length > 120 && (
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
                        <Text style={styles.infoValue}>{selectedClinic.clinic_address || 'Not provided'}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <Ionicons name="call-outline" size={20} color="#6c63ff" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Phone</Text>
                        <Text style={styles.infoValue}>{selectedClinic.clinic_phone || 'Not provided'}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <Ionicons name="time-outline" size={20} color="#6c63ff" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Working Hours</Text>
                        <Text style={styles.infoValue}>
                          {selectedClinic.clinic_is_open_24_7 
                            ? '24/7' 
                            : `${selectedClinic.clinic_opening_time || ''} - ${selectedClinic.clinic_closing_time || ''}`
                          }
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <Ionicons name="mail-outline" size={20} color="#6c63ff" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{selectedClinic.clinic_email || 'Not provided'}</Text>
                      </View>
                    </View>
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
            {isScrollable && (
              <Animated.View style={[styles.scrollIndicator, { opacity: scrollIndicatorOpacity }]}>
                <View style={styles.scrollIndicatorInner}>
                  <Ionicons name="chevron-down" size={20} color="#6c63ff" />
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
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 25,
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
    marginTop: -15,
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
});

export default HomeScreen;
