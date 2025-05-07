//LoginRegisterScreen.tsx

import React, { useState, useContext, useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity, Alert, Image, Dimensions, ScrollView, StatusBar, KeyboardAvoidingView, Platform, Keyboard, Animated, Modal } from 'react-native';
import {useAuth} from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { registerForPushNotificationsAsync } from '../services/notifications'; // adjust path as needed
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';


const LoginRegisterScreen = ({ navigation }: { navigation: any }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [user_type, setUserType] = useState('pet_owner');
  const [isVeterinarianTab, setIsVeterinarianTab] = useState(true);
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [veterinarianGraduateBarcode, setVeterinarianGraduateBarcode] = useState('');
  const [veterinarianTcNumber, setVeterinarianTcNumber] = useState('');
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    match: false,
  });
  const [isEmailValid, setIsEmailValid] = useState(true);
  
  // Refs for TextInputs to enable navigation between fields
  const nameInputRef = useRef<TextInput>(null);
  const surnameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const graduateBarcodeInputRef = useRef<TextInput>(null);
  const tcNumberInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  
  const { signIn, signUp } = useAuth();

  // Update password validations when either password or confirmPassword changes
  useEffect(() => {
    handlePasswordValidation();
  }, [password, confirmPassword]);

  // Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(email);
  };

  // Check email validity when email changes
  useEffect(() => {
    if (email.length > 0) {
      setIsEmailValid(validateEmail(email));
    } else {
      setIsEmailValid(true); // Don't show error for empty field
    }
  }, [email]);

  const handleSendNotificationToken = async () => {
    try {
      const expoToken = await SecureStore.getItemAsync('expoToken');
      const userToken = await SecureStore.getItemAsync('userToken');
  
      console.log('Expo token:', expoToken);
      console.log('User token:', userToken);
  
      if (!expoToken) {
        console.warn('Expo token not found. Will not send notification token.');
        return;
      }
  
      if (!userToken) {
        console.warn('User token not found. Will not send notification token.');
        return;
      }
  
      console.log('Sending PATCH request to add-expo-token...');
      try {
        const response = await fetch('https://petlyst.com:3001/api/add-expo-token', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expoToken })
        });
    
        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.warn('Failed to parse JSON response:', e);
          data = { message: 'Invalid response format from server.' };
        }
    
        if (response.ok) {
          console.log('Successfully registered notification token with server');
        } else {
          console.warn('Failed to register notification token:', data.message || 'Unknown error');
        }
      } catch (networkError) {
        console.error('Network error while registering notification token:', networkError);
      }
    } catch (error) {
      console.error('Error in handleSendNotificationToken:', error);
      // Don't show alerts for background processes
    }
  };
  
  
  
  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Please fill in both username and password.');
    }

    if (!validateEmail(email)) {
      return Alert.alert('Error', 'Please enter a valid email address.');
    }
  
    try {
      await signIn({ email, password }); // ✅ token is stored inside here
  
      Alert.alert('Success', 'You are now logged in!');
  
      try {
        // Get the push notification token
        const expoToken = await registerForPushNotificationsAsync();
        
        // Only attempt to send the token if we successfully got one
        if (expoToken) {
          await handleSendNotificationToken();
        } else {
          console.warn('Failed to register for push notifications during login');
        }
      } catch (error) {
        console.error('Error during notification setup:', error);
        // Don't fail the login process because of notification issues
      }
  
      await SecureStore.setItemAsync('user_email', email);
      await SecureStore.setItemAsync('name_surname', `${name} ${surname}`);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong.');
    }
  };
  

  const handlePasswordReset = async () => {
    navigation.navigate('PasswordReset');
  }

  const handleRegister = async () => {
    const allValidationsPassed = Object.values(passwordValidations).every(value => value === true);

    if (!email || !password || !confirmPassword || (!isLoginTab && (!name || !surname))) {
      return Alert.alert('Error', 'Please fill in all required fields.');
    }
    
    if (!validateEmail(email)) {
      return Alert.alert('Error', 'Please enter a valid email address.');
    }
    
    if (!allValidationsPassed) {
      return Alert.alert('Error', 'Password does not meet the required criteria.');
    }
    
    if (password !== confirmPassword) {
      return Alert.alert('Error', 'Passwords do not match.');
    }

    // Validate TC number if user is registering as a veterinarian
    if (!isVeterinarianTab && user_type === 'veterinarian') {
      if (!veterinarianGraduateBarcode) {
        return Alert.alert('Error', 'Please enter your graduate barcode.');
      }
      
      if (!veterinarianTcNumber) {
        return Alert.alert('Error', 'Please enter your TC number.');
      }
      
      if (veterinarianTcNumber.length !== 11 || !/^\d+$/.test(veterinarianTcNumber)) {
        return Alert.alert('Error', 'TC number must be exactly 11 digits.');
      }
    }
    
    try {
      await signUp({ 
        name, 
        surname, 
        email, 
        password, 
        user_type,
        ...(user_type === 'veterinarian' ? {
          veterinarian_graduate_barcode: veterinarianGraduateBarcode,
          veterinarian_tc_number: veterinarianTcNumber
        } : {})
      });
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

  const handlePasswordValidation = () => {
    setPasswordValidations({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      match: password === confirmPassword && password.length > 0,
    });
  };

  const isPasswordValid = () => {
    return Object.values(passwordValidations).every(value => value === true);
  }

  return (
    <KeyboardAwareScrollView
    contentContainerStyle={styles.container}
    enableOnAndroid={false}
    extraScrollHeight={50} // 👈 adjusts how much extra space to scroll up
    keyboardShouldPersistTaps="handled"
  >
      <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
      
      <View style={styles.gradientContainer}>
        <LinearGradient
          colors={['#6c63ff', '#3b5998']}
          style={styles.gradientHeader}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/petlyst-logo.jpeg')}
              style={styles.logo}
            />
          </View>
          
          <Animatable.Text 
            animation="fadeIn" 
            duration={800} 
            style={styles.welcomeText}
          >
            Welcome to Petlyst
          </Animatable.Text>
        </LinearGradient>
      </View>
      
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
          keyboardShouldPersistTaps="handled"
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
                  ref={nameInputRef}
                  style={styles.input}
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#aaa"
                  returnKeyType="next"
                  onSubmitEditing={() => surnameInputRef.current?.focus()}
                  blurOnSubmit={false}
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
                  ref={surnameInputRef}
                  style={styles.input}
                  placeholder="Enter your surname"
                  value={surname}
                  onChangeText={setSurname}
                  placeholderTextColor="#aaa"
                  returnKeyType="next"
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[styles.inputContainer, !isEmailValid && styles.inputError]}>
              <Ionicons name="mail-outline" size={20} color={isEmailValid ? "#6c63ff" : "#ff6b6b"} style={styles.inputIcon} />
              <TextInput
                ref={emailInputRef}
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#aaa"
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (!isLoginTab && !isVeterinarianTab) {
                    graduateBarcodeInputRef.current?.focus();
                  } else {
                    passwordInputRef.current?.focus();
                  }
                }}
                blurOnSubmit={false}
              />
              {!isEmailValid && email.length > 0 && (
                <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
              )}
            </View>
            {!isEmailValid && email.length > 0 && (
              <Text style={styles.errorText}>Please enter a valid email address</Text>
            )}
          </View>
          
          {/* Veterinarian-specific fields */}
          {!isLoginTab && !isVeterinarianTab && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Graduate Barcode</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="barcode-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
                  <TextInput
                    ref={graduateBarcodeInputRef}
                    style={styles.input}
                    placeholder="Enter your graduate barcode"
                    value={veterinarianGraduateBarcode}
                    onChangeText={setVeterinarianGraduateBarcode}
                    placeholderTextColor="#aaa"
                    returnKeyType="next"
                    onSubmitEditing={() => tcNumberInputRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TC Number (11 digits)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="card-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
                  <TextInput
                    ref={tcNumberInputRef}
                    style={styles.input}
                    placeholder="Enter your TC number"
                    value={veterinarianTcNumber}
                    onChangeText={(text) => {
                      // Only allow digits and limit to 11 characters
                      const formattedText = text.replace(/[^0-9]/g, '').slice(0, 11);
                      setVeterinarianTcNumber(formattedText);
                    }}
                    keyboardType="numeric"
                    maxLength={11}
                    placeholderTextColor="#aaa"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
                {veterinarianTcNumber.length > 0 && veterinarianTcNumber.length !== 11 && (
                  <Text style={styles.errorText}>TC number must be 11 digits</Text>
                )}
              </View>
            </>
          )}
          
          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              {!isLoginTab && (
                <TouchableOpacity 
                  style={styles.infoButton}
                  onPress={() => setShowCriteriaModal(true)}
                >
                  <Ionicons 
                    name={isPasswordValid() ? "checkmark-circle" : "information-circle"} 
                    size={20} 
                    color={isPasswordValid() ? "green" : "#ff6b6b"} 
                  />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                placeholderTextColor="#aaa"
                returnKeyType={isLoginTab ? "done" : "next"}
                onSubmitEditing={() => {
                  if (isLoginTab) {
                    Keyboard.dismiss();
                  } else {
                    confirmPasswordInputRef.current?.focus();
                  }
                }}
                blurOnSubmit={isLoginTab}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          </View>

          {!isLoginTab && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
                <TextInput
                  ref={confirmPasswordInputRef}
                  style={styles.input}
                  placeholder="Confirm your password"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor="#aaa"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
                </TouchableOpacity>
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

      {/* Password Criteria Modal */}
      <Modal
        visible={showCriteriaModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCriteriaModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCriteriaModal(false)}
        >
          <Animatable.View 
            animation="zoomIn"
            duration={300}
            style={styles.modalContainer}
          >
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowCriteriaModal(false)}
            >
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
            
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

              <View style={styles.criteriaRow}>
                <Animatable.View animation={passwordValidations.match ? "bounceIn" : "fadeIn"} duration={500}>
                  {passwordValidations.match ? (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                </Animatable.View>
                <Text style={[styles.passwordCriteriaText, passwordValidations.match && styles.validText]}>
                  • Passwords match
                </Text>
              </View>
            </View>
          </Animatable.View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAwareScrollView>
  );
};

const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  gradientContainer: {
    width: '100%',
    height: height * 0.35,
  },
  gradientHeader: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 50
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    paddingBottom: 10,
    marginTop: 10,
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
    marginBottom: 20,
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
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  infoButton: {
    padding: 4,
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
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 4,
  },
  passwordCriteriaContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 5,
  },
  inputError: {
    borderColor: '#ff6b6b',
    borderWidth: 1,
  },
});

export default LoginRegisterScreen;