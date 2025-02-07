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

        const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userQuery.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = userQuery.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ sub: user.id, email: user.email }, process.env.SECRET_KEY, {
            expiresIn: '1h',
        });

        return res.json({
            token,
            user_id: user.id,
            user_type: user.user_type,
        });
    } catch (error) {
        console.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Register user
exports.registerUser = async (req, res) => {
    try {
        const { name, surname, email, password, user_type } = req.body;

        const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (user_name, user_surname, user_email, user_password, user_type) VALUES ($1, $2, $3, $4, $5)',
            [name, surname, email, hashedPassword, user_type]
        );

        return res.json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Reset password (send code)
exports.resetPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const userQuery = 'SELECT id, email FROM users WHERE email = $1';
        const userResult = await pool.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address',
            });
        }

        const verificationCode = crypto.randomInt(1000, 9999).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const insertQuery = `
      INSERT INTO password_reset_tokens (user_id, user_email, reset_code, expires_at)
      VALUES ($1, $2, $3, $4)
    `;
        await pool.query(insertQuery, [userResult.rows[0].id, email, verificationCode, expiresAt]);

        await pool.query(
            'DELETE FROM password_reset_tokens WHERE email = $1 AND id NOT IN (SELECT id FROM password_reset_tokens WHERE email = $1 ORDER BY created_at DESC LIMIT 1)',
            [email]
        );

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
            res.status(500).json({
                success: false,
                message: 'Failed to send verification code email',
            });
        }
    } catch (error) {
        console.error('Error processing password reset request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request',
        });
    }
};

// Verify reset code
exports.verifyResetCode = async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {

        // Validate the new password
        // const passwordValidation = validatePassword(newPassword);
        // if (!passwordValidation.isValid) {
        //   return res.status(400).json({
        //     success: false,
        //     message: 'Password does not meet security requirements',
        //     error: 'INVALID_PASSWORD',
        //     passwordErrors: passwordValidation.errors,
        //   });
        // }

        const tokenQuery = `
    SELECT * FROM password_reset_tokens 
    WHERE email = $1 
    AND reset_code = $2 
    AND expires_at > CURRENT_TIMESTAMP 
    AND is_used = FALSE 
    ORDER BY created_at DESC 
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

        const updateQuery = 'UPDATE users SET password = $1 WHERE email = $2';
        await pool.query(updateQuery, [hashedPassword, email]);

        const markUsedQuery = 'UPDATE password_reset_tokens SET is_used = TRUE WHERE id = $1';
        await pool.query(markUsedQuery, [tokenResult.rows[0].id]);

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