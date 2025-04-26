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
  Alert
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

interface Owner {
  name: string;
  phone?: string;
}

interface Clinic {
  id: number;
  name: string;
  address: string;
}

interface Appointment {
  id: number;
  date: string;          // formatted date
  rawDate: string;       // ISO string
  startTime: string;
  endTime: string;
  status: string;
  isVideoMeeting: boolean;
  notes: string;
  pet: Pet;
  owner: Owner;
  clinic: Clinic;
}

interface ApiResponse {
  appointments?: Appointment[];
  error?: string;
}


const { width } = Dimensions.get('window');

const VetAppointmentScreen = ({ navigation }: { navigation: any }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vetId = 25;

  const fetchVetAppointments = async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync('userToken');      
      if (!token) throw new Error('No auth token.');
      
      // Set veterinarian ID from SecureStore
     

      if (!vetId) {
        setError('Veterinarian ID not found.');
        setIsLoading(false);
        return;
      }

      // 1) fetch your clinic relations
      const relRes = await fetch(
        `https://petlyst.com:3001/api/fetch-clinic-veterinarian?veterinarian_id=${vetId}`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (!relRes.ok) {
        const errorData = await relRes.json();
        throw new Error(errorData.error || 'Failed to load clinic relations');
      }
      
      const relData = await relRes.json();
      const clinicId = relData.clinic_id;
      console.log(`{clinicId}`);

      if (!clinicId) {
        setAppointments([]);
        setError('No clinics assigned to you.');
        setIsLoading(false);
        return;
      }

      console.log('clinicId being sent:', clinicId);
      // 2) fetch ALL appointments, then filter client-side
      const apptRes = await fetch(
        `https://petlyst.com:3001/api/fetch-appointments-clinics?clinicId=${clinicId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      const apptData: ApiResponse = await apptRes.json();
      
      if (!apptRes.ok) {
        throw new Error(apptData.error || 'Failed to load appointments');
      }

      // filter by clinic_id
      const myAppointments = (apptData.appointments || []).filter(a => {
        return Number(a.clinic.id) === Number(clinicId);
      });

      setAppointments(myAppointments);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading appointments.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchVetAppointments();
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchVetAppointments();
    }, [vetId])
  );

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    // Create badge style based on status
    const badgeStyle = {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor:
        item.status === 'pending' ? '#f39c12' :
        item.status === 'confirmed' ? '#27ae60' :
        '#3498db'
    };

    // Create text style based on status
    const textStyle = {
      color: '#fff',
      fontWeight: '500' as const,
      fontSize: 12
    };

    return (
      <TouchableOpacity style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="people-circle-outline" size={24} color="#007bff" />
          <View style={styles.headerText}>
            <Text style={styles.clinicName}>{item.clinic.name}</Text>
            <Text style={styles.appointmentDate}>
              {item.date} • {item.startTime}-{item.endTime}
            </Text>
          </View>
          {item.isVideoMeeting && (
            <Ionicons name="videocam-outline" size={20} color="#007bff" />
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Image
            source={
              item.pet.photo
                ? { uri: item.pet.photo }
                : require('../../assets/splash-icon.png')
            }
            style={styles.petImage as any}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.petName}>{item.pet.name}</Text>
            <Text style={styles.petBreed}>
              {item.pet.species} • {item.pet.breed}
            </Text>
            <Text style={styles.ownerName}>Owner: {item.owner.name}</Text>
          </View>
          <View style={badgeStyle}>
            <Text style={textStyle}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {item.notes ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Loading appointments…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={appointments}
      renderItem={renderAppointmentCard}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={['#007bff']}
          tintColor="#007bff"
        />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={80} color="#ccc" />
          <Text style={{ marginTop: 16 }}>No appointments yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerText: {
    flex: 1,
    marginLeft: 12
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '600'
  },
  appointmentDate: {
    fontSize: 14,
    color: '#555'
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0'
  },
  petName: {
    fontSize: 15,
    fontWeight: '500'
  },
  petBreed: {
    fontSize: 13,
    color: '#777'
  },
  ownerName: {
    fontSize: 13,
    color: '#777',
    marginTop: 4
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4
  },
  notesText: {
    fontSize: 14,
    color: '#555'
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16
  },
  retryBtn: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryText: {
    color: '#fff',
    fontSize: 16
  }
});

export default VetAppointmentScreen;