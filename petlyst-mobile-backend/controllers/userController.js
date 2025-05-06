const pool = require('../config/db');
const bcrypt = require('bcrypt');

/**
 * Get user profile data
 */
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const result = await pool.query(
      `SELECT user_id, user_name, user_surname, user_email, user_phone, user_address, user_profile_photo
       FROM users 
       WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    
    res.status(200).json({
      user_id: user.user_id,
      user_name: user.user_name,
      user_surname: user.user_surname,
      user_email: user.user_email,
      user_phone: user.user_phone,
      user_address: user.user_address,
      user_profile_photo: user.user_profile_photo
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

/**
 * Update user profile information
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { email, phone, address } = req.body;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if email is already used by another user
    if (email) {
      const emailCheck = await pool.query(
        'SELECT user_id FROM users WHERE user_email = $1 AND user_id != $2',
        [email, userId]
      );
      
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Email is already in use by another account' });
      }
    }
    
    // Update the user profile
    const updateQuery = `
      UPDATE users 
      SET 
        user_email = $1,
        user_phone = $2,
        user_address = $3,
        user_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4
      RETURNING user_id, user_name, user_surname, user_email, user_phone, user_address, user_profile_photo
    `;
    
    const result = await pool.query(updateQuery, [email, phone, address, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const updatedUser = result.rows[0];
    
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        user_id: updatedUser.user_id,
        user_name: updatedUser.user_name,
        user_surname: updatedUser.user_surname,
        user_email: updatedUser.user_email,
        user_phone: updatedUser.user_phone,
        user_address: updatedUser.user_address,
        user_profile_photo: updatedUser.user_profile_photo
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

/**
 * Update user profile photo
 */
exports.updateProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { photoUrl } = req.body;
    
    if (!photoUrl) {
      return res.status(400).json({ message: 'No photo URL provided' });
    }
    
    const updateQuery = `
      UPDATE users 
      SET 
        user_profile_photo = $1,
        user_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING user_id, user_profile_photo
    `;
    
    const result = await pool.query(updateQuery, [photoUrl, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      message: 'Profile photo updated successfully',
      user_profile_photo: result.rows[0].user_profile_photo
    });
  } catch (error) {
    console.error('Error updating profile photo:', error);
    res.status(500).json({ message: 'Server error while updating profile photo' });
  }
}; 