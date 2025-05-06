import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Image,
  RefreshControl,
  ToastAndroid,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

type VerificationStatus = 'pending' | 'archived' | 'active' | 'verified' | 'pending submission' | 'not_verified' | 'rejected';
type CreationStatus = 'complete' | 'incomplete';
type ClinicType = 'veterinary_clinic' | 'animal_hospital';
type PhoneType = 'mobile' | 'landline' | 'emergency' | 'whatsapp';

interface SocialMedia {
  platform: string;
  url: string;
}

interface PhoneNumber {
  number: string;
  type: PhoneType;
}

interface ClinicPhoto {
  photo_id: number;
  s3_url: string;
  presigned_url?: string;
}

interface ClinicLocation {
  province: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Clinic {
  id: number;
  name: string;
  email: string;
  description: string;
  opening_time: string;
  closing_time: string;
  verification_status: VerificationStatus;
  establishment_year: number;
  show_phone_number: boolean;
  allow_direct_messages: boolean;
  clinic_creation_status: CreationStatus;
  show_mail_address: boolean;
  allow_online_meetings: boolean;
  available_days: boolean[];
  emergency_available_days: boolean[];
  clinic_time_slots: number | { number: number; type: string };
  is_open_24_7: boolean;
  type: ClinicType;
  address: string;
  slug: string;
  phone_numbers: PhoneNumber[];
  social_media: SocialMedia[];
  photos: ClinicPhoto[];
  location: ClinicLocation;
  medical_services: string[];
  average_rating: number | null;
  total_reviews: number;
}

const VetDashboardScreen = ({ navigation }: { navigation: any }) => {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    fetchClinicData();
  }, []);

  const fetchClinicData = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      const veterinarian_id = await SecureStore.getItemAsync('userId');
  
      if (!token) {
        return;
      }
  
      // Step 1: Get the clinic_id for this veterinarian
      const clinicRes = await fetch(`https://petlyst.com:3001/api/fetch-clinic-veterinarian?veterinarian_id=${veterinarian_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
  
      const clinicData = await clinicRes.json();
  
      if (!clinicRes.ok) {
        throw new Error(clinicData.error || 'Failed to fetch clinic id');
      }
  
      const clinic_id = clinicData.clinic_id;
  
      // Step 2: Fetch all clinics
      const allClinicsRes = await fetch('https://petlyst.com:3001/api/fetch-clinics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
  
      const allClinics = await allClinicsRes.json();
  
      if (!allClinicsRes.ok) {
        throw new Error(allClinics.error || 'Failed to fetch clinics');
      }
  
      // Step 3: Find the clinic that matches the id
      const myClinic = allClinics.find((clinic: Clinic) => clinic.id === clinic_id);
  
      if (!myClinic) {
        throw new Error('Clinic not found for this veterinarian');
      }
  
      setClinic(myClinic);
    } catch (err: any) {
      console.error('Error fetching clinic info:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchClinicData();
  };

  const getTimeSlotText = (timeSlot: any): string => {
    if (timeSlot === null || timeSlot === undefined) {
      return 'Not available';
    }
    
    if (typeof timeSlot === 'number') {
      return `${timeSlot} minutes per appointment`;
    }
    
    if (typeof timeSlot === 'object' && timeSlot !== null) {
      // Handle the object with keys {number, type}
      return `${(timeSlot as any).number || 0} minutes per appointment`;
    }
    
    return 'Not available';
  };

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'verified': return '#34c759';
      case 'pending': return '#ff9500';
      case 'rejected': return '#ff3b30';
      default: return '#8e8e93';
    }
  };

  const getClinicTypeIcon = (type: ClinicType) => {
    switch (type) {
      case 'animal_hospital': return 'medkit-outline';
      case 'veterinary_clinic': return 'fitness-outline';
      default: return 'medical-outline';
    }
  };

  const getPhoneTypeIcon = (type: PhoneType) => {
    switch (type) {
      case 'mobile': return 'phone-portrait-outline';
      case 'landline': return 'call-outline';
      case 'emergency': return 'alert-circle-outline';
      case 'whatsapp': return 'logo-whatsapp';
      default: return 'call-outline';
    }
  };

  const getSocialIcon = (platform: string): keyof typeof Ionicons.glyphMap => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('facebook')) return 'logo-facebook';
    if (platformLower.includes('instagram')) return 'logo-instagram';
    if (platformLower.includes('twitter') || platformLower.includes('x')) return 'logo-twitter';
    if (platformLower.includes('linkedin')) return 'logo-linkedin';
    if (platformLower.includes('youtube')) return 'logo-youtube';
    if (platformLower.includes('tiktok')) return 'logo-tiktok';
    if (platformLower.includes('website')) return 'globe-outline';
    return 'link-outline';
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedText(text);
    
    // Show feedback based on platform
    if (Platform.OS === 'android') {
      ToastAndroid.show(`${label} copied to clipboard`, ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied', `${label} copied to clipboard`);
    }
  };

  const callPhoneNumber = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const openUrl = (url: string) => {
    // Make sure the URL has a protocol prefix
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(finalUrl).catch(err => {
      console.error('Error opening URL:', err);
      Alert.alert('Error', 'Could not open the URL');
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={styles.loadingText}>Loading your clinic data...</Text>
      </SafeAreaView>
    );
  }

  if (!clinic) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
        <Animatable.View animation="fadeIn" duration={800} style={styles.errorContent}>
          <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" />
          <Text style={styles.errorText}>Could not load clinic data</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchClinicData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </Animatable.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
      
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{clinic.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(clinic.verification_status) }]}>
            <Text style={styles.statusText}>{clinic.verification_status}</Text>
          </View>
        </View>

        {clinic.photos && clinic.photos.length > 0 && (
          <Animatable.View animation="fadeIn" duration={800} style={styles.photoBanner}>
            <Image 
              source={{ uri: clinic.photos[0].presigned_url || clinic.photos[0].s3_url }} 
              style={styles.clinicPhoto}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.photoBannerGradient}
            />
          </Animatable.View>
        )}
      </LinearGradient>
      
      <Animatable.View 
        animation="fadeInUp"
        duration={800}
        style={styles.contentContainer}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6c63ff']}
            />
          }
        >
          {/* Clinic Type & Year */}
          <Animatable.View animation="fadeInUp" delay={100} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name={getClinicTypeIcon(clinic.type)} size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>Clinic Information</Text>
              </View>
              <View style={styles.cardDivider} />
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Clinic Type:</Text>
                <Text style={styles.infoValue}>
                  {clinic.type === 'animal_hospital' ? 'Animal Hospital' : 'Veterinary Clinic'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Established:</Text>
                <Text style={styles.infoValue}>{clinic.establishment_year}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text style={styles.infoValue}>{clinic.clinic_creation_status}</Text>
              </View>

              {clinic.average_rating !== null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rating:</Text>
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>{clinic.average_rating.toFixed(1)}</Text>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.reviewsText}>({clinic.total_reviews} reviews)</Text>
                  </View>
                </View>
              )}
            </View>
          </Animatable.View>

          {/* Contact & Address */}
          <Animatable.View animation="fadeInUp" delay={200} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="location-outline" size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>Contact & Location</Text>
              </View>
              <View style={styles.cardDivider} />
              
              {clinic.email && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>{clinic.email}</Text>
                </View>
              )}

              <View style={styles.addressBox}>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <Text style={styles.addressLabel}>Address:</Text>
                  {copiedText === (clinic.location?.address || clinic.address) && (
                    <Text style={{fontSize: 12, color: '#6c63ff'}}>Copied</Text>
                  )}
                </View>
                <TouchableOpacity
                  onLongPress={() => copyToClipboard(clinic.location?.address || clinic.address, 'Address')}
                  style={styles.addressTouchable}
                >
                  <Text style={styles.addressValue}>
                    {clinic.location?.address || clinic.address}
                  </Text>
                  {clinic.location?.province && (
                    <Text style={styles.addressSubValue}>
                      {clinic.location.district}, {clinic.location.province}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Show Email:</Text>
                <Text style={styles.infoValue}>{clinic.show_mail_address ? 'Yes' : 'No'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Show Phone:</Text>
                <Text style={styles.infoValue}>{clinic.show_phone_number ? 'Yes' : 'No'}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => navigation.navigate('MapScreen', { clinic_id: clinic.id })}
              >
                <Ionicons name="map-outline" size={18} color="#6c63ff" />
                <Text style={styles.mapButtonText}>View on Map</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>

          {/* Phone Numbers */}
          <Animatable.View animation="fadeInUp" delay={300} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="call-outline" size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>Phone Numbers</Text>
              </View>
              <View style={styles.cardDivider} />
              
              {clinic.phone_numbers && clinic.phone_numbers.length > 0 ? (
                clinic.phone_numbers.map((phone, index) => (
                  <View key={index} style={styles.phoneRow}>
                    <View style={styles.phoneType}>
                      <Ionicons name={getPhoneTypeIcon(phone.type)} size={20} color="#6c63ff" />
                      <Text style={styles.phoneTypeText}>{phone.type}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.phoneNumberButton}
                    >
                      <Text style={styles.phoneNumberText}>{phone.number}</Text>
                      <Ionicons 
                        name={copiedText === phone.number ? "copy-outline" : "call-outline"} 
                        size={16} 
                        color="#6c63ff" 
                      />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMessage}>No phone numbers available</Text>
              )}
            </View>
          </Animatable.View>

          {/* Social Media */}
          <Animatable.View animation="fadeInUp" delay={400} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="globe-outline" size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>Social Media</Text>
              </View>
              <View style={styles.cardDivider} />
              
              {clinic.social_media && clinic.social_media.length > 0 ? (
                clinic.social_media.map((social, index) => (
                  <View key={index} style={styles.socialRow}>
                    <View style={styles.socialPlatform}>
                      <Ionicons 
                        name={getSocialIcon(social.platform)} 
                        size={22} 
                        color="#6c63ff" 
                      />
                      <Text style={styles.socialName}>{social.platform}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.socialLink}
                      onPress={() => openUrl(social.url)}
                      onLongPress={() => copyToClipboard(social.url, 'URL')}
                    >
                      <Text style={styles.socialLinkText} numberOfLines={1} ellipsizeMode="tail">
                        {social.url}
                      </Text>
                      <Ionicons 
                        name={copiedText === social.url ? "copy-outline" : "open-outline"} 
                        size={18} 
                        color="#6c63ff" 
                      />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMessage}>No social media accounts available</Text>
              )}
            </View>
          </Animatable.View>

          {/* Hours & Availability */}
          <Animatable.View animation="fadeInUp" delay={500} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>Hours & Availability</Text>
              </View>
              <View style={styles.cardDivider} />
              
              {clinic.is_open_24_7 === true ? (
                <View style={styles.open24Badge}>
                  <Ionicons name="time" size={20} color="#fff" />
                  <Text style={styles.open24Text}>Open 24/7</Text>
                </View>
              ) : (
                <View style={styles.hoursContainer}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Opening:</Text>
                    <Text style={styles.infoValue}>{clinic.opening_time}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Closing:</Text>
                    <Text style={styles.infoValue}>{clinic.closing_time}</Text>
                  </View>
                </View>
              )}
              
              <Text style={styles.daysLabel}>Regular Days:</Text>
              <View style={styles.daysRow}>
                {daysOfWeek.map((day, i) => (
                  <View 
                    key={day} 
                    style={[
                      styles.dayBox,
                      clinic.available_days[i] ? styles.dayBoxSelected : styles.dayBoxUnselected
                    ]}
                  >
                    <Text style={clinic.available_days[i] ? styles.dayTextSelected : styles.dayTextUnselected}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {clinic.emergency_available_days && (
                <>
                  <Text style={[styles.daysLabel, {marginTop: 16}]}>Emergency Days:</Text>
                  <View style={styles.daysRow}>
                    {daysOfWeek.map((day, i) => (
                      <View 
                        key={`emergency-${day}`} 
                        style={[
                          styles.dayBox,
                          clinic.emergency_available_days[i] ? styles.emergencyDayBoxSelected : styles.dayBoxUnselected
                        ]}
                      >
                        <Text style={clinic.emergency_available_days[i] ? styles.dayTextSelected : styles.dayTextUnselected}>
                          {day}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </Animatable.View>

          {/* Medical Services */}
          {clinic.medical_services && clinic.medical_services.length > 0 && (
            <Animatable.View animation="fadeInUp" delay={550} duration={500}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="medkit-outline" size={24} color="#6c63ff" />
                  <Text style={styles.cardTitle}>Medical Services</Text>
                </View>
                <View style={styles.cardDivider} />
                
                <View style={styles.servicesContainer}>
                  {clinic.medical_services.map((service, index) => (
                    <View key={index} style={styles.serviceTag}>
                      <Text style={styles.serviceText}>{service}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animatable.View>
          )}

          {/* Services & Features */}
          <Animatable.View animation="fadeInUp" delay={600} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="options-outline" size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>Features</Text>
              </View>
              <View style={styles.cardDivider} />
              
              <View style={styles.featureRow}>
                <View style={styles.feature}>
                  <Ionicons 
                    name={clinic.allow_direct_messages ? "checkmark-circle" : "close-circle"} 
                    size={24} 
                    color={clinic.allow_direct_messages ? "#34c759" : "#ff3b30"} 
                  />
                  <Text style={styles.featureText}>Direct Messages</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons 
                    name={clinic.allow_online_meetings ? "checkmark-circle" : "close-circle"} 
                    size={24} 
                    color={clinic.allow_online_meetings ? "#34c759" : "#ff3b30"} 
                  />
                  <Text style={styles.featureText}>Online Meetings</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Time Slots:</Text>
                <Text style={styles.infoValue}>
                  {getTimeSlotText(clinic.clinic_time_slots)}
                </Text>
              </View>
            </View>
          </Animatable.View>

          {/* Description */}
          <Animatable.View animation="fadeInUp" delay={700} duration={500}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle-outline" size={24} color="#6c63ff" />
                <Text style={styles.cardTitle}>About Our Clinic</Text>
              </View>
              <View style={styles.cardDivider} />
              <Text style={styles.description}>{clinic.description}</Text>
            </View>
          </Animatable.View>

          {/* Action Buttons */}
          <Animatable.View animation="fadeInUp" delay={800} duration={500} style={styles.actionButtonsContainer}>
            <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
              <LinearGradient
                colors={['#6c63ff', '#3b5998']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Edit Details</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.inventoryButton]}
              onPress={() => navigation.navigate('InventoryScreen')}
            >
              <LinearGradient
                colors={['#34c759', '#28a745']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="list-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Inventory</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>

          {/* Additional Actions */}
          <Animatable.View animation="fadeInUp" delay={850} duration={500} style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.patientsButton]}
              onPress={() => navigation.navigate('ClinicPet')}
            >
              <LinearGradient
                colors={['#ff9500', '#ff7f50']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="paw-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Clinic Patients</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </Animatable.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7'
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  photoBanner: {
    marginTop: 15,
    height: 150,
    marginHorizontal: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  clinicPhoto: {
    width: '100%',
    height: '100%',
  },
  photoBannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  contentContainer: {
    flex: 1,
    marginTop: -20,
    backgroundColor: '#f5f5f7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8e8e93'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    padding: 20
  },
  errorContent: {
    alignItems: 'center',
  },
  errorText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#6c63ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginLeft: 8
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#e6e6e6',
    marginVertical: 8
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  infoLabel: {
    fontSize: 15,
    color: '#8e8e93',
    flex: 1
  },
  infoValue: {
    fontSize: 15,
    color: '#1c1c1e',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right'
  },
  addressBox: {
    paddingVertical: 8
  },
  addressLabel: {
    fontSize: 15,
    color: '#8e8e93',
    marginBottom: 4
  },
  addressValue: {
    fontSize: 15,
    color: '#1c1c1e',
    lineHeight: 22
  },
  addressSubValue: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f5',
    borderRadius: 10,
    padding: 10,
    marginTop: 10
  },
  mapButtonText: {
    color: '#6c63ff',
    marginLeft: 6,
    fontWeight: '500'
  },
  phoneRow: {
    marginVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8
  },
  phoneType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  phoneTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1c1e',
    marginLeft: 8,
    textTransform: 'capitalize'
  },
  phoneNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    padding: 12,
    marginTop: 4
  },
  phoneNumberText: {
    fontSize: 15,
    color: '#6c63ff',
    fontWeight: '500'
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginRight: 4,
  },
  reviewsText: {
    fontSize: 14,
    color: '#8e8e93',
    marginLeft: 8,
  },
  open24Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34c759',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginVertical: 8
  },
  open24Text: {
    color: 'white',
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14
  },
  hoursContainer: {
    marginVertical: 4
  },
  daysLabel: {
    fontSize: 15,
    color: '#8e8e93',
    marginTop: 12,
    marginBottom: 8
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  dayBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dayBoxSelected: {
    backgroundColor: '#6c63ff'
  },
  emergencyDayBoxSelected: {
    backgroundColor: '#ff9500'
  },
  dayBoxUnselected: {
    backgroundColor: '#f2f2f7'
  },
  dayTextSelected: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13
  },
  dayTextUnselected: {
    color: '#8e8e93',
    fontSize: 13
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8
  },
  serviceTag: {
    backgroundColor: '#f0f0f5',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4
  },
  serviceText: {
    color: '#1c1c1e',
    fontSize: 14
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  featureText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#1c1c1e'
  },
  description: {
    fontSize: 15,
    color: '#1c1c1e',
    lineHeight: 22,
    paddingVertical: 4
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  editButton: {
    marginRight: 8,
    shadowColor: '#6c63ff',
  },
  inventoryButton: {
    marginLeft: 8,
    shadowColor: '#34c759',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  emptyMessage: {
    fontSize: 15,
    color: '#8e8e93',
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center'
  },
  socialRow: {
    marginVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8
  },
  socialPlatform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  socialName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1c1e',
    marginLeft: 8,
    textTransform: 'capitalize'
  },
  socialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    padding: 8,
    marginTop: 4
  },
  socialLinkText: {
    fontSize: 14,
    color: '#6c63ff',
    flex: 1,
    marginRight: 4
  },
  addressTouchable: {
    paddingVertical: 6,
  },
  patientsButton: {
    marginLeft: 8,
    shadowColor: '#ff9500',
  },
});

export default VetDashboardScreen;