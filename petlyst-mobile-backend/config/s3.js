const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3pet = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
  },
});

const s3clinic = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.accessKeyIdclinic,
    secretAccessKey: process.env.secretAccessKeyclinic,
  },
});

const s3user = new S3Client({
  region: 'eu-central-1',
});

module.exports = { s3pet, s3clinic, s3user };