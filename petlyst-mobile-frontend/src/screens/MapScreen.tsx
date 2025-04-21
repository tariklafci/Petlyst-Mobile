import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';

const MapScreen = ({ route }: { route: any}) => {
  const { address = '' } = route.params || {}; // Default to empty string
  const [location, setLocation] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!address) {
      setErrorMessage('No address provided.');
      return;
    }

    const fetchCoordinates = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setErrorMessage('Location permissions denied.');
        return;
      }

      const coords = await getCoordinates(address);
      if (coords) {
        setLocation(coords);
      } else {
        setErrorMessage('Unable to fetch coordinates.');
      }
    };

    fetchCoordinates();
  }, [address]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return false;
    }
    return true;
  };

  const openMaps = () => {
    if (location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
      Linking.openURL(url).catch(err => console.error('Error opening maps', err));
    } else {
      console.warn('Location not available yet.');
    }
  };

  async function getCoordinates(address) {
    try {
      const [location] = await Location.geocodeAsync(address);
      return location; // Return the location object
    } catch (error) {
      console.warn('Error fetching coordinates:', error);
    }
  }

  const latitudeDelta = 0.0922;
  const longitudeDelta = 0.0421;

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta,
            longitudeDelta,
          }}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Clinic Location"
            description="This is the clinic location"
          />
        </MapView>
      ) : (
        <Text style={styles.loadingText}>Fetching location...</Text>
      )}

      <View style={styles.buttonView}>
        <TouchableOpacity style={styles.button} onPress={openMaps}>
          <Text style={styles.text}>Take Address Descriptor</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '80%',
  },
  buttonView: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    width: '90%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 18,
    color: 'gray',
  },
  errorText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 18,
    color: 'red',
  },
});

export default MapScreen;
