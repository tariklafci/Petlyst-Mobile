import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const navigation = useNavigation()
  const [name, setName] = useState<string>('—')
  const [email, setEmail] = useState<string>('—')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const { signOut } = useAuth();

  useEffect(() => {
    // load basic user info (adjust your storage keys as needed)
    ;(async () => {
      const storedName = (await AsyncStorage.getItem('name_surname'))
      const storedEmail = (await SecureStore.getItemAsync('user_email'))
      const storedAvatar = await AsyncStorage.getItem('userAvatar')
      setName(storedName)
      setEmail(storedEmail)
      setAvatarUrl(storedAvatar)
    })()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Success', 'You are now signed out!');
    } catch (error) {
      console.error('Error signing out!', error);
    }
  };

  const renderOption = (
    icon: string,
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon as any} size={24} color="#6c63ff" />
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color="#ccc" />
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {/* background gradient header */}
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Profile</Text>
      </LinearGradient>

      {/* avatar, name, email, edit button */}
      <View style={styles.profileCard}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person-outline" size={40} color="#6c63ff" />
          </View>
        )}
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={() => navigation.navigate('EditProfile' as never)}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* options list */}
      <View style={styles.optionsContainer}>
        {renderOption('log-out-outline', 'Sign Out', handleSignOut)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    height: 120,
    paddingTop: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsIcon: {
    position: 'absolute',
    right: 20,
    top: 50,
  },
  profileCard: {
    marginTop: -40,
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    backgroundColor: '#e0e0ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editProfileBtn: {
    flexDirection: 'row',
    backgroundColor: '#6c63ff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 15,
  },
  editProfileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  optionsContainer: {
    flex: 1,
    marginTop: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionIcon: {
    width: 30,
    alignItems: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
})

export default ProfileScreen
