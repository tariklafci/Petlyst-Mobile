import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  ActivityIndicator,
  StatusBar,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

// Define the app navigation types
type RootStackParamList = {
  HomeScreen: undefined;
  MapScreen: { clinic_id: number };
  MakeAppointment: { 
    clinic_id: number;
    clinic_time_slots?: number;
    openingTime?: string;
    closingTime?: string;
  };
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Types for clinic data
interface ClinicPhoto {
  photo_id: number;
  s3_url: string;
  presigned_url: string;
}

interface PhoneNumber {
  number: string;
  type?: string;
}

interface SocialMedia {
  platform: string;
  url: string;
}

interface Location {
  province?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface Clinic {
  id: number;
  name: string;
  email: string | null;
  description: string;
  opening_time: string;
  closing_time: string;
  verification_status: string;
  establishment_year: number;
  show_phone_number: boolean;
  allow_direct_messages: boolean;
  show_mail_address: boolean;
  allow_online_meetings: boolean;
  available_days: boolean[];
  emergency_available_days: boolean[];
  clinic_time_slots?: number;
  is_open_24_7?: string;
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
}

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42; // Two cards per row with spacing
const CAROUSEL_HEIGHT = height * 0.4;
const HEADER_HEIGHT = Platform.OS === 'ios' ? 90 : 70;

const HomeScreen: React.FC = () => {
  // State for screen data
  const [searchQuery, setSearchQuery] = useState('');
  const [allClinics, setAllClinics] = useState<Clinic[]>([]);
  const [filteredClinics, setFilteredClinics] = useState<Clinic[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bestFor, setBestFor] = useState('');
  
  // New state for emergency mode
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearestClinic, setNearestClinic] = useState<Clinic | null>(null);
  const [clinicsWithDistance, setClinicWithDistance] = useState<(Clinic & { distance?: number })[]>([]);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Animation refs
  const scrollIndicatorOpacity = useState(new Animated.Value(1))[0];
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  
  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  // Handle emergency mode activation
  const handleEmergency = async () => {
    try {
      setIsEmergencyMode(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please grant location permissions to find the nearest clinic.'
        );
        setIsEmergencyMode(false);
        return;
      }
      
      // Get user's current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      // Calculate distances and find nearest clinic
      if (allClinics.length > 0) {
        const clinicsWithDistances = allClinics
          .filter(clinic => 
            clinic.location && 
            clinic.location.latitude && 
            clinic.location.longitude
          )
          .map(clinic => {
            if (!clinic.location?.latitude || !clinic.location?.longitude) {
              return { ...clinic, distance: Infinity };
            }
            
            const distance = calculateDistance(
              location.coords.latitude,
              location.coords.longitude,
              clinic.location.latitude,
              clinic.location.longitude
            );
            
            return { ...clinic, distance };
          })
          .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        
        setClinicWithDistance(clinicsWithDistances);
        setFilteredClinics(clinicsWithDistances);
        
        // If nearest clinic exists, show it
        if (clinicsWithDistances.length > 0) {
          setNearestClinic(clinicsWithDistances[0]);
          
          // Find the nearest open clinic
          const nearestOpenClinic = clinicsWithDistances.find(clinic => {
            const { isOpen } = isClinicOpenNow(clinic);
            return isOpen;
          });
          
          // Determine which clinic to show in modal
          const clinicToShow = nearestOpenClinic || clinicsWithDistances[0];
          
          // Only automatically show modal if clinic is less than 10km away
          if (1) {
            setSelectedClinic(clinicToShow);
            setModalVisible(true);
          }
        } else {
          Alert.alert(
            'No Nearby Clinics',
            'We couldn\'t find any clinics with location data near you.'
          );
        }
      } else {
        Alert.alert(
          'No Clinics Available',
          'Please refresh to load clinic data.'
        );
      }
    } catch (error) {
      console.error('Error in emergency mode:', error);
      Alert.alert(
        'Error',
        'Failed to locate nearby clinics. Please try again.'
      );
    } finally {
      // Keep emergency mode active for sorting, but finish loading
      setLoading(false);
    }
  };

  // Reset emergency mode
  const exitEmergencyMode = () => {
    setIsEmergencyMode(false);
    setUserLocation(null);
    setNearestClinic(null);
    setFilteredClinics(allClinics);
  };

  // Modify existing filter effect to respect emergency mode
  useEffect(() => {
    if (isEmergencyMode && userLocation) {
      // In emergency mode, keep distance-based sorting
      return;
    }
    
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
  }, [searchQuery, allClinics, isEmergencyMode, userLocation]);

  // Fetch clinics data from API
  const fetchClinics = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }
      
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
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      setAllClinics(data);
      setFilteredClinics(data);
      
    } catch (error) {
      console.error('Error fetching clinic data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pet name for recommendations
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
      setBestFor('Recommended by Petlyst');
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchClinics(), fetchSelectedPet()]);
    setRefreshing(false);
  };

  // Load data on initial mount
  useEffect(() => {
    fetchClinics();
    fetchSelectedPet();
  }, []);

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchSelectedPet();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClinics();
    await fetchSelectedPet();
    setRefreshing(false);
  };

  // Handle clinic card press to open modal
  const handleCardPress = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setModalVisible(true);
    setCarouselIndex(0);
    setIsDescriptionExpanded(false);
    
    // Reset scroll position when modal opens
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
        scrollIndicatorOpacity.setValue(1);
      }
    }, 300);
  };

  // Navigate to map view
  const handleViewOnMap = () => {
    if (!selectedClinic) return;
    
    setModalVisible(false);
    navigation.navigate('MapScreen', { 
      clinic_id: selectedClinic.id,
    });
  };

  // Navigate to make appointment screen
  const handleMakeAppointment = () => {
    if (!selectedClinic) return;

    const clinic_time_slots = selectedClinic.clinic_time_slots;
    const openingTime = selectedClinic.opening_time;
    const closingTime = selectedClinic.closing_time;
    
    setModalVisible(false);
    navigation.navigate('MakeAppointment', { 
      clinic_id: selectedClinic.id,
      clinic_time_slots,
      openingTime,
      closingTime
    });
  };

  // Handle modal close
  const handleModalClose = () => {
    setModalVisible(false);
    setIsDescriptionExpanded(false);
  };

  // Handle carousel scroll to track current index
  const handleCarouselScroll = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setCarouselIndex(newIndex);
  };

  // Toggle description expansion
  const toggleDescription = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };

  // Handle scroll events for animation
  const handleScroll = (event: any) => {
    try {
      if (!event?.nativeEvent) return;
      
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      
      // Ensure we have valid values
      const layoutHeight = layoutMeasurement?.height || 0;
      const contentOffsetY = contentOffset?.y || 0;
      const contentHeight = contentSize?.height || 0;
      
      const paddingToBottom = 20;
      const isCloseToBottom = layoutHeight + contentOffsetY >= contentHeight - paddingToBottom;
      
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

  // Update scroll indicator when content size changes
  const checkScrollability = () => {
    // Always enable scrolling and show indicator initially
    Animated.timing(scrollIndicatorOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Add a function to check if a clinic is currently open
  const isClinicOpenNow = (clinic: Clinic): { isOpen: boolean; is24Hours: boolean } => {
    // Check if clinic is open 24/7
    if (clinic.is_open_24_7 === 'yes') {
      return { isOpen: true, is24Hours: true };
    }
    
    // Get current time
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if clinic is open on current day
    if (clinic.available_days && !clinic.available_days[currentDay]) {
      return { isOpen: false, is24Hours: false };
    }
    
    // Parse operating hours
    try {
      if (!clinic.opening_time || !clinic.closing_time) {
        return { isOpen: false, is24Hours: false };
      }
      
      // Create date objects for opening and closing times
      const [openHour, openMinute] = clinic.opening_time.split(':').map(Number);
      const [closeHour, closeMinute] = clinic.closing_time.split(':').map(Number);
      
      const openTime = new Date();
      openTime.setHours(openHour, openMinute, 0);
      
      const closeTime = new Date();
      closeTime.setHours(closeHour, closeMinute, 0);
      
      // Check if current time is between opening and closing time
      return { 
        isOpen: now >= openTime && now <= closeTime,
        is24Hours: false
      };
    } catch (error) {
      console.error('Error parsing clinic hours:', error);
      return { isOpen: false, is24Hours: false };
    }
  };

  // Render a clinic card
  const renderClinicCard = ({ item, index }: { item: Clinic & { distance?: number }, index: number }) => {
    const firstPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : null;
    const animationDelay = index * 100; // Staggered animation effect
    const { isOpen } = isClinicOpenNow(item);
    
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
          {/* Card Image */}
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
            
            {/* Rating Badge */}
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
            
            {/* Video Meeting Badge */}
            {item.allows_video_meetings && (
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={12} color="#fff" />
              </View>
            )}

            {/* Open/Closed Status Badge */}
            <View style={[
              styles.cardStatusBadge, 
              isOpen ? styles.cardOpenBadge : styles.cardClosedBadge
            ]}>
              <Text style={[
                styles.cardStatusText,
                { color: isOpen ? '#4CAF50' : '#F44336' }
              ]}>
                {isOpen ? 'Open' : 'Closed'}
              </Text>
            </View>
            
            {/* 24/7 Badge */}
            {item.is_open_24_7 === 'yes' && (
              <View style={styles.card24_7Badge}>
                <Ionicons name="time" size={12} color="#fff" />
                <Text style={styles.card24_7Text}>24/7</Text>
              </View>
            )}

            {/* Emergency Distance Badge */}
            {isEmergencyMode && item.distance !== undefined && (
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate" size={12} color="#fff" />
                <Text style={styles.distanceText}>
                  {item.distance < 1 
                    ? `${(item.distance * 1000).toFixed(0)}m` 
                    : `${item.distance.toFixed(1)}km`}
                </Text>
              </View>
            )}
          </View>
          
          {/* Card Content */}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.cardDetails}>
              <Ionicons name="location-outline" size={14} color="#6c63ff" />
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item.location?.address || 'No address provided'}
              </Text>
            </View>
            {item.type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
            )}
            
            {/* Show nearest clinic badge */}
            {isEmergencyMode && nearestClinic?.id === item.id && (
              <View style={styles.nearestBadge}>
                <Text style={styles.nearestText}>Nearest Clinic</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  // Render empty state when no clinics match the search
  const renderEmptyState = () => (
    <View style={styles.emptyListContainer}>
      <Ionicons name="search-outline" size={80} color="#e0e0ff" />
      <Text style={styles.emptyListText}>No clinics found</Text>
      <Text style={styles.emptyListSubtext}>Try a different search term</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Header */}
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Petlyst</Text>
        <Text style={styles.headerSubtitle}>
          {isEmergencyMode ? 'Emergency Mode - Nearest Clinics' : bestFor}
        </Text>
        
        {/* Search Bar with Emergency Button */}
        <View style={styles.searchContainer}>
          {/* Emergency Button */}
          <TouchableOpacity 
            style={[
              styles.emergencyButton, 
              isEmergencyMode && styles.emergencyButtonActive
            ]}
            onPress={isEmergencyMode ? exitEmergencyMode : handleEmergency}
          >
            <Ionicons 
              name={isEmergencyMode ? "close-circle" : "alert-circle"} 
              size={20} 
              color={isEmergencyMode ? "#fff" : "#ff4757"} 
            />
          </TouchableOpacity>

          <Ionicons name="search" size={20} color="#8b8b8b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={isEmergencyMode ? "Finding nearest clinics..." : "Search clinics, services..."}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8b8b8b"
            editable={!isEmergencyMode}
          />
          {searchQuery.length > 0 && !isEmergencyMode && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#8b8b8b" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Emergency Mode Banner */}
      {isEmergencyMode && (
        <Animatable.View 
          animation="fadeIn" 
          style={styles.emergencyBanner}
        >
          <Ionicons name="information-circle-outline" size={18} color="#fff" />
          <Text style={styles.emergencyBannerText}>
            Showing clinics sorted by distance to your location
          </Text>
        </Animatable.View>
      )}

      {/* Clinics Grid */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>Loading clinics...</Text>
        </View>
      ) : (
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
                onRefresh={handleRefresh}
                colors={['#6c63ff']}
                tintColor={'#6c63ff'}
              />
            }
            ListEmptyComponent={renderEmptyState}
          />
        </View>
      )}

      {/* Clinic Detail Modal */}
      {selectedClinic && (
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={handleModalClose}
        >
          <View style={styles.modalContainer}>
            {/* Top Header with Close Button */}
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
              {selectedClinic.photos && selectedClinic.photos.length > 0 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {carouselIndex + 1}/{selectedClinic.photos.length}
                  </Text>
                </View>
              )}
            </LinearGradient>

            {/* Image Carousel */}
            <View style={styles.carouselContainer}>
              {selectedClinic.photos && selectedClinic.photos.length > 0 ? (
                <>
                  <FlatList
                    data={selectedClinic.photos}
                    keyExtractor={(photo) => String(photo.photo_id)}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleCarouselScroll}
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
                          index === carouselIndex && styles.activeDot,
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

            {/* Bottom Card: Clinic Details */}
            <View style={styles.bottomCardContainer}>
              <ScrollView 
                ref={scrollViewRef}
                style={styles.bottomCard} 
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onContentSizeChange={checkScrollability}
                onLayout={checkScrollability}
                contentContainerStyle={styles.scrollContentContainer}
                bounces={true}
              >
                {/* Clinic Header */}
                <View style={styles.clinicHeaderRow}>
                  <View style={styles.clinicTitleContainer}>
                    <Text style={styles.modalTitle}>{selectedClinic.name}</Text>
                    <Text style={styles.clinicType}>
                      {selectedClinic.type || 'Veterinary Clinic'}
                    </Text>
                  </View>
                  
                  <View style={styles.clinicStatusContainer}>
                    {/* Clinic Status Indicator */}
                    {(() => {
                      const { isOpen, is24Hours } = isClinicOpenNow(selectedClinic);
                      return (
                        <View style={[
                          styles.modalStatusIndicator, 
                          isOpen ? styles.modalOpenIndicator : styles.modalClosedIndicator
                        ]}>
                          <View style={[
                            styles.statusDot,
                            { backgroundColor: isOpen ? '#4CAF50' : '#F44336' }
                          ]} />
                          <Text style={[
                            styles.statusText,
                            { color: isOpen ? '#4CAF50' : '#F44336' }
                          ]}>
                            {isOpen ? 'Open Now' : 'Closed'}
                          </Text>
                        </View>
                      );
                    })()}
                    
                    {/* 24/7 Badge */}
                    {selectedClinic.is_open_24_7 === 'yes' && (
                      <View style={styles.modalBadge24_7}>
                        <Ionicons name="time" size={14} color="#fff" />
                        <Text style={styles.badge24_7Text}>24/7</Text>
                      </View>
                    )}
                    
                    {/* Rating Badge */}
                    {selectedClinic.average_rating ? (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={styles.ratingValue}>
                          {selectedClinic.average_rating.toFixed(1)}
                        </Text>
                        <Text style={styles.reviewCount}>
                          {`(${selectedClinic.total_reviews || 0})`}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.noRatingContainer}>
                        <Ionicons name="star-outline" size={20} color="#aaa" />
                        <Text style={styles.noRatingText}>No reviews yet</Text>
                      </View>
                    )}
                  </View>
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
                  
                  {/* Address */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="location-outline" size={20} color="#6c63ff" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Address</Text>
                      <Text style={styles.infoValue}>
                        {selectedClinic?.location?.province && selectedClinic?.location?.district 
                          ? `${selectedClinic.location.address}, ${selectedClinic.location.district}, ${selectedClinic.location.province}`
                          : selectedClinic?.location?.address || 'Not provided'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Phone */}
                  {selectedClinic.phone_numbers && selectedClinic.phone_numbers.length > 0 && (
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
                  
                  {/* Working Hours */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="time-outline" size={20} color="#6c63ff" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Working Hours</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={styles.infoValue}>
                          {selectedClinic.is_open_24_7 === 'yes'
                            ? '24/7' 
                            : `${selectedClinic.opening_time || ''} - ${selectedClinic.closing_time || ''}`
                          }
                        </Text>
                        {selectedClinic.is_open_24_7 === 'yes' && (
                          <View style={styles.badge24_7Small}>
                            <Text style={styles.badge24_7TextSmall}>24/7</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Add the open/closed indicator specifically to the hours section */}
                      {(() => {
                        const { isOpen } = isClinicOpenNow(selectedClinic);
                        return (
                          <View style={[
                            styles.hourStatusBadge,
                            isOpen ? styles.hourOpenBadge : styles.hourClosedBadge
                          ]}>
                            <Text style={[
                              styles.hourStatusText,
                              { color: isOpen ? '#4CAF50' : '#F44336' }
                            ]}>
                              {isOpen ? 'Open Now' : 'Closed'}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                  
                  {/* Email */}
                  {selectedClinic.email && (
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
                  
                  {/* Services */}
                  {selectedClinic.medical_services && selectedClinic.medical_services.length > 0 && (
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
                  
                  {/* Video Meetings */}
                  {selectedClinic.allows_video_meetings && (
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
                    onPress={handleViewOnMap}
                  >
                    <Ionicons name="map-outline" size={20} color="#6c63ff" />
                    <Text style={styles.secondaryButtonText}>View on Map</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.primaryButton}
                    onPress={handleMakeAppointment}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>
                      Book Appointment
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Bottom padding to ensure content is visible */}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
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
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  searchIcon: {
    marginLeft: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
    marginRight: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    width: CARD_WIDTH,
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
    height: CARD_WIDTH * 0.7,
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
  
  // Modal Styles
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
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
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
    height: CAROUSEL_HEIGHT,
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  carouselImage: {
    width,
    height: '100%',
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
  scrollContentContainer: {
    paddingBottom: 30,
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
  noRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
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
  emergencyButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
  },
  emergencyButtonActive: {
    backgroundColor: '#ff4757',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4757',
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  emergencyBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  nearestBadge: {
    backgroundColor: '#ff4757',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  nearestText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  clinicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  openIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  closedIndicator: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badge24_7: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c63ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    position: 'absolute',
    top: 0,
    right: 80,
    zIndex: 1,
  },
  badge24_7Text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  badge24_7Small: {
    backgroundColor: '#6c63ff', 
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badge24_7TextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardStatusBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  cardOpenBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  cardClosedBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  card24_7Badge: {
    position: 'absolute',
    bottom: 10,
    right: 60,
    backgroundColor: '#6c63ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  card24_7Text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  clinicStatusContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  modalStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  modalOpenIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  modalClosedIndicator: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  modalBadge24_7: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c63ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  hourStatusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  hourOpenBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  hourClosedBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  hourStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
