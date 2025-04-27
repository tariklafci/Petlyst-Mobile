import React, { useState, useContext } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity, Alert, Image, Dimensions, ScrollView, StatusBar } from 'react-native';
import {useAuth} from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const LoginRegisterScreen = ({ navigation }: { navigation: any }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [user_type, setUserType] = useState('pet_owner');
  const [isVeterinarianTab, setIsVeterinarianTab] = useState(true);
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Please fill in both username and password.');
    }
    try {
      await signIn({ email, password });
      Alert.alert('Success', 'You are now logged in!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  const handlePasswordReset = async () => {
    navigation.navigate('PasswordReset');
  }

  const handleRegister = async () => {

    const isPasswordValid = validatePassword(password);

    if (!email || !password) {
      return Alert.alert('Error', 'Please fill in all areas.');
    }
    if (!isPasswordValid) {
      return Alert.alert('Error', 'Password does not meet the required criteria.');
    }
    try {
      await signUp({ name, surname, email, password, user_type });
      Alert.alert('Success', 'You are now registered!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  };


  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />
      <Image
        source={require('../../assets/petlyst-logo.jpeg')}
        style={styles.image}
      />

      <Text style={styles.title}>Welcome!</Text>

      <View style={styles.tabContainer}>
        <TouchableOpacity onPress={() => setIsLoginTab(true)} style={[styles.tab, isLoginTab && styles.activeTab]}>
          <Text style={[styles.tabText, isLoginTab && styles.activeTabText]}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsLoginTab(false)} style={[styles.tab, !isLoginTab && styles.activeTab]}>
          <Text style={[styles.tabText, !isLoginTab && styles.activeTabText]}>Register</Text>
        </TouchableOpacity>
      </View>

      {!isLoginTab && (
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => {setIsVeterinarianTab(true); setUserType('pet_owner')}} style={[styles.tab, isVeterinarianTab && styles.activeTab]}>
            <Text style={[styles.tabText, isVeterinarianTab && styles.activeTabText]}>Pet Owner</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {setIsVeterinarianTab(false); setUserType('veterinarian')}} style={[styles.tab, !isVeterinarianTab && styles.activeTab]}>
            <Text style={[styles.tabText, !isVeterinarianTab && styles.activeTabText]}>Veterinarian</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoginTab && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
      )}
      {!isLoginTab && (
        <TextInput
          style={styles.input}
          placeholder="Surname"
          value={surname}
          onChangeText={setSurname}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="gray" />
        </TouchableOpacity>
      </View>

      {isLoginTab && (
        <TouchableOpacity style={styles.forgotPasswordButton} onPress={handlePasswordReset}>
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.loginButton} onPress={isLoginTab ? handleLogin : handleRegister}>
        <Text style={styles.loginButtonText}>{isLoginTab ? 'Login' : 'Register'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F7FB',
    paddingHorizontal: 0,
  },
  image: {
    width: width,
    height: height * 0.3,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#E0E0E0',
  },
  tabText: {
    fontSize: 16,
    color: '#777',
  },
  activeTabText: {
    fontWeight: 'bold',
    color: '#000',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginHorizontal: 20,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    marginBottom: 15,
    marginHorizontal: 20,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
  },
  forgotPasswordButton:{
    marginBottom: 20,
    alignSelf: 'flex-end',
    marginRight: 20,
  
  },
  forgotPasswordText: {
    color: '#4285F4',
    textAlign: 'right',
  },
  loginButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LoginRegisterScreen;