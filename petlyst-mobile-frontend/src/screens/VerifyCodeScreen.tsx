import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, StatusBar, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

const VerifyCodeScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { email } = route.params; // Email passed from PasswordResetScreen
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    return regex.test(password);
  };

  const handleVerifyCode = async () => {
    if (!code || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const isPasswordValid = validatePassword(newPassword);
    if (!isPasswordValid) {
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
        Alert.alert('Success', data.message);
        navigation.navigate('LoginRegister'); // Navigate to login screen after reset
      } else {
        Alert.alert('Error', data.message || 'Failed to verify reset code.');
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
                style={styles.input}
                placeholder="Enter the 4-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="numeric"
                maxLength={6}
                placeholderTextColor="#aaa"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6c63ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Create new password"
                value={newPassword}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          </View>

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

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleVerifyCode} 
            disabled={loading}
          >
            <LinearGradient
              colors={['#6c63ff', '#3b5998']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resendButton}
            onPress={() => navigation.navigate('PasswordReset')}
          >
            <Text style={styles.resendButtonText}>Didn't receive a code? Request again</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animatable.View>
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
    paddingTop: 30,
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
  submitButton: {
    marginBottom: 15,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    alignItems: 'center',
    padding: 15,
    marginBottom: 20,
  },
  resendButtonText: {
    color: '#6c63ff',
    fontSize: 14,
    fontWeight: '500',
  }
});

export default VerifyCodeScreen;
