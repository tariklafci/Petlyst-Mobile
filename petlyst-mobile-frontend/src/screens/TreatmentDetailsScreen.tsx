import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

// Types for treatment data
interface Diagnosis {
  diagnosis_id: number;
  diagnosis_type: 'standard' | 'custom';
  diagnosis_code?: string;
  diagnosis_name: string;
  description?: string;
  diagnosis_date: string;
  severity?: 'mild' | 'moderate' | 'severe';
  diagnosis_notes?: string;
}

interface VitalSigns {
  temperature?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  weight?: number;
}

interface Examination {
  examination_id: number;
  examination_date: string;
  status: 'started' | 'in_progress' | 'completed';
  vital_signs: VitalSigns;
  notes?: string;
  diagnoses: Diagnosis[];
}

interface TreatmentDetails {
  appointment_id: number;
  examinations: Examination[];
}

const TreatmentDetailsScreen = ({ route, navigation }: any) => {
  const { appointmentId, petName, date } = route.params;
  
  const [isLoading, setIsLoading] = useState(true);
  const [treatmentDetails, setTreatmentDetails] = useState<TreatmentDetails | null>(null);
  const [activeExamIndex, setActiveExamIndex] = useState(0);

  useEffect(() => {
    fetchTreatmentDetails();
  }, []);

  const fetchTreatmentDetails = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `https://petlyst.com:3001/api/fetch-treatment-details?appointment_id=${appointmentId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch treatment details');
      }
      
      setTreatmentDetails(data);
    } catch (error) {
      console.error('Error fetching treatment details:', error);
      Alert.alert('Error', 'Failed to load treatment details');
    } finally {
      setIsLoading(false);
    }
  };

  // Format date from ISO string to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get color based on severity
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'mild':
        return '#4CAF50';
      case 'moderate':
        return '#FFA500';
      case 'severe':
        return '#F44336';
      default:
        return '#777777';
    }
  };

  // Render an individual diagnosis card
  const renderDiagnosis = (diagnosis: Diagnosis, index: number) => {
    return (
      <Animatable.View
        key={diagnosis.diagnosis_id}
        animation="fadeIn"
        delay={index * 100}
        style={styles.diagnosisCard}
      >
        <View style={styles.diagnosisHeader}>
          <View style={styles.diagnosisNameContainer}>
            <Text style={styles.diagnosisName}>{diagnosis.diagnosis_name}</Text>
            {diagnosis.diagnosis_code && (
              <Text style={styles.diagnosisCode}>Code: {diagnosis.diagnosis_code}</Text>
            )}
          </View>
          {diagnosis.severity && (
            <View
              style={[
                styles.severityBadge,
                { backgroundColor: getSeverityColor(diagnosis.severity) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.severityText,
                  { color: getSeverityColor(diagnosis.severity) },
                ]}
              >
                {diagnosis.severity.charAt(0).toUpperCase() + diagnosis.severity.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {diagnosis.description && (
          <View style={styles.diagnosisSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{diagnosis.description}</Text>
          </View>
        )}

        {diagnosis.diagnosis_notes && (
          <View style={styles.diagnosisSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.descriptionText}>{diagnosis.diagnosis_notes}</Text>
          </View>
        )}

        <View style={styles.diagnosisFooter}>
          <Text style={styles.diagnosisDate}>
            Diagnosed on {formatDate(diagnosis.diagnosis_date)}
          </Text>
          <Text style={styles.diagnosisType}>
            {diagnosis.diagnosis_type.charAt(0).toUpperCase() + diagnosis.diagnosis_type.slice(1)}
          </Text>
        </View>
      </Animatable.View>
    );
  };

  // Render vital signs section
  const renderVitalSigns = (vitalSigns: VitalSigns) => {
    const hasVitalSigns = vitalSigns.temperature || vitalSigns.heart_rate || 
                         vitalSigns.respiratory_rate || vitalSigns.weight;
    
    if (!hasVitalSigns) return null;
    
    return (
      <View style={styles.vitalSignsContainer}>
        <Text style={styles.vitalSignsTitle}>Vital Signs</Text>
        <View style={styles.vitalSignsGrid}>
          {vitalSigns.temperature && (
            <View style={styles.vitalSignItem}>
              <Ionicons name="thermometer-outline" size={20} color="#6c63ff" />
              <Text style={styles.vitalSignLabel}>Temperature</Text>
              <Text style={styles.vitalSignValue}>{vitalSigns.temperature}°C</Text>
            </View>
          )}
          
          {vitalSigns.heart_rate && (
            <View style={styles.vitalSignItem}>
              <Ionicons name="heart-outline" size={20} color="#6c63ff" />
              <Text style={styles.vitalSignLabel}>Heart Rate</Text>
              <Text style={styles.vitalSignValue}>{vitalSigns.heart_rate} bpm</Text>
            </View>
          )}
          
          {vitalSigns.respiratory_rate && (
            <View style={styles.vitalSignItem}>
              <Ionicons name="pulse-outline" size={20} color="#6c63ff" />
              <Text style={styles.vitalSignLabel}>Respiratory Rate</Text>
              <Text style={styles.vitalSignValue}>{vitalSigns.respiratory_rate} bpm</Text>
            </View>
          )}
          
          {vitalSigns.weight && (
            <View style={styles.vitalSignItem}>
              <Ionicons name="scale-outline" size={20} color="#6c63ff" />
              <Text style={styles.vitalSignLabel}>Weight</Text>
              <Text style={styles.vitalSignValue}>{vitalSigns.weight} kg</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render examination tabs
  const renderExaminationTabs = (examinations: Examination[]) => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {examinations.map((exam, index) => (
          <TouchableOpacity
            key={exam.examination_id}
            style={[
              styles.tab,
              activeExamIndex === index && styles.activeTab,
            ]}
            onPress={() => setActiveExamIndex(index)}
          >
            <Text
              style={[
                styles.tabText,
                activeExamIndex === index && styles.activeTabText,
              ]}
            >
              Exam {index + 1}
            </Text>
            <Text
              style={[
                styles.tabDate,
                activeExamIndex === index && styles.activeTabText,
              ]}
            >
              {new Date(exam.examination_date).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6c63ff', '#3b5998']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Treatment Details</Text>
            <Text style={styles.headerSubtitle}>{petName} • {date}</Text>
          </View>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>Loading treatment details...</Text>
        </View>
      ) : !treatmentDetails || treatmentDetails.examinations.length === 0 ? (
        <View style={styles.noDataContainer}>
          <Ionicons name="document-text-outline" size={60} color="#ddd" />
          <Text style={styles.noDataText}>No treatment records found</Text>
          <Text style={styles.noDataSubtext}>
            The veterinarian has not added any examination or diagnosis records yet
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.contentContainer}>
          {/* Examination Tabs */}
          {treatmentDetails.examinations.length > 1 &&
            renderExaminationTabs(treatmentDetails.examinations)}

          {/* Current Examination Details */}
          {treatmentDetails.examinations[activeExamIndex] && (
            <Animatable.View animation="fadeIn" style={styles.examinationContainer}>
              {/* Examination Header */}
              <View style={styles.examinationHeader}>
                <Text style={styles.examinationTitle}>
                  Examination Report
                </Text>
                <View style={styles.examinationMeta}>
                  <Text style={styles.examinationDate}>
                    {formatDate(treatmentDetails.examinations[activeExamIndex].examination_date)}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {treatmentDetails.examinations[activeExamIndex].status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Vital Signs */}
              {renderVitalSigns(treatmentDetails.examinations[activeExamIndex].vital_signs)}

              {/* Examination Notes */}
              {treatmentDetails.examinations[activeExamIndex].notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesTitle}>Examination Notes</Text>
                  <Text style={styles.notesText}>
                    {treatmentDetails.examinations[activeExamIndex].notes}
                  </Text>
                </View>
              )}

              {/* Diagnoses */}
              <View style={styles.diagnosesContainer}>
                <Text style={styles.diagnosesTitle}>
                  Diagnoses ({treatmentDetails.examinations[activeExamIndex].diagnoses.length})
                </Text>
                {treatmentDetails.examinations[activeExamIndex].diagnoses.length > 0 ? (
                  treatmentDetails.examinations[activeExamIndex].diagnoses.map(
                    (diagnosis, index) => renderDiagnosis(diagnosis, index)
                  )
                ) : (
                  <View style={styles.noDiagnosesContainer}>
                    <Ionicons name="clipboard-outline" size={40} color="#ddd" />
                    <Text style={styles.noDiagnosesText}>
                      No diagnoses recorded for this examination
                    </Text>
                  </View>
                )}
              </View>
            </Animatable.View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 5,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    maxHeight: 50,
    marginBottom: 15,
  },
  tabsContent: {
    paddingHorizontal: 5,
  },
  tab: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    marginRight: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#6c63ff',
  },
  tabText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
  },
  tabDate: {
    color: '#777',
    fontSize: 12,
  },
  activeTabText: {
    color: '#fff',
  },
  examinationContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  examinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  examinationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  examinationMeta: {
    alignItems: 'flex-end',
  },
  examinationDate: {
    fontSize: 12,
    color: '#777',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#00acc1',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  vitalSignsContainer: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vitalSignsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  vitalSignsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vitalSignItem: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  vitalSignLabel: {
    fontSize: 12,
    color: '#777',
    marginTop: 5,
  },
  vitalSignValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 2,
  },
  notesContainer: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  diagnosesContainer: {
    marginBottom: 10,
  },
  diagnosesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  diagnosisCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6c63ff',
  },
  diagnosisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  diagnosisNameContainer: {
    flex: 1,
    marginRight: 10,
  },
  diagnosisName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  diagnosisCode: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  severityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  diagnosisSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  diagnosisFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  diagnosisDate: {
    fontSize: 12,
    color: '#888',
  },
  diagnosisType: {
    fontSize: 12,
    color: '#6c63ff',
    fontWeight: '500',
  },
  noDiagnosesContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  noDiagnosesText: {
    marginTop: 10,
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
});

export default TreatmentDetailsScreen; 