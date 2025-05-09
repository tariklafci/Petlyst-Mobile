import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

// Screens
import LoginRegisterScreen from '../screens/LoginRegisterScreen';
import MyPetScreen from '../screens/MyPetScreen';
import HomeScreen from '../screens/HomeScreen';
import AppointmentScreen from '../screens/AppointmentScreen';
import AddPetScreen from '../screens/AddPetScreen';
import MeetingScreen from '../screens/MeetingScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
// Import your AuthContext
import { useAuth } from '../context/AuthContext'
import PasswordResetScreen from '../screens/PasswordResetScreen';
import VerifyCodeScreen from '../screens/VerifyCodeScreen';
import EditPetScreen from '../screens/EditPetScreen';
import MakeAppointmentScreen from '../screens/MakeAppointmentScreen';
import VetDashboardScreen from '../screens/VetDashboardScreen';
import VetAppointmentScreen from '../screens/VetAppointmentScreen';
import ChatAIScreen from '../screens/ChatAIScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ClinicPet from '../screens/ClinicPet';
import InventoryScreen from '../screens/InventoryScreen';


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
          } else if (route.name === 'Appointment') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'menu' : 'menu-outline';
          } else if (route.name === 'AIScreen') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
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
        name="AIScreen"
        component={ChatAIScreen}
        options={{ tabBarLabel: 'AI Chat' }}
      />
      <Tab.Screen
        name="Appointment"
        component={AppointmentScreen}
        options={{ tabBarLabel: 'Appointments' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function VetTabs() {
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
          } else if (route.name === 'ClinicPet') {
            iconName = focused ? 'paw' : 'paw-outline';
          } else if (route.name === 'VetAppointment') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Inventory') {
            iconName = focused ? 'cube' : 'cube-outline';
          }else if (route.name === 'Profile') {
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
        component={VetDashboardScreen}
        options={{ tabBarLabel: 'Explore' }}
      />
      <Tab.Screen
        name="ClinicPet"
        component={ClinicPet}
        options={{ tabBarLabel: 'Clinic Pets' }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ tabBarLabel: 'Inventory' }}
      />
      <Tab.Screen
        name="VetAppointment"
        component={VetAppointmentScreen}
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
        ) : state.user_type === 'pet_owner' ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddPet" component={AddPetScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditPet" component={EditPetScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Meeting" component={MeetingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MakeAppointment" component={MakeAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChatAIScreen" component={ChatAIScreen} options={{ headerShown: false }} />
          </>
        ) : state.user_type === 'veterinarian' ? (
          <>
            <Stack.Screen name="VetTabs" component={VetTabs} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="VetDashboard" component={VetDashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="VetAppointment" component={VetAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ClinicPet" component={ClinicPet} options={{ headerShown: false }} />
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ headerShown: false }} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

