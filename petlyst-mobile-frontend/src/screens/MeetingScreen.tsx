import React from 'react';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { View, StyleSheet, ActivityIndicator, Platform, PermissionsAndroid, Alert } from 'react-native';

const MeetingScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  //const { meeting_url } = route.params; // Retrieve room name from navigation params
  const meeting_url = route?.params?.meetingUrl;
  console.log(`${meeting_url}`)

  const meetingUrl = `meeting.petlyst.com/`+`${meeting_url}`+`#config.deeplinking.disabled=true`;

  const requestPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const audioStatus = await Camera.requestMicrophonePermissionsAsync();
  
    if (status !== 'granted' || audioStatus.status !== 'granted') {
      Alert.alert('Permissions Required', 'Camera and Microphone permissions are required for the meeting.');
    } else {
      console.log('Permissions granted');
    }
  };

  React.useEffect(() => {
    requestPermissions();
  }, []);

  return (
    <View style={styles.container}>
      <WebView
  source={{ uri: meetingUrl }}
  style={styles.webview}
  javaScriptEnabled={true}
  domStorageEnabled={true}
  mediaPlaybackRequiresUserAction={false}
  startInLoadingState={true}
  renderLoading={() => <ActivityIndicator size="large" color="#0000ff" />}
  allowsInlineMediaPlayback={true}
  onPermissionRequest={(event) => {
    event.grant(); // Explicitly grant requested permissions
  }}
/>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});

export default MeetingScreen;
