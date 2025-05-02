import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';

type ClinicData = {
  province: string;
  district: string;
  clinic_address: string;
  latitude: number;
  longitude: number;
};

const MapScreen = ({ route }: { route: any }) => {
  const { clinic_id = '' } = route.params || {};
  const [clinicData, setClinicData] = useState<ClinicData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!clinic_id) {
      setErrorMessage('No clinic ID provided.');
      setLoading(false);
      return;
    }

    const fetchClinicCoordinates = async () => {
      console.log(`Clinic id is: ${clinic_id}`);
      const token = await SecureStore.getItemAsync('userToken');

      if (!token) {
        Alert.alert('Error', 'No token found. Please log in again.');
        return;
      }

      try {
        const response = await fetch(`https://petlyst.com:3001/api/fetch-clinic-coordinates?clinic_id=${clinic_id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // <-- required!
          },
          body: JSON.stringify({ clinic_id }),
        });

        const data = await response.json();

        if (response.ok) {
          // expect: { province, district, clinic_address, latitude, longitude }
          setClinicData(data);
        } else {
          setErrorMessage(data.error || 'Failed to fetch clinic data.');
        }
      } catch (error) {
        console.error('Error fetching clinic data:', error);
        setErrorMessage('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchClinicCoordinates();
  }, [clinic_id]);

  const openMaps = () => {
    if (clinicData) {
      const { latitude, longitude } = clinicData;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url).catch(err => {
        console.error('Error opening maps', err);
        Alert.alert('Error', 'Unable to open map application.');
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading clinic location...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!clinicData) {
    return null; // should never happen
  }

  const { province, district, clinic_address, latitude, longitude } = clinicData;
  const region: Region = {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoCard}>
        <Text style={styles.label}>Province:</Text>
        <Text style={styles.value}>{province}</Text>
        <Text style={styles.label}>District:</Text>
        <Text style={styles.value}>{district}</Text>
        <Text style={styles.label}>Address:</Text>
        <Text style={styles.value}>{clinic_address}</Text>
      </View>

      <MapView style={styles.map} initialRegion={region}>
        <Marker
          coordinate={{ latitude, longitude }}
          title="Clinic Location"
          description={clinic_address}
        />
      </MapView>

      <View style={styles.buttonView}>
        <TouchableOpacity style={styles.button} onPress={openMaps}>
          <Text style={styles.buttonText}>Open in Google Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoCard: {
    padding: 12,
    backgroundColor: '#fff',
    elevation: 2,
    margin: 10,
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  value: {
    fontSize: 16,
    color: '#555',
  },
  map: {
    flex: 1,
    marginHorizontal: 10,
    borderRadius: 8,
  },
  buttonView: {
    padding: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 6,
    width: '90%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default MapScreen;
