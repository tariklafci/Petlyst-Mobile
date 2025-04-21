const { Upload } = require('@aws-sdk/lib-storage');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3pet, s3clinic } = require('../config/s3');

// Function to upload pet images to S3 bucket
async function uploadFileToS3(file, userId, name) {
  try {
    const upload = new Upload({
      client: s3pet,
      params: {
        Bucket: 'petlyst-s3',
        Key: `pet-photos/petowner-${userId}/${name}.jpeg`,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    const result = await upload.done();
    return result.Location; // Return the S3 URL
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
}

// Function to delete pet images from S3 bucket
async function deleteFileFromS3(ownerId, petName) {
  try {
    const key = `pet-photos/petowner-${ownerId}/${petName}.jpeg`;

    const params = {
      Bucket: 'petlyst-s3',
      Key: key,
    };

    const command = new DeleteObjectCommand(params);

    const result = await s3pet.send(command);

    return result;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
}

// Generate temporary url for pet photos
async function generatePresignedUrl(key, userId, name) {
  const command = new GetObjectCommand({
    Bucket: 'petlyst-s3',
    Key: `pet-photos/petowner-${userId}/${name}.jpeg`,
  });

  try {
    const url = await getSignedUrl(s3pet, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw error;
  }
}

// Generate temporary url for clinic photos
async function generatePresignedUrlClinic(s3key) {
  try {
    if (!s3key) {
      throw new Error('S3 key is required to generate a pre-signed URL.');
    }

    const command = new GetObjectCommand({
      Bucket: 'petlyst-s3',
      Key: s3key,
    });

    const url = await getSignedUrl(s3clinic, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw error;
  }
}

module.exports = {
  uploadFileToS3,
  deleteFileFromS3,
  generatePresignedUrl,
  generatePresignedUrlClinic,
};