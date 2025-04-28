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

        // Compare the input password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.user_password); // Updated to `user_password`

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate a JWT token
        const token = jwt.sign({ sub: user.user_id, email: user.user_email }, process.env.SECRET_KEY, {
            expiresIn: '1h',
        });

        // Respond with the token and user details
        return res.json({
            token,
            user_id: user.user_id,
            user_type: user.user_type,
        });
    } catch (error) {
        console.error('Error logging in user:', error);
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
        console.log('Starting password reset process for email:', email);
        
        const userQuery = 'SELECT user_id, user_email FROM users WHERE user_email = $1';
        const userResult = await pool.query(userQuery, [email]);
        console.log('User query result:', userResult.rows);

        if (userResult.rows.length === 0) {
            console.log('No user found with email:', email);
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address',
            });
        }

        const verificationCode = crypto.randomInt(1000, 9999).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        console.log('Generated verification code:', verificationCode);
        console.log('Token expires at:', expiresAt);

        // First, try to insert the new token
        try {
            console.log('Attempting to insert reset token...');
            console.log('Insert parameters:', {
                user_id: userResult.rows[0].user_id,
                email: email,
                code: verificationCode,
                expiresAt: expiresAt
            });

            // Check if table exists first
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'password_reset_tokens'
                );
            `);
            console.log('Table exists check:', tableCheck.rows[0].exists);

            if (!tableCheck.rows[0].exists) {
                console.log('Creating password_reset_tokens table...');
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
                console.log('Table created successfully');
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
            console.log('Insert result:', insertResult.rows);

            // Then delete old tokens for this user
            console.log('Deleting old tokens...');
            const deleteQuery = `
                DELETE FROM password_reset_tokens 
                WHERE user_email = $1 
                AND reset_token_id != $2
            `;
            const deleteResult = await pool.query(deleteQuery, [email, insertResult.rows[0].reset_token_id]);
            console.log('Delete result:', deleteResult);

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
                console.log('Verification email sent successfully to:', email);

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
    const client = await pool.connect(); // Get a dedicated connection
    console.log("It is inside addExpoToken api")

    try {
        const { expoToken } = req.body;
        const userId = req.user.sub;

        console.log(`Expo token is: ${expoToken}`)
        console.log(`User id is: ${userId}`)

        await client.query('BEGIN'); // Start transaction

        // Check if expo_token already exists
        const existingUser = await client.query('SELECT user_expo_token FROM users WHERE user_id = $1', [userId]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK'); // Rollback transaction if token exists
            return res.status(400).json({ message: 'Token already exists.' });
        }

        // Insert into users table
        const userResult = await client.query(
            'INSERT INTO users (user_expo_token) VALUES ($1) RETURNING *;'
            [expoToken]
        );


        await client.query('COMMIT'); // Commit the transaction
        client.release(); // Release the connection

        return res.json({ message: 'Token inserted successfully' });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction if an error occurs
        client.release(); // Release the connection
        console.error('Error inserting token:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
