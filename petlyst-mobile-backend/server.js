const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const petRoutes = require('./routes/petRoutes');
const clinicRoutes = require('./routes/clinicRoutes');

const app = express();
const PORT = process.env.PORT;

const privateKey = fs.readFileSync('/home/ubuntu/privkey1.pem', 'utf8');
const certificate = fs.readFileSync('/home/ubuntu/fullchain1.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Use routes
app.use('/api', authRoutes);
app.use('/api', petRoutes);
app.use('/api', clinicRoutes);

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {
  console.log(`Server is running on https://petlyst.com:${PORT}`);
});

