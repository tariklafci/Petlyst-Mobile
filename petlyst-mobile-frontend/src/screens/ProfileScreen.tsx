import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const ProfileScreen = () => {
  const [selectedIndex, setSelectedIndex] = useState(1); // Default selection (Active)

  const options = ['Pending', 'Active', 'Completed'];

  return (
    <><View>
      <Text style={styles.appointmentsText}>My Appointments</Text>
      </View>
    
    <View style={styles.container}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.segment,
            selectedIndex === index && styles.selectedSegment,
          ]}
          onPress={() => setSelectedIndex(index)}
        >
          <Text
            style={[
              styles.text,
              selectedIndex === index && styles.selectedText,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View></>
  );
};
const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    //marginTop: '30',
    flexDirection: 'row',
    backgroundColor: '#f5f7fb', // Light background for the entire segmented control
    borderRadius: 25,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: width*.9,
    alignSelf: 'center',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 25,
    marginHorizontal: 2,
  },
  selectedSegment: {
    backgroundColor: '#ffffff', // White for the selected segment
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: 14,
    color: '#7f8c8d', // Gray color for unselected text
    fontWeight: '500',
  },
  selectedText: {
    color: '#000', // Black color for selected text
    fontWeight: 'bold',
  },
  appointmentsText:{
    alignSelf:'center',
    //marginTop: '20',
    fontSize: 24,
    fontWeight: 'bold',
  }
});

export default ProfileScreen;