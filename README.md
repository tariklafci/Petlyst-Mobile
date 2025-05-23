# Petlyst Mobile

![Petlyst Logo](petlyst-mobile-frontend/assets/petlyst-logo.jpeg)

## 📱 Overview

Petlyst is a comprehensive mobile application connecting pet owners with veterinary clinics. The platform provides a seamless experience for booking appointments, managing pet health records, accessing veterinary services, and communicating with veterinary professionals.

## ✨ Key Features

### For Pet Owners
- **Clinic Discovery**: Browse and find veterinary clinics with filtering options
- **Real-time Clinic Status**: See if clinics are currently open or closed
- **Emergency Mode**: Quickly locate the nearest veterinary clinic during emergencies
- **Pet Management**: Add, edit, and track your pets' health records
- **Appointment Scheduling**: Book appointments with preferred veterinarians
- **Video Consultations**: Connect with veterinarians through integrated video meetings
- **Treatment History**: View past diagnoses, treatments, and medical records
- **AI Assistant**: Get answers to common pet health questions through AI chat

### For Veterinarians
- **Appointment Management**: View and manage scheduled appointments
- **Patient Records**: Access pet health histories and treatment records
- **Clinic Dashboard**: Monitor clinic statistics and patient information
- **Inventory Management**: Track medical supplies and medications
- **Remote Consultations**: Conduct video appointments with pet owners

## 🚀 Technology Stack

### Frontend (Mobile App)
- **Framework**: React Native with Expo
- **Navigation**: React Navigation
- **State Management**: Context API
- **UI Components**: Native components with custom styling
- **Maps & Location**: React Native Maps, Expo Location
- **Notifications**: Expo Notifications
- **Video Meetings**: Jitsi Meet integration
- **API Communication**: Axios

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3
- **Notifications**: Expo Push Notifications
- **Email Services**: Nodemailer
- **AI Integration**: Ollama API

## 📋 Prerequisites

- Node.js (v14.0 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- PostgreSQL database

## 🔧 Installation & Setup

### Clone the Repository
```bash
git clone https://github.com/yourusername/Petlyst-Mobile.git
cd Petlyst-Mobile
```

### Frontend Setup
```bash
cd petlyst-mobile-frontend
npm install
```

### Backend Setup
```bash
cd ../petlyst-mobile-backend
npm install
```

### Environment Variables

#### Frontend (.env)
```
API_URL=https://your-backend-url.com/api
MAPS_API_KEY=your_google_maps_api_key
```

#### Backend (.env)
```
PORT=3000
DB_USER=postgres_user
DB_PASSWORD=postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petlyst_db
JWT_SECRET=your_jwt_secret
S3_ACCESS_KEY=your_aws_access_key
S3_SECRET_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_s3_bucket_name
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

### Database Setup
1. Create a PostgreSQL database named `petlyst_db`
2. Run the database migration scripts (not included in this repository)

## 🚀 Running the Application

### Start the Backend Server
```bash
cd petlyst-mobile-backend
npm start
```

### Start the Frontend (Development)
```bash
cd petlyst-mobile-frontend
npm run android  # For Android
npm run ios      # For iOS (macOS only)
```

## 📱 Application Workflow

1. **User Authentication**: Register/login as a pet owner or veterinarian
2. **Pet Owners**: Add pets, browse clinics, schedule appointments
3. **Veterinarians**: Manage appointments, view patient records, update treatments
4. **Appointments**: In-person or video consultations
5. **Treatment Records**: View past diagnoses and treatments

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📧 Contact

For questions or support, please contact [developer@petlyst.com](mailto:developer@petlyst.com). 