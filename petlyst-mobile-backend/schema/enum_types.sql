-- Create appointment_status_enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status_enum') THEN
        CREATE TYPE appointment_status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
    END IF;
END$$; 