-- Create appointments table if it doesn't exist
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id SERIAL PRIMARY KEY,
    video_meeting BOOLEAN DEFAULT FALSE,
    pet_id INTEGER REFERENCES pets(pet_id) ON DELETE CASCADE,
    clinic_id INTEGER,
    veterinarian_id INTEGER,
    meeting_url TEXT,
    appointment_start_hour TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    appointment_status appointment_status_enum DEFAULT 'pending',
    notes TEXT,
    appointment_end_hour TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    meeting_password VARCHAR(255),
    appointment_date DATE NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date); 