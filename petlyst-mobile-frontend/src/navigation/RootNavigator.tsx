import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

// Screens
import LoginRegisterScreen from '../screens/LoginRegisterScreen';
import MyPetScreen from '../screens/MyPetScreen';
import HomeScreen from '../screens/HomeScreen';
import InboxScreen from '../screens/InboxScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddPetScreen from '../screens/AddPetScreen';
import MeetingScreen from '../screens/MeetingScreen';
import MapScreen from '../screens/MapScreen';
// Import your AuthContext
import { useAuth } from '../context/AuthContext'
import PasswordResetScreen from '../screens/PasswordResetScreen';
import VerifyCodeScreen from '../screens/VerifyCodeScreen';
import EditPetScreen from '../screens/EditPetScreen';
import MakeAppointmentScreen from '../screens/MakeAppointmentScreen';


/* -------------------------------
   Stack Navigators
------------------------------- */
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* --------------------------------
   Main Tabs (when user is logged in)
--------------------------------- */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-circle'; // fallback icon

          if (route.name === 'Home') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'MyPet') {
            iconName = focused ? 'paw' : 'paw-outline';
          } else if (route.name === 'Inbox') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Explore' }}
      />
      <Tab.Screen
        name="MyPet"
        component={MyPetScreen}
        options={{ tabBarLabel: 'My Pet' }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ tabBarLabel: 'Inbox' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}


export default function RootNavigator() {
  // Access the AuthContext to determine if userToken is set
  const { state } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator>
      {state.userToken == null ? (
          <>
            <Stack.Screen name="LoginRegister" component={LoginRegisterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PasswordReset" component={PasswordResetScreen} options={{ headerShown: false }} />
            <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} options={{ headerShown: false }} />

          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }}/>
            <Stack.Screen name="AddPet" component={AddPetScreen} options={{ headerShown: false }}/>
            <Stack.Screen name="EditPet" component={EditPetScreen} options={{ headerShown: false }}/>
            <Stack.Screen name="Meeting" component={MeetingScreen} options={{ headerShown: false }}/>
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ headerShown: false }}/>
            <Stack.Screen name="MakeAppointment" component={MakeAppointmentScreen} options={{ headerShown: false }}/>

          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
