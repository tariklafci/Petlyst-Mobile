import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, View, StyleSheet } from 'react-native';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinic_id) {
      Alert.alert('Error', 'No clinic ID provided.');
      return;
    }

    const fetchClinicCoordinates = async () => {
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
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          const latitude = parseFloat(data.latitude);
          const longitude = parseFloat(data.longitude);

          if (isNaN(latitude) || isNaN(longitude)) {
            Alert.alert('Error', 'Invalid coordinates received.');
            return;
          }

          const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
          Linking.openURL(url).catch(err => {
            console.error('Error opening maps', err);
            Alert.alert('Error', 'Unable to open map application.');
          });
        } else {
          Alert.alert('Error', data.error || 'Failed to fetch clinic location.');
        }
      } catch (error) {
        console.error('Error fetching clinic data:', error);
        Alert.alert('Error', 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchClinicCoordinates();
  }, [clinic_id]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#007bff" />
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MapScreen;
