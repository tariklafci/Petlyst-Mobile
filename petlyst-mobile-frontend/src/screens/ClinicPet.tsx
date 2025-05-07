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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@react-native-community/datetimepicker';

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

type Hospitalization = {
  id: number;
  room_id: number;
  pet_id: number;
  admission_date: string;
  expected_discharge_date?: string;
  actual_discharge_date?: string;
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
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [hospitalizations, setHospitalizations] = useState<Hospitalization[]>([]);
  const [roomHospitalization, setRoomHospitalization] = useState<Hospitalization | null>(null);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admissionDate, setAdmissionDate] = useState(new Date());
  const [expectedDischargeDate, setExpectedDischargeDate] = useState<Date | null>(null);
  const [showAdmissionDatePicker, setShowAdmissionDatePicker] = useState(false);
  const [showDischargeDatePicker, setShowDischargeDatePicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRooms(),
        fetchPatients(),
        fetchHospitalizations(),
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

  const fetchHospitalizations = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch('https://petlyst.com:3001/api/clinic-hospitalizations', {
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
      setHospitalizations(data);
    } catch (error) {
      console.error('Error fetching hospitalizations:', error);
    }
  };

  const fetchRoomHospitalization = async (roomId: number) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`https://petlyst.com:3001/api/room-hospitalization/${roomId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching room hospitalization:', error);
      return null;
    }
  };

  const fetchPatientExaminations = async (petId: number) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`https://petlyst.com:3001/api/clinic-examinations/${petId}`, {
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
      const response = await fetch(`https://petlyst.com:3001/api/clinic-diagnoses/${examinationId}`, {
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

  const handleRoomSelect = async (room: Room) => {
    setSelectedRoom(room);
    setRoomModalVisible(true);
    
    // Fetch current hospitalization for this room
    const hospitalization = await fetchRoomHospitalization(room.id);
    setRoomHospitalization(hospitalization);
  };

  const handleExaminationSelect = async (examination: Examination) => {
    // Fetch diagnoses for this examination
    const diagnosesData = await fetchExaminationDiagnoses(examination.examination_id);
    setDiagnoses(diagnosesData);
    setDiagnosisModalVisible(true);
  };

  const dischargePet = async (hospitalizationId: number) => {
    try {
      setIsSubmitting(true);
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`https://petlyst.com:3001/api/discharge-pet/${hospitalizationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actualDischargeDate: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return false;
      }
      
      // Refresh data
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error discharging pet:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignPatientToRoom = async (roomId: number, petId: number) => {
    try {
      setIsSubmitting(true);
      
      if (!admissionDate) {
        console.error('Admission date is required');
        return false;
      }
      
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch('https://petlyst.com:3001/api/create-hospitalization', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomId,
          petId: petId,
          admissionDate: admissionDate.toISOString(),
          expectedDischargeDate: expectedDischargeDate ? expectedDischargeDate.toISOString() : null
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server returned error:', errorText);
        return false;
      }
      
      // Refresh data
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error assigning patient to room:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAssignModal = (room: Room) => {
    setSelectedRoom(room);
    setAssignModalVisible(true);
    setAdmissionDate(new Date());
    setExpectedDischargeDate(null);
  };

  const handleDischargePatient = async () => {
    if (!roomHospitalization) return;
    
    const success = await dischargePet(roomHospitalization.id);
    if (success) {
      setRoomModalVisible(false);
    }
  };

  const handleAssignPatient = async (patient: Patient) => {
    if (!selectedRoom) return;
    
    const success = await assignPatientToRoom(selectedRoom.id, patient.pet_id);
    if (success) {
      // Update the room status in local state immediately
      setRooms(prevRooms => 
        prevRooms.map(room => 
          room.id === selectedRoom.id 
            ? { ...room, room_status: 'occupied' } 
            : room
        )
      );
      
      // Update the selected room state to reflect the new status
      setSelectedRoom(prevRoom => 
        prevRoom ? { ...prevRoom, room_status: 'occupied' } : null
      );
      
      setAssignModalVisible(false);
      // Refresh room modal data
      const hospitalization = await fetchRoomHospitalization(selectedRoom.id);
      setRoomHospitalization(hospitalization);
    }
  };

  const renderRoomItem = ({ item }: { item: Room }) => {
    const statusColor = 
      item.room_status === 'vacant' ? '#4CAF50' : 
      item.room_status === 'occupied' ? '#FF9800' : '#F44336';
    
    const roomTypeLabel = 
      item.room_type === 'standard' ? 'Standard' : 
      item.room_type === 'isolation' ? 'Isolation' : 'Intensive Care';
    
    return (
      <TouchableOpacity 
        style={styles.roomCard}
        onPress={() => handleRoomSelect(item)}
      >
        <View style={styles.roomHeader}>
          <Text style={styles.roomName}>{item.room_name}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {item.room_status.charAt(0).toUpperCase() + item.room_status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.roomType}>{roomTypeLabel}</Text>
      </TouchableOpacity>
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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roomsListContainer}
            >
              {rooms.map(room => (
                <TouchableOpacity 
                  key={room.id.toString()}
                  onPress={() => handleRoomSelect(room)}
                >
                  {renderRoomItem({ item: room })}
                </TouchableOpacity>
              ))}
            </ScrollView>
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

      {/* Room Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={roomModalVisible}
        onRequestClose={() => setRoomModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedRoom?.room_name}
              </Text>
              <TouchableOpacity onPress={() => setRoomModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalSectionTitle}>Room Information</Text>
              
              <View style={styles.patientDetailItem}>
                <Text style={styles.patientDetailLabel}>Room Type:</Text>
                <Text style={styles.patientDetailValue}>
                  {selectedRoom?.room_type === 'standard' ? 'Standard' : 
                   selectedRoom?.room_type === 'isolation' ? 'Isolation' : 'Intensive Care'}
                </Text>
              </View>
              
              <View style={styles.patientDetailItem}>
                <Text style={styles.patientDetailLabel}>Status:</Text>
                <View style={[
                  styles.roomStatusTag,
                  { 
                    backgroundColor: 
                      selectedRoom?.room_status === 'vacant' ? '#4CAF50' : 
                      selectedRoom?.room_status === 'occupied' ? '#FF9800' : '#F44336'
                  }
                ]}>
                  <Text style={styles.roomStatusTagText}>
                    {selectedRoom?.room_status ? selectedRoom.room_status.charAt(0).toUpperCase() + selectedRoom.room_status.slice(1) : ''}
                  </Text>
                </View>
              </View>
              
              <View style={styles.patientDetailItem}>
                <Text style={styles.patientDetailLabel}>Created:</Text>
                <Text style={styles.patientDetailValue}>
                  {selectedRoom ? new Date(selectedRoom.created_at).toLocaleDateString() : ''}
                </Text>
              </View>
              
              <View style={styles.patientDetailItem}>
                <Text style={styles.patientDetailLabel}>Last Updated:</Text>
                <Text style={styles.patientDetailValue}>
                  {selectedRoom ? new Date(selectedRoom.updated_at).toLocaleDateString() : ''}
                </Text>
              </View>

              {selectedRoom?.room_status === 'occupied' && (
                <View style={styles.occupiedRoomActions}>
                  {roomHospitalization ? (
                    <View style={styles.occupiedRoomContent}>
                      <Text style={styles.occupiedRoomTitle}>Current Patient</Text>
                      <View style={styles.hospitalizedPatientCard}>
                        <View style={styles.patientDetailItem}>
                          <Text style={styles.patientDetailLabel}>Pet Name:</Text>
                          <Text style={styles.patientDetailValue}>{roomHospitalization.pet_name}</Text>
                        </View>
                        {roomHospitalization.pet_species && (
                          <View style={styles.patientDetailItem}>
                            <Text style={styles.patientDetailLabel}>Species:</Text>
                            <Text style={styles.patientDetailValue}>{roomHospitalization.pet_species}</Text>
                          </View>
                        )}
                        {roomHospitalization.pet_breed && (
                          <View style={styles.patientDetailItem}>
                            <Text style={styles.patientDetailLabel}>Breed:</Text>
                            <Text style={styles.patientDetailValue}>{roomHospitalization.pet_breed}</Text>
                          </View>
                        )}
                        <View style={styles.patientDetailItem}>
                          <Text style={styles.patientDetailLabel}>Admitted:</Text>
                          <Text style={styles.patientDetailValue}>
                            {new Date(roomHospitalization.admission_date).toLocaleDateString()}
                          </Text>
                        </View>
                        {roomHospitalization.expected_discharge_date && (
                          <View style={styles.patientDetailItem}>
                            <Text style={styles.patientDetailLabel}>Expected Discharge:</Text>
                            <Text style={styles.patientDetailValue}>
                              {new Date(roomHospitalization.expected_discharge_date).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity 
                        style={styles.dischargeButton}
                        onPress={handleDischargePatient}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="exit-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.dischargeButtonText}>Discharge Patient</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.occupiedRoomError}>
                      <Text style={styles.occupiedRoomErrorText}>
                        This room is marked as occupied but no patient information is available
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {selectedRoom?.room_status === 'vacant' && (
                <View style={styles.occupiedRoomActions}>
                  <TouchableOpacity 
                    style={styles.roomActionButton}
                    onPress={() => handleOpenAssignModal(selectedRoom)}
                  >
                    <Ionicons name="add-circle" size={20} color="#4CAF50" />
                    <Text style={styles.roomActionButtonText}>Assign Patient</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                        <Text style={styles.examinationDetail}>RR: {exam.respiratory_rate}</Text>
                      )}
                      {exam.weight && (
                        <Text style={styles.examinationDetail}>Weight: {exam.weight} kg</Text>
                      )}
                    </View>
                    {exam.notes && (
                      <Text style={styles.examinationNotes} numberOfLines={2}>{exam.notes}</Text>
                    )}
                    <View style={styles.examinationFooter}>
                      <Text style={styles.examinationViewMore}>View details and diagnoses</Text>
                      <Ionicons name="chevron-forward" size={16} color="#4285F4" />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noExamsText}>No examinations recorded for this patient</Text>
              )}
            </ScrollView>

            <View style={styles.modalActionsContainer}>
              {/* Button removed while preserving the container */}
            </View>
          </View>
        </View>
      </Modal>

      {/* Diagnosis Modal */}
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
                          styles.severityBadge,
                          {
                            backgroundColor: 
                              diagnosis.severity === 'mild' ? '#4CAF50' : 
                              diagnosis.severity === 'moderate' ? '#FF9800' : '#F44336'
                          }
                        ]}>
                          <Text style={styles.severityText}>{diagnosis.severity}</Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={styles.diagnosisDate}>
                      Date: {new Date(diagnosis.diagnosis_date).toLocaleDateString()}
                    </Text>
                    
                    {diagnosis.diagnosis_code && (
                      <Text style={styles.diagnosisCode}>Code: {diagnosis.diagnosis_code}</Text>
                    )}
                    
                    {diagnosis.description && (
                      <Text style={styles.diagnosisDescription}>{diagnosis.description}</Text>
                    )}
                    
                    {diagnosis.notes && (
                      <View style={styles.diagnosisNotes}>
                        <Text style={styles.diagnosisNotesLabel}>Notes:</Text>
                        <Text style={styles.diagnosisNotesText}>{diagnosis.notes}</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noDiagnosesText}>No diagnoses recorded for this examination</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assign Patient Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={assignModalVisible}
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Patient to {selectedRoom?.room_name}
              </Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalSectionTitle}>Hospitalization Details</Text>
              
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerLabel}>Admission Date:</Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={() => setShowAdmissionDatePicker(true)}
                >
                  <Text style={styles.datePickerText}>
                    {admissionDate.toLocaleDateString()}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#4285F4" />
                </TouchableOpacity>
                {showAdmissionDatePicker && (
                  <DateTimePicker
                    value={admissionDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowAdmissionDatePicker(false);
                      if (selectedDate) {
                        setAdmissionDate(selectedDate);
                      }
                    }}
                  />
                )}
              </View>
              
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerLabel}>Expected Discharge Date (Optional):</Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={() => setShowDischargeDatePicker(true)}
                >
                  <Text style={styles.datePickerText}>
                    {expectedDischargeDate ? expectedDischargeDate.toLocaleDateString() : 'Not set'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#4285F4" />
                </TouchableOpacity>
                {showDischargeDatePicker && (
                  <DateTimePicker
                    value={expectedDischargeDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDischargeDatePicker(false);
                      if (selectedDate) {
                        setExpectedDischargeDate(selectedDate);
                      }
                    }}
                  />
                )}
              </View>

              <Text style={styles.modalSectionTitle}>Select Patient</Text>
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <TouchableOpacity 
                    key={patient.id}
                    style={styles.assignPatientCard}
                    onPress={() => handleAssignPatient(patient)}
                    disabled={isSubmitting}
                  >
                    <View style={styles.assignPatientInfo}>
                      <Text style={styles.assignPatientName}>
                        {patient.pet_name || `Pet #${patient.pet_id}`}
                      </Text>
                      <Text style={styles.assignPatientSpecies}>
                        {patient.pet_species ? `${patient.pet_species}${patient.pet_breed ? ` - ${patient.pet_breed}` : ''}` : 'Unknown species'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#CCCCCC" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>No patients available</Text>
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
    backgroundColor: '#f5f5f7',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#333',
  },
  roomsListContainer: {
    paddingBottom: 10,
  },
  roomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    marginBottom: 8,
    width: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  roomType: {
    fontSize: 14,
    color: '#666',
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  patientIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  patientInfo: {
    flex: 1,
    justifyContent: 'center',
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
    fontSize: 13,
    color: '#888',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScrollView: {
    padding: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  patientDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  patientDetailLabel: {
    fontSize: 15,
    color: '#666',
  },
  patientDetailValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  examinationItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  examinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  examinationDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  examinationStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  examinationStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  examinationDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  examinationDetail: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 13,
    color: '#4285F4',
  },
  examinationNotes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  examinationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  examinationViewMore: {
    fontSize: 13,
    color: '#4285F4',
    marginRight: 4,
  },
  noExamsText: {
    fontSize: 15,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  modalActionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  modalActionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  examButton: {
    backgroundColor: '#4285F4',
  },
  updateButton: {
    backgroundColor: '#4CAF50',
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  diagnosisItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
    marginRight: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  diagnosisDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  diagnosisCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  diagnosisDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  diagnosisNotes: {
    backgroundColor: '#F0F0F0',
    padding: 10,
    borderRadius: 8,
  },
  diagnosisNotesLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  diagnosisNotesText: {
    fontSize: 14,
    color: '#333',
  },
  noDiagnosesText: {
    fontSize: 15,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  roomStatusTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  roomStatusTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  occupiedRoomActions: {
    marginTop: 16,
  },
  roomActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
  },
  roomActionButtonText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
  occupiedRoomContent: {
    marginTop: 8,
    marginBottom: 8,
  },
  occupiedRoomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  hospitalizedPatientCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  dischargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  dischargeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  occupiedRoomError: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
  },
  occupiedRoomErrorText: {
    color: '#B71C1C',
    fontSize: 14,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  datePickerLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  datePickerText: {
    fontSize: 15,
    color: '#333',
  },
  assignPatientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  assignPatientInfo: {
    flex: 1,
  },
  assignPatientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  assignPatientSpecies: {
    fontSize: 14,
    color: '#666',
  },
});

export default ClinicPet; 