import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';

// Types
type Room = {
  id: number;
  clinic_id: number;
  room_name: string;
  room_type: 'standard' | 'isolation' | 'intensive_care';
  room_status: 'vacant' | 'occupied' | 'maintenance';
  created_at: string;
  updated_at: string;
};

type Patient = {
  id: number;
  clinic_id: number;
  pet_id: number;
  created_at: string;
  updated_at: string;
  pet_name?: string;
  pet_species?: string;
  pet_breed?: string;
};

type Examination = {
  examination_id: number;
  pet_id: number;
  vet_id: number;
  examination_date: string;
  status: 'started' | 'in_progress' | 'completed';
  temperature?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  weight?: number;
  notes?: string;
  appointment_id?: number;
  created_at: string;
  updated_at: string;
};

type Diagnosis = {
  diagnosis_id: number;
  examination_id: number;
  diagnosis_type: 'standard' | 'custom';
  diagnosis_code?: string;
  diagnosis_name: string;
  description?: string;
  diagnosis_date: string;
  severity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
  created_at: string;
  updated_at: string;
};

const { width } = Dimensions.get('window');

const ClinicPet = ({ navigation }: { navigation: any }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [diagnosisModalVisible, setDiagnosisModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRooms(),
        fetchPatients(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch('https://petlyst.com:3001/api/clinic-hospitalization-rooms', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return;
      }
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch('https://petlyst.com:3001/api/clinic-patients', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return;
      }
      const data = await response.json();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchPatientExaminations = async (petId: number) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`https://petlyst.com:3001/api/clinic-examinations/pet/${petId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return [];
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching examinations:', error);
      return [];
    }
  };

  const fetchExaminationDiagnoses = async (examinationId: number) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`https://petlyst.com:3001/api/clinic-diagnoses/examination/${examinationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return [];
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
      return [];
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handlePatientSelect = async (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientModalVisible(true);
    
    // Fetch examinations for this patient
    const examData = await fetchPatientExaminations(patient.pet_id);
    setExaminations(examData);
    
    // Clear previous diagnoses
    setDiagnoses([]);
  };

  const handleExaminationSelect = async (examination: Examination) => {
    // Fetch diagnoses for this examination
    const diagnosesData = await fetchExaminationDiagnoses(examination.examination_id);
    setDiagnoses(diagnosesData);
    setDiagnosisModalVisible(true);
  };

  const renderRoomItem = ({ item }: { item: Room }) => {
    const statusColor = 
      item.room_status === 'vacant' ? '#4CAF50' : 
      item.room_status === 'occupied' ? '#FF9800' : '#F44336';
    
    const roomTypeLabel = 
      item.room_type === 'standard' ? 'Standard' : 
      item.room_type === 'isolation' ? 'Isolation' : 'Intensive Care';
    
    return (
      <View style={styles.roomCard}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomName}>{item.room_name}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {item.room_status.charAt(0).toUpperCase() + item.room_status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.roomType}>{roomTypeLabel}</Text>
      </View>
    );
  };

  const renderPatientItem = ({ item }: { item: Patient }) => {
    return (
      <TouchableOpacity 
        style={styles.patientCard} 
        onPress={() => handlePatientSelect(item)}
      >
        <View style={styles.patientIconContainer}>
          <Ionicons name="paw" size={24} color="#4285F4" />
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{item.pet_name || `Pet #${item.pet_id}`}</Text>
          <Text style={styles.patientSpecies}>
            {item.pet_species ? `${item.pet_species}${item.pet_breed ? ` - ${item.pet_breed}` : ''}` : 'Unknown species'}
          </Text>
          <Text style={styles.patientDate}>Patient since: {new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Loading clinic data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Clinic Pet Management</Text>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Hospitalization Rooms</Text>
          {rooms.length > 0 ? (
            <FlatList
              data={rooms}
              renderItem={renderRoomItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roomsListContainer}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No hospitalization rooms available</Text>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Clinic Patients</Text>
          {patients.length > 0 ? (
            <FlatList
              data={patients}
              renderItem={renderPatientItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No patients registered</Text>
          )}
        </View>
      </ScrollView>

      {/* Patient Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={patientModalVisible}
        onRequestClose={() => setPatientModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPatient?.pet_name || `Pet #${selectedPatient?.pet_id}`}
              </Text>
              <TouchableOpacity onPress={() => setPatientModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalSectionTitle}>Patient Information</Text>
              <View style={styles.patientDetailItem}>
                <Text style={styles.patientDetailLabel}>Pet ID:</Text>
                <Text style={styles.patientDetailValue}>{selectedPatient?.pet_id}</Text>
              </View>
              {selectedPatient?.pet_species && (
                <View style={styles.patientDetailItem}>
                  <Text style={styles.patientDetailLabel}>Species:</Text>
                  <Text style={styles.patientDetailValue}>{selectedPatient.pet_species}</Text>
                </View>
              )}
              {selectedPatient?.pet_breed && (
                <View style={styles.patientDetailItem}>
                  <Text style={styles.patientDetailLabel}>Breed:</Text>
                  <Text style={styles.patientDetailValue}>{selectedPatient.pet_breed}</Text>
                </View>
              )}
              <View style={styles.patientDetailItem}>
                <Text style={styles.patientDetailLabel}>Patient Since:</Text>
                <Text style={styles.patientDetailValue}>
                  {selectedPatient ? new Date(selectedPatient.created_at).toLocaleDateString() : ''}
                </Text>
              </View>

              <Text style={styles.modalSectionTitle}>Medical History</Text>
              {examinations.length > 0 ? (
                examinations.map((exam) => (
                  <TouchableOpacity 
                    key={exam.examination_id}
                    style={styles.examinationItem}
                    onPress={() => handleExaminationSelect(exam)}
                  >
                    <View style={styles.examinationHeader}>
                      <Text style={styles.examinationDate}>
                        {new Date(exam.examination_date).toLocaleDateString()}
                      </Text>
                      <View style={[
                        styles.examinationStatus,
                        {
                          backgroundColor: 
                            exam.status === 'completed' ? '#4CAF50' : 
                            exam.status === 'in_progress' ? '#FF9800' : '#F44336'
                        }
                      ]}>
                        <Text style={styles.examinationStatusText}>
                          {exam.status.replace('_', ' ').charAt(0).toUpperCase() + exam.status.replace('_', ' ').slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.examinationDetails}>
                      {exam.temperature && (
                        <Text style={styles.examinationDetail}>Temp: {exam.temperature}°C</Text>
                      )}
                      {exam.heart_rate && (
                        <Text style={styles.examinationDetail}>HR: {exam.heart_rate} bpm</Text>
                      )}
                      {exam.respiratory_rate && (
                        <Text style={styles.examinationDetail}>RR: {exam.respiratory_rate} bpm</Text>
                      )}
                      {exam.weight && (
                        <Text style={styles.examinationDetail}>Weight: {exam.weight} kg</Text>
                      )}
                    </View>
                    {exam.notes && (
                      <Text style={styles.examinationNotes} numberOfLines={2}>
                        {exam.notes}
                      </Text>
                    )}
                    <Text style={styles.viewDiagnosesText}>
                      View diagnoses <Ionicons name="chevron-forward" size={12} color="#4285F4" />
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>No examination records found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Diagnoses Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={diagnosisModalVisible}
        onRequestClose={() => setDiagnosisModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Diagnoses</Text>
              <TouchableOpacity onPress={() => setDiagnosisModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {diagnoses.length > 0 ? (
                diagnoses.map((diagnosis) => (
                  <View key={diagnosis.diagnosis_id} style={styles.diagnosisItem}>
                    <View style={styles.diagnosisHeader}>
                      <Text style={styles.diagnosisName}>{diagnosis.diagnosis_name}</Text>
                      {diagnosis.severity && (
                        <View style={[
                          styles.severityIndicator,
                          {
                            backgroundColor: 
                              diagnosis.severity === 'mild' ? '#4CAF50' : 
                              diagnosis.severity === 'moderate' ? '#FF9800' : '#F44336'
                          }
                        ]}>
                          <Text style={styles.severityText}>
                            {diagnosis.severity.charAt(0).toUpperCase() + diagnosis.severity.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.diagnosisDetails}>
                      <Text style={styles.diagnosisType}>
                        Type: {diagnosis.diagnosis_type.charAt(0).toUpperCase() + diagnosis.diagnosis_type.slice(1)}
                      </Text>
                      {diagnosis.diagnosis_code && (
                        <Text style={styles.diagnosisCode}>
                          Code: {diagnosis.diagnosis_code}
                        </Text>
                      )}
                      <Text style={styles.diagnosisDate}>
                        Date: {new Date(diagnosis.diagnosis_date).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    {diagnosis.description && (
                      <View style={styles.diagnosisSection}>
                        <Text style={styles.diagnosisSectionTitle}>Description:</Text>
                        <Text style={styles.diagnosisDescription}>{diagnosis.description}</Text>
                      </View>
                    )}
                    
                    {diagnosis.notes && (
                      <View style={styles.diagnosisSection}>
                        <Text style={styles.diagnosisSectionTitle}>Notes:</Text>
                        <Text style={styles.diagnosisNotes}>{diagnosis.notes}</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No diagnoses found for this examination</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4285F4',
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  roomsListContainer: {
    paddingBottom: 10,
  },
  roomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    width: width * 0.75,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roomType: {
    fontSize: 14,
    color: '#666',
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  patientIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  patientSpecies: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  patientDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: width * 0.9,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScrollView: {
    maxHeight: '90%',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 5,
  },
  patientDetailItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  patientDetailLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  patientDetailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  examinationItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  examinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  examinationDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  examinationStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  examinationStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  examinationDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  examinationDetail: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
    marginBottom: 5,
  },
  examinationNotes: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  viewDiagnosesText: {
    fontSize: 12,
    color: '#4285F4',
    alignSelf: 'flex-end',
  },
  diagnosisItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  diagnosisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  diagnosisName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  severityIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  diagnosisDetails: {
    marginBottom: 8,
  },
  diagnosisType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  diagnosisCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  diagnosisDate: {
    fontSize: 14,
    color: '#666',
  },
  diagnosisSection: {
    marginTop: 8,
  },
  diagnosisSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  diagnosisDescription: {
    fontSize: 14,
    color: '#333',
  },
  diagnosisNotes: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
});

export default ClinicPet; 