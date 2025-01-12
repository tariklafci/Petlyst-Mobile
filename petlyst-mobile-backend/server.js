const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const petRoutes = require('./routes/petRoutes');
const clinicRoutes = require('./routes/clinicRoutes');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Use routes
app.use('/api', authRoutes);
app.use('/api', petRoutes);
app.use('/api', clinicRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://192.168.1.100:${port}`);
});

