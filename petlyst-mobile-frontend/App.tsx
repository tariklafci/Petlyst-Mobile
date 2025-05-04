import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import { AppState, LogBox } from 'react-native';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Register for push notifications when app starts
    const registerForNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setExpoPushToken(token);
        }
      } catch (error) {
        console.warn('Failed to register for push notifications:', error);
      }
    };

    registerForNotifications();

    // Set up notification listeners with error handling
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        try {
          console.log('Notification Received!', notification);
          // Handle the notification safely here
        } catch (error) {
          console.warn('Error handling received notification:', error);
        }
      });
    
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        try {
          console.log('Notification Response Received!', response);
          // Handle user interaction with the notification
          const data = response.notification.request.content.data;
          console.log('Notification data:', data);
          
          // Add navigation or other logic here based on the notification
        } catch (error) {
          console.warn('Error handling notification response:', error);
        }
      });

      // Listen for app state changes to refresh token when app comes back to foreground
      const subscription = AppState.addEventListener('change', nextAppState => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App has come to the foreground
          registerForNotifications();
        }
        appState.current = nextAppState;
      });

      return () => {
        // Clean up listeners
        notificationListener.current && Notifications.removeNotificationSubscription(notificationListener.current);
        responseListener.current && Notifications.removeNotificationSubscription(responseListener.current);
        subscription.remove();
      };
    } catch (error) {
      console.warn('Error setting up notification listeners:', error);
      return () => {};
    }
  }, []);

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
