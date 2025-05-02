import React, { useState, useContext } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity, Alert, Image, Dimensions, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import {useAuth} from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';

const LoginRegisterScreen = ({ navigation }: { navigation: any }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user_type, setUserType] = useState('pet_owner');
  const [isVeterinarianTab, setIsVeterinarianTab] = useState(true);
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });
  const { signIn, signUp } = useAuth();

  const handleSendNotificationToken = async () => {
    try {
      const expoToken = await SecureStore.getItemAsync('expoToken');
      const userToken = await SecureStore.getItemAsync('userToken');
  
      if (!expoToken) {
        Alert.alert('Error', 'Expo token was not found. Please re-open the app.');
        return;
      }
  
      if (!userToken) {
        Alert.alert('Error', 'User token was not found. Please re-open the app.');
        return;
      }
  
      const response = await fetch('https://petlyst.com:3001/api/add-expo-token', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expoToken })
      });
  
      const data = await response.json();
  
      if (response.ok) {
        Alert.alert('Success', data.message);
      } else {
        Alert.alert('Error', data.message || 'Unknown error occurred.');
      }
    } catch (error) {
      console.error('Error updating expo token:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };
  
  
  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Please fill in both username and password.');
    }
    try {
      await signIn({ email, password });
      Alert.alert('Success', 'You are now logged in!');
      handleSendNotificationToken();

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

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordValidations({
      length: text.length >= 8,
      uppercase: /[A-Z]/.test(text),
      lowercase: /[a-z]/.test(text),
      number: /[0-9]/.test(text),
    });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
      
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.gradientHeader}
      >
        <Image
          source={require('../../assets/petlyst-logo.jpeg')}
          style={styles.logo}
        />
        <Animatable.Text 
          animation="fadeIn" 
          duration={800} 
          style={styles.welcomeText}
        >
          Welcome to Petlyst
        </Animatable.Text>
      </LinearGradient>
      
      <Animatable.View 
        animation="fadeInUp"
        duration={800}
        style={styles.formContainer}
      >
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            onPress={() => setIsLoginTab(true)} 
            style={[styles.tab, isLoginTab && styles.activeTab]}
          >
            <Text style={[styles.tabText, isLoginTab && styles.activeTabText]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setIsLoginTab(false)} 
            style={[styles.tab, !isLoginTab && styles.activeTab]}
          >
            <Text style={[styles.tabText, !isLoginTab && styles.activeTabText]}>Register</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {!isLoginTab && (
            <View style={styles.typeTabContainer}>
              <TouchableOpacity 
                onPress={() => {setIsVeterinarianTab(true); setUserType('pet_owner')}} 
                style={[styles.typeTab, isVeterinarianTab && styles.activeTypeTab]}
              >
                <Ionicons name="paw" size={18} color={isVeterinarianTab ? "#6c63ff" : "#999"} />
                <Text style={[styles.typeTabText, isVeterinarianTab && styles.activeTypeTabText]}>Pet Owner</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {setIsVeterinarianTab(false); setUserType('veterinarian')}} 
                style={[styles.typeTab, !isVeterinarianTab && styles.activeTypeTab]}
              >
                <Ionicons name="medkit" size={18} color={!isVeterinarianTab ? "#6c63ff" : "#999"} />
                <Text style={[styles.typeTabText, !isVeterinarianTab && styles.activeTypeTabText]}>Veterinarian</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoginTab && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          )}
          
          {!isLoginTab && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Surname</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your surname"
                  value={surname}
                  onChangeText={setSurname}
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#aaa"
              />
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={handlePasswordChange}
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          </View>

          {!isLoginTab && (
            <View style={styles.passwordCriteriaContainer}>
              <Text style={styles.passwordCriteriaTitle}>Password must contain:</Text>

              <View style={styles.criteriaRow}>
                <Animatable.View animation={passwordValidations.length ? "bounceIn" : "fadeIn"} duration={500}>
                  {passwordValidations.length ? (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                </Animatable.View>
                <Text style={[styles.passwordCriteriaText, passwordValidations.length && styles.validText]}>
                  • At least 8 characters
                </Text>
              </View>

              <View style={styles.criteriaRow}>
                <Animatable.View animation={passwordValidations.uppercase ? "bounceIn" : "fadeIn"} duration={500}>
                  {passwordValidations.uppercase ? (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                </Animatable.View>
                <Text style={[styles.passwordCriteriaText, passwordValidations.uppercase && styles.validText]}>
                  • At least one uppercase letter
                </Text>
              </View>

              <View style={styles.criteriaRow}>
                <Animatable.View animation={passwordValidations.lowercase ? "bounceIn" : "fadeIn"} duration={500}>
                  {passwordValidations.lowercase ? (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                </Animatable.View>
                <Text style={[styles.passwordCriteriaText, passwordValidations.lowercase && styles.validText]}>
                  • At least one lowercase letter
                </Text>
              </View>

              <View style={styles.criteriaRow}>
                <Animatable.View animation={passwordValidations.number ? "bounceIn" : "fadeIn"} duration={500}>
                  {passwordValidations.number ? (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                </Animatable.View>
                <Text style={[styles.passwordCriteriaText, passwordValidations.number && styles.validText]}>
                  • At least one number
                </Text>
              </View>
            </View>
          )}

          {isLoginTab && (
            <TouchableOpacity style={styles.forgotPasswordButton} onPress={handlePasswordReset}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={isLoginTab ? handleLogin : handleRegister}
          >
            <LinearGradient
              colors={['#6c63ff', '#3b5998']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.submitButtonText}>
                {isLoginTab ? 'Login' : 'Register'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </Animatable.View>
    </KeyboardAvoidingView>
  );
};

const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  gradientHeader: {
    height: height * 0.35,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    paddingBottom: 50,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -50,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 25,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  tabText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6c63ff',
    fontWeight: 'bold',
  },
  typeTabContainer: {
    flexDirection: 'row',
    marginBottom: 25,
    justifyContent: 'space-between',
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  activeTypeTab: {
    backgroundColor: '#f0f0ff',
    borderWidth: 1,
    borderColor: '#e0e0ff',
  },
  typeTabText: {
    marginLeft: 8,
    color: '#777',
    fontWeight: '500',
  },
  activeTypeTabText: {
    color: '#6c63ff',
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  passwordCriteriaContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  passwordCriteriaTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  passwordCriteriaText: {
    marginLeft: 10,
    color: '#777',
    fontSize: 14,
  },
  validText: {
    color: 'green',
    fontWeight: '500',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  forgotPasswordText: {
    color: '#6c63ff',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    marginBottom: 30,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LoginRegisterScreen;