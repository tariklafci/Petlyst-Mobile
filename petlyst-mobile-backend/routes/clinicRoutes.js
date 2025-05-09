const express = require('express');
const router = express.Router();
const { 
  fetchClinics, 
  fetchClinicsAppointment, 
  fetchClinicsVeterinarian, 
  fetchClinicCoordinates,
  fetchClinicHospitalizationRooms,
  fetchClinicPatients,
  fetchPetExaminations,
  fetchExaminationDiagnoses,
  fetchPetHospitalizations,
  fetchRoomHospitalization,
  createPetHospitalization,
  dischargePet
} = require('../controllers/clinicController');
const authenticateToken = require('../middlewares/authenticateToken');


// GET /fetch-clinics
router.get('/fetch-clinics', authenticateToken, fetchClinics);
router.get('/fetch-clinic-info-appointments', authenticateToken, fetchClinicsAppointment);
router.get('/fetch-clinic-veterinarian', authenticateToken, fetchClinicsVeterinarian);
router.get('/fetch-clinic-coordinates', authenticateToken, fetchClinicCoordinates);

// Clinic pet management routes
router.get('/clinic-hospitalization-rooms', authenticateToken, fetchClinicHospitalizationRooms);
router.get('/clinic-patients', authenticateToken, fetchClinicPatients);
router.get('/clinic-examinations/:petId', authenticateToken, fetchPetExaminations);
router.get('/clinic-diagnoses/:examinationId', authenticateToken, fetchExaminationDiagnoses);

// Hospitalization management routes
router.get('/clinic-hospitalizations', authenticateToken, fetchPetHospitalizations);
router.get('/room-hospitalization/:roomId', authenticateToken, fetchRoomHospitalization);
router.post('/create-hospitalization', authenticateToken, createPetHospitalization);
router.post('/discharge-pet/:hospitalizationId', authenticateToken, dischargePet);

module.exports = router;
