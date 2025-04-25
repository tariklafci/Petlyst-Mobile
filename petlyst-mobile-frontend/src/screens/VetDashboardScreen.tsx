import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
type CreationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
type ClinicType = 'GENERAL' | 'SPECIALTY' | 'EMERGENCY';

interface Clinic {
  id: number;
  name: string;
  clinic_email: string;
  clinic_description: string;
  opening_time: string;
  closing_time: string;
  clinic_verification_status: VerificationStatus;
  establishment_year: number;
  show_phone_number: boolean;
  allow_direct_messages: boolean;
  clinic_creation_status: CreationStatus;
  show_email_address: boolean;
  allow_online_meetings: boolean;
  available_days: boolean[];
  clinic_time_slots: number;
  is_open_24_7: boolean;
  clinic_type: ClinicType;
  clinic_address: string;
  slug: string;
}

const VetDashboardScreen = ({ navigation }: { navigation: any }) => {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    fetchClinicId();
  }, []);

  const fetchClinicId = async () => {
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
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Loading your clinic data...</Text>
      </SafeAreaView>
    );
  }

  if (!clinic) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" />
        <Text style={styles.errorText}>Could not load clinic data</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={fetchClinicId}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'VERIFIED': return '#34c759';
      case 'PENDING': return '#ff9500';
      case 'REJECTED': return '#ff3b30';
      default: return '#8e8e93';
    }
  };

  const getClinicTypeIcon = (type: ClinicType) => {
    switch (type) {
      case 'GENERAL': return 'medkit-outline';
      case 'SPECIALTY': return 'fitness-outline';
      case 'EMERGENCY': return 'alert-circle-outline';
      default: return 'medical-outline';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.clinicName}>{clinic.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(clinic.clinic_verification_status) }]}>
            <Text style={styles.statusText}>{clinic.clinic_verification_status}</Text>
          </View>
        </View>

        {/* Clinic Type & Year */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={getClinicTypeIcon(clinic.clinic_type)} size={24} color="#4285F4" />
            <Text style={styles.cardTitle}>Clinic Information</Text>
          </View>
          <View style={styles.cardDivider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Clinic Type:</Text>
            <Text style={styles.infoValue}>{clinic.clinic_type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Established:</Text>
            <Text style={styles.infoValue}>{clinic.establishment_year}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={styles.infoValue}>{clinic.clinic_creation_status}</Text>
          </View>
        </View>

        {/* Contact & Address */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={24} color="#4285F4" />
            <Text style={styles.cardTitle}>Contact & Location</Text>
          </View>
          <View style={styles.cardDivider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{clinic.clinic_email}</Text>
          </View>
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>Address:</Text>
            <Text style={styles.addressValue}>{clinic.clinic_address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Show Email:</Text>
            <Text style={styles.infoValue}>{clinic.show_email_address ? 'Yes' : 'No'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Show Phone:</Text>
            <Text style={styles.infoValue}>{clinic.show_phone_number ? 'Yes' : 'No'}</Text>
          </View>
        </View>

        {/* Hours & Availability */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={24} color="#4285F4" />
            <Text style={styles.cardTitle}>Hours & Availability</Text>
          </View>
          <View style={styles.cardDivider} />
          
          {clinic.is_open_24_7 ? (
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
          
          <Text style={styles.daysLabel}>Available Days:</Text>
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
        </View>

        {/* Services & Features */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="options-outline" size={24} color="#4285F4" />
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
            <Text style={styles.infoValue}>{clinic.clinic_time_slots} per day</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={24} color="#4285F4" />
            <Text style={styles.cardTitle}>About Our Clinic</Text>
          </View>
          <View style={styles.cardDivider} />
          <Text style={styles.description}>{clinic.clinic_description}</Text>
        </View>

        {/* Edit Button */}
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.editButtonText}>Edit Clinic Details</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7'
  },
  container: {
    flex: 1,
    padding: 16
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
  errorText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  clinicName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1c1c1e',
    flex: 1
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 10
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
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
  open24Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34c759',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
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
    backgroundColor: '#4285F4'
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
  editButton: {
    backgroundColor: '#4285F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginVertical: 16
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  }
});

export default VetDashboardScreen;