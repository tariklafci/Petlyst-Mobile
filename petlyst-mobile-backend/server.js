const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
require('dotenv').config();


const authRoutes = require('./routes/authRoutes');
const petRoutes = require('./routes/petRoutes');
const clinicRoutes = require('./routes/clinicRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const jitsiRoutes = require('./routes/jitsiRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ollamaRoutes = require('./routes/ollamaRoutes');
const ollamaInventoryRoutes = require('./routes/ollamaInventoryRoutes');
const app = express();
const PORT = process.env.PORT;

const privateKey = fs.readFileSync('/home/ubuntu/certs/privkey1.pem', 'utf8');
const certificate = fs.readFileSync('/home/ubuntu/certs/fullchain1.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Middleware
app.use(express.json()); // For parsing JSON
app.use(express.urlencoded({ extended: true })); // For parsing form-encoded (x-www-form-urlencoded)
app.use(cors());


// Use routes
app.use('/api', authRoutes);
app.use('/api', petRoutes);
app.use('/api', clinicRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', jitsiRoutes);
app.use('/api', notificationRoutes);
app.use('/api', ollamaRoutes);
app.use('/api', ollamaInventoryRoutes);
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {
  console.log(`Server is running on https://petlyst.com:${PORT}`);
});
