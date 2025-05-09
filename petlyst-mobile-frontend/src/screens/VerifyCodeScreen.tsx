import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, StatusBar, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

const VerifyCodeScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { email } = route.params; // Email passed from PasswordResetScreen
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  
  // Refs for TextInputs
  const codeInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  // Update password validations when password changes
  React.useEffect(() => {
    validatePassword(newPassword);
    checkPasswordsMatch();
  }, [newPassword, confirmPassword]);

  const handlePasswordChange = (text: string) => {
    setNewPassword(text);
    setPasswordValidations({
      length: text.length >= 8,
      uppercase: /[A-Z]/.test(text),
      lowercase: /[a-z]/.test(text),
      number: /[0-9]/.test(text),
    });
  };

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    setPasswordValidations({
      length: regex.test(password),
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    });
  };

  const checkPasswordsMatch = () => {
    setPasswordsMatch(newPassword === confirmPassword && newPassword.length > 0);
  };

  const isPasswordValid = () => {
    return Object.values(passwordValidations).every(value => value === true) && passwordsMatch;
  };

  const handleVerifyCode = async () => {
    if (!code) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (!isPasswordValid()) {
      Alert.alert('Error', 'Password does not meet the required criteria.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('https://petlyst.com:3001/api/verify-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        Alert.alert('Success', data.message, [
          { text: 'OK', onPress: () => navigation.navigate('LoginRegister') }
        ]);
      } else {
        Alert.alert('Error', data.message || 'Failed to verify code.');
      }
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
    }
  };

  const handleRequestNewCode = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://petlyst.com:3001/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        Alert.alert('Success', 'A new verification code has been sent to your email.');
      } else {
        Alert.alert('Error', data.message || 'Failed to request a new code.');
      }
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
    }
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Animatable.Text 
          animation="fadeIn" 
          duration={800} 
          style={styles.headerTitle}
        >
          Verify Code
        </Animatable.Text>
        <Animatable.Text 
          animation="fadeIn" 
          duration={800} 
          delay={200}
          style={styles.headerSubtitle}
        >
          Enter the code sent to your email
        </Animatable.Text>
      </LinearGradient>
      
      <Animatable.View 
        animation="fadeInUp"
        duration={800}
        style={styles.formContainer}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Verification Code</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                ref={codeInputRef}
                style={styles.input}
                placeholder="Enter verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                placeholderTextColor="#aaa"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={styles.inputLabel}>New Password</Text>
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
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Enter new password"
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={handlePasswordChange}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                ref={confirmPasswordInputRef}
                style={styles.input}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                returnKeyType="done"
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, !isPasswordValid() && styles.submitButtonDisabled]}
            onPress={handleVerifyCode}
            disabled={loading || !isPasswordValid()}
          >
            <LinearGradient
              colors={['#6c63ff', '#3b5998']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Processing...' : 'Reset Password'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.newCodeButton}
            onPress={handleRequestNewCode}
            disabled={loading}
          >
            <Text style={styles.newCodeText}>Didn't receive a code? Request new one</Text>
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
                <Animatable.View animation={passwordsMatch ? "bounceIn" : "fadeIn"} duration={500}>
                  {passwordsMatch ? (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                </Animatable.View>
                <Text style={[styles.passwordCriteriaText, passwordsMatch && styles.validText]}>
                  • Passwords match
                </Text>
              </View>
            </View>
          </Animatable.View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  gradientHeader: {
    height: height * 0.28,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 40,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
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
  validationContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  validationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  validationText: {
    marginLeft: 10,
    color: '#777',
    fontSize: 14,
  },
  validText: {
    color: 'green',
  },
  passwordCriteriaContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
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
  submitButton: {
    marginTop: 10,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newCodeButton: {
    alignItems: 'center',
    padding: 15,
  },
  newCodeText: {
    color: '#6c63ff',
    fontSize: 14,
    fontWeight: '500',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoButton: {
    padding: 4,
  },
  
  // Modal styles
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
});

export default VerifyCodeScreen;
