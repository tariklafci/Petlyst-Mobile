import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Picker } from '@react-native-picker/picker';
import * as SecureStore from 'expo-secure-store';


type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
type CreationStatus     = 'DRAFT'   | 'SUBMITTED' | 'APPROVED';
type ClinicType         = 'GENERAL' | 'SPECIALTY' | 'EMERGENCY';

interface Clinic {
  id: number;
  clinic_name: string;
  clinic_email: string;
  clinic_description: string;
  opening_time: string;        // "HH:mm"
  closing_time: string;        // "HH:mm"
  clinic_verification_status: VerificationStatus;
  establishment_year: number;
  show_phone_number: boolean;
  allow_direct_messages: boolean;
  clinic_creation_status: CreationStatus;
  show_email_address: boolean;
  allow_online_meetings: boolean;
  available_days: boolean[];   // [Sun,Mon,...,Sat]
  clinic_time_slots: number;
  is_open_24_7: boolean;
  clinic_type: ClinicType;
  clinic_address: string;
  slug: string;
}

 const VetDashboardScreen = ({ navigation }: { navigation: any }) => {


  //–– Local state for every field (defaults to empty)
  const [clinicName, setClinicName] = useState('');
  const [clinicEmail, setClinicEmail] = useState('');
  const [clinicDescription, setClinicDescription] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [slug, setSlug] = useState('');
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [showOpeningPicker, setShowOpeningPicker] = useState(false);
  const [showClosingPicker, setShowClosingPicker] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('PENDING');
  const [creationStatus, setCreationStatus] = useState<CreationStatus>('DRAFT');
  const [clinicType, setClinicType] = useState<ClinicType>('GENERAL');
  const [establishmentYear, setEstablishmentYear] = useState('');
  const [clinicTimeSlots, setClinicTimeSlots] = useState('');
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [allowDMs, setAllowDMs] = useState(false);
  const [showEmailAddress, setShowEmailAddress] = useState(false);
  const [allowOnlineMeetings, setAllowOnlineMeetings] = useState(false);
  const [isOpen247, setIsOpen247] = useState(false);
  const [availableDays, setAvailableDays] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


  const fetchClinicId = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        return;
      }
      
      const response = await fetch(`https://petlyst.com:3001/api/fetch-clinic-veterinarians`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch appointments');
      }
      
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  //–– Helper to format time
  const handleTimeConfirm = (
    date: Date,
    setter: React.Dispatch<React.SetStateAction<string>>,
    hidePicker: () => void
  ) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    setter(`${hh}:${mm}`);
    hidePicker();
  };

  //–– Toggle one day
  const toggleDay = (idx: number) => {
    setAvailableDays(d =>
      d.map((val, i) => (i === idx ? !val : val))
    );
  };

  //–– Save (you’ll wire this up when your PATCH endpoint is ready)
  const handleSave = () => {
    const payload = {
      clinic_name: clinicName,
      clinic_email: clinicEmail,
      clinic_description: clinicDescription,
      clinic_address: clinicAddress,
      slug,
      opening_time: openingTime,
      closing_time: closingTime,
      clinic_verification_status: verificationStatus,
      clinic_creation_status: creationStatus,
      clinic_type: clinicType,
      establishment_year: Number(establishmentYear),
      clinic_time_slots: Number(clinicTimeSlots),
      show_phone_number: showPhoneNumber,
      allow_direct_messages: allowDMs,
      show_email_address: showEmailAddress,
      allow_online_meetings: allowOnlineMeetings,
      is_open_24_7: isOpen247,
      available_days: availableDays
    };
    console.log('SAVE PAYLOAD >>>', payload);
    Alert.alert('Saved (mock)', JSON.stringify(payload, null, 2));
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Clinic Details</Text>

      {/* -- name & email -- */}
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={clinicEmail}
        onChangeText={setClinicEmail}
        keyboardType="email-address"
      />

      {/* -- description & address -- */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={clinicDescription}
        onChangeText={setClinicDescription}
        multiline
      />

      <Text style={styles.label}>Address</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={clinicAddress}
        onChangeText={setClinicAddress}
        multiline
      />

      {/* -- slug -- */}
      <Text style={styles.label}>Slug</Text>
      <TextInput style={styles.input} value={slug} onChangeText={setSlug} />

      {/* -- times -- */}
      <Text style={styles.label}>Open</Text>
      <TouchableOpacity
        style={styles.timeButton}
        onPress={() => setShowOpeningPicker(true)}
      >
        <Text>{openingTime}</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={showOpeningPicker}
        mode="time"
        onConfirm={date => handleTimeConfirm(date, setOpeningTime, () => setShowOpeningPicker(false))}
        onCancel={() => setShowOpeningPicker(false)}
      />

      <Text style={styles.label}>Close</Text>
      <TouchableOpacity
        style={styles.timeButton}
        onPress={() => setShowClosingPicker(true)}
      >
        <Text>{closingTime}</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={showClosingPicker}
        mode="time"
        onConfirm={date => handleTimeConfirm(date, setClosingTime, () => setShowClosingPicker(false))}
        onCancel={() => setShowClosingPicker(false)}
      />

      {/* -- enums -- */}
      <Text style={styles.label}>Verification</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={verificationStatus}
          onValueChange={v => setVerificationStatus(v as VerificationStatus)}
        >
          <Picker.Item label="Pending" value="PENDING" />
          <Picker.Item label="Verified" value="VERIFIED" />
          <Picker.Item label="Rejected" value="REJECTED" />
        </Picker>
      </View>

      <Text style={styles.label}>Creation Status</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={creationStatus}
          onValueChange={v => setCreationStatus(v as CreationStatus)}
        >
          <Picker.Item label="Draft" value="DRAFT" />
          <Picker.Item label="Submitted" value="SUBMITTED" />
          <Picker.Item label="Approved" value="APPROVED" />
        </Picker>
      </View>

      <Text style={styles.label}>Type</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={clinicType}
          onValueChange={v => setClinicType(v as ClinicType)}
        >
          <Picker.Item label="General" value="GENERAL" />
          <Picker.Item label="Specialty" value="SPECIALTY" />
          <Picker.Item label="Emergency" value="EMERGENCY" />
        </Picker>
      </View>

      {/* -- numbers -- */}
      <Text style={styles.label}>Year Est.</Text>
      <TextInput
        style={styles.input}
        value={establishmentYear}
        onChangeText={setEstablishmentYear}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Time Slots</Text>
      <TextInput
        style={styles.input}
        value={clinicTimeSlots}
        onChangeText={setClinicTimeSlots}
        keyboardType="numeric"
      />

      {/* -- flags -- */}
      {[
        ['Show Phone', showPhoneNumber, setShowPhoneNumber],
        ['Direct Messages', allowDMs, setAllowDMs],
        ['Show Email', showEmailAddress, setShowEmailAddress],
        ['Online Meetings', allowOnlineMeetings, setAllowOnlineMeetings],
        ['Open 24/7', isOpen247, setIsOpen247]
      ].map(([label, val, setter]) => (
        <View style={styles.switchRow} key={label as string}>
          <Text style={styles.label}>{label}</Text>
          <Switch value={val as boolean} onValueChange={setter as any} />
        </View>
      ))}

      {/* -- available days -- */}
      <Text style={styles.label}>Days</Text>
      <View style={styles.daysRow}>
        {daysOfWeek.map((d, i) => (
          <TouchableOpacity
            key={d}
            style={[
              styles.dayBox,
              availableDays[i] && styles.dayBoxSelected
            ]}
            onPress={() => toggleDay(i)}
          >
            <Text style={ availableDays[i] ? styles.dayTextSelected : styles.dayText }>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Clinic</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, marginTop: 15, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 10, backgroundColor: '#fafafa'
  },
  timeButton: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 12, backgroundColor: '#fafafa', alignItems: 'center'
  },
  pickerWrapper: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6, overflow: 'hidden'
  },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 10
  },
  daysRow: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 5
  },
  dayBox: {
    borderWidth: 1, borderColor: '#888', borderRadius: 4,
    padding: 8, margin: 3
  },
  dayBoxSelected: {
    backgroundColor: '#6c63ff', borderColor: '#6c63ff'
  },
  dayText: { color: '#333' },
  dayTextSelected: { color: '#fff' },
  saveButton: {
    backgroundColor: '#6c63ff', padding: 15,
    borderRadius: 6, alignItems: 'center', marginVertical: 30
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default VetDashboardScreen;