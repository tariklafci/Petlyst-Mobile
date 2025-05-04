//notifications.tsx

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  try {
    // Check if we're on a physical device
    if (!Device.isDevice) {
      console.warn('Push notifications are only supported on physical devices');
      return undefined;
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch (error) {
        console.warn('Failed to create Android notification channel:', error);
        // Continue anyway since this error should not be fatal
      }
    }

    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permission for notifications was denied');
      return undefined;
    }

    // Get Expo push token
    try {
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: 'dd6d79a7-cffd-41c2-9f55-2162b41137d1',
      });

      const token = expoPushToken.data;
      console.log('Expo Push Token:', token);
      
      // Save token to secure storage
      await SecureStore.setItemAsync('expoToken', token);
      return token;
    } catch (err) {
      console.error('Failed to get expo push token:', err);
      return undefined;
    }
  } catch (err) {
    console.error('Unexpected error in registerForPushNotificationsAsync:', err);
    return undefined;
  }
}

// Helper function to handle incoming notifications data
export function parseNotificationData(notification: Notifications.Notification): any {
  try {
    const data = notification.request.content.data;
    return data || {};
  } catch (error) {
    console.warn('Error parsing notification data:', error);
    return {};
  }
}

// For testing notifications locally
export async function sendLocalNotification(title: string, body: string, data = {}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // null means show immediately
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}


