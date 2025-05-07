const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/mailer');
require('dotenv').config();

// Login user
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Query to find the user by email
        const userQuery = await pool.query('SELECT * FROM users WHERE user_email = $1', [email]);


        // If user is not found, return invalid credentials
        if (userQuery.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = userQuery.rows[0];

        const vetQuery = await pool.query('SELECT * FROM veterinarians WHERE veterinarian_id = $1', [user.user_id]);

        const vet = vetQuery.rows[0];

        const clinicVetQuery = await pool.query('SELECT * FROM clinic_veterinarians WHERE veterinarian_id = $1', [user.user_id]);
        const clinic = clinicVetQuery.rows[0];

        if(clinicVetQuery.rowCount === 0 && user.user_type === 'veterinarian') {
            return res.status(401).json({ message: 'You are not registered to any clinic.' });
        }

        // Compare the input password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.user_password); // Updated to `user_password`

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if(user.user_type === 'veterinarian' && vet.veterinarian_verification_status === 'not_verified') {
            return res.status(401).json({ message: 'Please wait until the administrator verifies your account' });
        }

        // Set token expiration to 7 days
        const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
        
        // Generate a JWT token
        const token = jwt.sign({ sub: user.user_id, email: user.user_email }, process.env.SECRET_KEY, {
            expiresIn: `${expiresIn}s`,
        });

        // Respond with the token, user details, and expiration
        return res.json({
            token,
            user_id: user.user_id,
            user_type: user.user_type,
            expiresIn // Include expiration time in seconds
        });
    } catch (error) {
        console.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Refresh token
exports.refreshToken = async (req, res) => {
    try {
        // User object is attached by the auth middleware
        const userId = req.user.sub;
        
        // Get user information for new token
        const userQuery = await pool.query('SELECT user_id, user_email, user_type FROM users WHERE user_id = $1', [userId]);
        
        if (userQuery.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = userQuery.rows[0];
        
        // Set token expiration to 7 days
        const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
        
        // Generate a new JWT token
        const token = jwt.sign({ sub: user.user_id, email: user.user_email }, process.env.SECRET_KEY, {
            expiresIn: `${expiresIn}s`,
        });
        
        // Respond with the new token and expiration
        return res.json({
            token,
            user_id: user.user_id,
            user_type: user.user_type,
            expiresIn
        });
    } catch (error) {
        console.error('Error refreshing token:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Register user
exports.registerUser = async (req, res) => {
    const client = await pool.connect(); // Get a dedicated connection

    try {
        const { name, surname, email, password, user_type } = req.body;

        await client.query('BEGIN'); // Start transaction

        // Check if user already exists
        const existingUser = await client.query('SELECT user_email FROM users WHERE user_email = $1', [email]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK'); // Rollback transaction if user exists
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into users table and get the new user_id
        const userResult = await client.query(
            'INSERT INTO users (user_name, user_surname, user_email, user_password, user_type) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
            [name, surname, email, hashedPassword, user_type]
        );

        const userId = userResult.rows[0].user_id;

        // Insert into the appropriate table based on user_type
        if (user_type === 'veterinarian') {
            await client.query(
                'INSERT INTO veterinarians (veterinarian_id) VALUES ($1)',
                [userId]
            );
        } else if (user_type === 'pet_owner') {
            await client.query(
                'INSERT INTO pet_owners (pet_owner_id) VALUES ($1)',
                [userId]
            );
        }

        await client.query('COMMIT'); // Commit the transaction
        client.release(); // Release the connection

        return res.json({ message: 'User created successfully' });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction if an error occurs
        client.release(); // Release the connection
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Reset password (send code)
exports.resetPassword = async (req, res) => {
    const { email } = req.body;
    try {
        
        const userQuery = 'SELECT user_id, user_email FROM users WHERE user_email = $1';
        const userResult = await pool.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address',
            });
        }

        const verificationCode = crypto.randomInt(1000, 9999).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // First, try to insert the new token
        try {

            // Check if table exists first
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'password_reset_tokens'
                );
            `);

            if (!tableCheck.rows[0].exists) {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS password_reset_tokens (
                        reset_token_id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(user_id),
                        user_email VARCHAR(255) NOT NULL,
                        reset_code VARCHAR(255) NOT NULL,
                        reset_token_expires_at TIMESTAMP NOT NULL,
                        reset_token_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        reset_token_is_used BOOLEAN DEFAULT FALSE
                    );
                `);
            }

            const insertQuery = `
                INSERT INTO password_reset_tokens (user_id, user_email, reset_code, reset_token_expires_at)
                VALUES ($1, $2, $3, $4)
                RETURNING reset_token_id
            `;
            const insertResult = await pool.query(insertQuery, [
                userResult.rows[0].user_id,
                email,
                verificationCode,
                expiresAt
            ]);

            // Then delete old tokens for this user
            const deleteQuery = `
                DELETE FROM password_reset_tokens 
                WHERE user_email = $1 
                AND reset_token_id != $2
            `;
            const deleteResult = await pool.query(deleteQuery, [email, insertResult.rows[0].reset_token_id]);

            const mailOptions = {
                from: {
                    name: 'Petlyst Support',
                    address: process.env.EMAIL_USER,
                },
                to: email,
                subject: 'Password Reset Code - Petlyst',
                html: `
                    <div>Your verification code is: <strong>${verificationCode}</strong></div>
                `,
            };

            try {
                await transporter.sendMail(mailOptions);

                res.status(200).json({
                    success: true,
                    message: 'Verification code has been sent to your email',
                });
            } catch (emailError) {
                console.error('Email sending error:', emailError);
                // Even if email fails, we still created the token successfully
                res.status(200).json({
                    success: true,
                    message: 'Verification code has been generated',
                });
            }
        } catch (dbError) {
            console.error('Database error during token creation:', dbError);
            console.error('Error details:', {
                code: dbError.code,
                message: dbError.message,
                detail: dbError.detail,
                hint: dbError.hint,
                stack: dbError.stack
            });
            res.status(500).json({
                success: false,
                message: 'Failed to create reset token',
                error: dbError.message
            });
        }
    } catch (error) {
        console.error('Error processing password reset request:', error);
        console.error('Full error:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request',
            error: error.message
        });
    }
};

// Verify reset code
exports.verifyResetCode = async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const tokenQuery = `
        SELECT * FROM password_reset_tokens 
        WHERE user_email = $1 
        AND reset_code = $2 
        AND reset_token_expires_at > CURRENT_TIMESTAMP 
        AND reset_token_is_used = FALSE 
        ORDER BY reset_token_created_at DESC 
        LIMIT 1
        `;
        const tokenResult = await pool.query(tokenQuery, [email, code]);

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code',
            });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const updateQuery = 'UPDATE users SET user_password = $1 WHERE user_email = $2'; // Updated to `user_password`
        await pool.query(updateQuery, [hashedPassword, email]);

        const markUsedQuery = 'UPDATE password_reset_tokens SET reset_token_is_used = TRUE WHERE user_id = $1';
        await pool.query(markUsedQuery, [tokenResult.rows[0].user_id]);

        return res.status(200).json({
            success: true,
            message: 'Password has been reset successfully',
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reset password',
        });
    }

};

exports.addExpoToken = async (req, res) => {
    const client = await pool.connect();
  
    try {
      const { expoToken } = req.body;
      const userId = req.user.sub;
  
      if (!expoToken) {
        client.release();
        return res.status(400).json({ message: 'Expo token is required.' });
      }
  
      await client.query('BEGIN');
  
      // Check if the token already exists for this user
      const existingToken = await client.query(
        'SELECT * FROM user_tokens WHERE user_id = $1 AND user_token_expo = $2',
        [userId, expoToken]
      );
  
      if (existingToken.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(200).json({ message: 'Expo token already exists for this user.' });
      }
  
      // Insert the new token
      await client.query(
        'INSERT INTO user_tokens (user_id, user_token_expo) VALUES ($1, $2)',
        [userId, expoToken]
      );
  
      await client.query('COMMIT');
      client.release();
  
      return res.json({ message: 'Expo token added successfully.' });
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      console.error('Error inserting expo token:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };
    
/**
 * Delete all expo tokens for a user when signing out
 */
exports.deleteExpoTokens = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.sub;
    
    // Option 1: Delete specific token if provided
    const { expoToken } = req.body;
    
    let deleteQuery;
    let queryParams;
    
    if (expoToken) {
      // Delete specific token
      deleteQuery = 'DELETE FROM user_tokens WHERE user_id = $1 AND user_token_expo = $2';
      queryParams = [userId, expoToken];
    } else {
      // Delete all tokens for this user
      deleteQuery = 'DELETE FROM user_tokens WHERE user_id = $1';
      queryParams = [userId];
    }
    
    await client.query('BEGIN');
    const result = await client.query(deleteQuery, queryParams);
    await client.query('COMMIT');
    
    client.release();
    return res.status(200).json({ 
      message: 'Expo tokens deleted successfully',
      count: result.rowCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error deleting expo tokens:', error);
    return res.status(500).json({ message: 'Server error while deleting tokens' });
  }
};
    
