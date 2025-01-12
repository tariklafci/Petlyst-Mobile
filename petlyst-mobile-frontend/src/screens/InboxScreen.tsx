import React from 'react';
import { Text, Alert, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

const InboxScreen = ({ navigation }: { navigation: any }) => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Success', 'You are now signed out!');
    } catch (error) {
      console.error('Error signing out!', error);
    }
  };

  const handleMeeting = async () => {
    try {
      let room_number = 10;
      navigation.navigate('Meeting', {
        room: room_number,
      });
    } catch (error) {
      console.error('Error joining meeting!', error)
    }
  }

  
    return (
      <View style={styles.view}>
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={styles.text} >Sign Out</Text>
      </TouchableOpacity>
      {/* <TouchableOpacity onPress={() => handleMeeting()}>
        <Text style={styles.text} >Go to the Meeting</Text>
      </TouchableOpacity>
      <View style={styles.container}>
      <MapView style={styles.map}
  initialRegion={{
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
/>
    </View>  */}
      </View>
    )
  };

  const styles = StyleSheet.create({

    text:{
      textAlign: 'center',
      color: 'red',
      fontSize: 30,
      marginVertical: 10,
    },

    view:{
      flex: 1,
      justifyContent: 'center',

    },
    container: {
      flex: 1,
    },
    map: {
      width: '100%',
      height: '100%',
    }
  })

  export default InboxScreen;