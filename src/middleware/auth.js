const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Secret key for JWT signing and verification
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-123';

// Debug flag
const DEBUG = true;

// Valid tokens store (in production, use Redis or a database)
const tokenStore = {
    tokens: new Map(),
    add(token, userData) {
        if (DEBUG) {
            console.log('\n=== Token Store: Add Token ===');
            console.log('Previous store size:', this.tokens.size);
            console.log('Previous tokens:', Array.from(this.tokens.keys()).map(t => t.substring(0, 20) + '...'));
        }

        this.tokens.set(token, {
            userData,
            createdAt: Date.now()
        });

        if (DEBUG) {
            console.log('Token added:', token.substring(0, 20) + '...');
            console.log('User data:', JSON.stringify(userData, null, 2));
            console.log('New store size:', this.tokens.size);
            console.log('Current tokens:', Array.from(this.tokens.keys()).map(t => t.substring(0, 20) + '...'));
        }
    },
    has(token) {
        if (DEBUG) {
            console.log('\n=== Token Store: Check Token ===');
            console.log('Store size:', this.tokens.size);
            console.log('Available tokens:', Array.from(this.tokens.keys()).map(t => t.substring(0, 20) + '...'));
            console.log('Checking token:', token.substring(0, 20) + '...');
        }

        const exists = this.tokens.has(token);

        if (DEBUG) {
            console.log('Token exists:', exists);
            if (!exists) {
                console.log('Token not found in store. Available tokens:');
                this.tokens.forEach((value, key) => {
                    console.log('- Token:', key.substring(0, 20) + '...');
                    console.log('  Created:', new Date(value.createdAt).toISOString());
                    console.log('  User:', JSON.stringify(value.userData));
                });
            }
        }
        return exists;
    },
    get(token) {
        if (DEBUG) {
            console.log('\n=== Token Store: Get Token Data ===');
            console.log('Token:', token.substring(0, 20) + '...');
        }

        const data = this.tokens.get(token);

        if (DEBUG) {
            console.log('Data found:', !!data);
            if (data) {
                console.log('User data:', JSON.stringify(data.userData, null, 2));
                console.log('Created at:', new Date(data.createdAt).toISOString());
            } else {
                console.log('Available tokens:');
                this.tokens.forEach((value, key) => {
                    console.log('- Token:', key.substring(0, 20) + '...');
                    console.log('  Created:', new Date(value.createdAt).toISOString());
                    console.log('  User:', JSON.stringify(value.userData));
                });
            }
        }
        return data;
    },
    remove(token) {
        if (DEBUG) {
            console.log('\n=== Token Store: Remove Token ===');
            console.log('Previous store size:', this.tokens.size);
            console.log('Removing token:', token.substring(0, 20) + '...');
        }

        this.tokens.delete(token);

        if (DEBUG) {
            console.log('New store size:', this.tokens.size);
            console.log('Remaining tokens:', Array.from(this.tokens.keys()).map(t => t.substring(0, 20) + '...'));
        }
    },
    clear() {
        if (DEBUG) {
            console.log('\n=== Token Store: Clear All Tokens ===');
            console.log('Previous store size:', this.tokens.size);
            console.log('Previous tokens:', Array.from(this.tokens.keys()).map(t => t.substring(0, 20) + '...'));
        }

        this.tokens.clear();

        if (DEBUG) {
            console.log('New store size:', this.tokens.size);
        }
    }
};

// Helper function to create SOAP fault response
const createSoapFaultResponse = (statusCode, faultType, message) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <soap:Fault>
            <faultcode>soap:${faultType}</faultcode>
            <faultstring>${message}</faultstring>
            <detail>
                <error>
                    <statusCode>${statusCode}</statusCode>
                    <type>${faultType}</type>
                    <message>${message}</message>
                </error>
            </detail>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>`;
};

// Helper function to create SOAP success response
const createSoapSuccessResponse = (operation, data) => {
    const response = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <tns:${operation}Response xmlns:tns="http://example.com/player-service">
            <statusCode>200</statusCode>
            <success>true</success>
            <message>Operation successful</message>
            ${data}
        </tns:${operation}Response>
    </soap:Body>
</soap:Envelope>`;
    return response;
};

// Authentication middleware
const authenticate = async (req, res, next) => {
    if (DEBUG) {
        console.log('\n=== Authentication Middleware Start ===');
        console.log('Request path:', req.path);
        console.log('Request method:', req.method);
        console.log('Content-Type:', req.headers['content-type']);
    }

    try {
        const authHeader = req.headers.authorization;
        if (DEBUG) console.log('Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'none');

        if (!authHeader) {
            if (DEBUG) console.log('Error: No authorization header');
            const response = createSoapFaultResponse(401, 'AuthenticationError', 'No authorization header provided');
            return res.status(401).type('application/xml').send(response);
        }

        if (authHeader.startsWith('Basic ')) {
            if (DEBUG) console.log('=== Basic Auth Processing ===');
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
            const [username, password] = credentials.split(':');

            if (DEBUG) {
                console.log('Username:', username);
                console.log('Password length:', password ? password.length : 0);
            }

            if (username === 'admin' && password === 'password123') {
                if (DEBUG) console.log('Basic auth successful');
                req.user = { username, role: 'admin' };
                return next();
            }

            if (DEBUG) console.log('Error: Invalid basic auth credentials');
            const response = createSoapFaultResponse(401, 'AuthenticationError', 'Invalid credentials');
            return res.status(401).type('application/xml').send(response);
        } else if (authHeader.startsWith('Bearer ')) {
            if (DEBUG) console.log('=== Bearer Token Processing ===');
            const token = authHeader.split(' ')[1];
            if (DEBUG) console.log('Token received:', token.substring(0, 20) + '...');

            if (!token) {
                if (DEBUG) console.log('Error: No token provided in Bearer auth');
                const response = createSoapFaultResponse(401, 'AuthenticationError', 'No token provided');
                return res.status(401).type('application/xml').send(response);
            }

            try {
                if (DEBUG) console.log('Attempting to verify JWT token with secret:', JWT_SECRET);
                const decoded = jwt.verify(token, JWT_SECRET);
                if (DEBUG) {
                    console.log('JWT Verification successful');
                    console.log('Decoded token payload:', JSON.stringify(decoded, null, 2));
                }

                if (DEBUG) console.log('Checking token in store...');
                if (!tokenStore.has(token)) {
                    if (DEBUG) console.log('Error: Token not found in token store');
                    const response = createSoapFaultResponse(401, 'AuthenticationError', 'Token not found or has been invalidated');
                    return res.status(401).type('application/xml').send(response);
                }

                const tokenData = tokenStore.get(token);
                if (DEBUG) console.log('Token data from store:', JSON.stringify(tokenData, null, 2));

                req.user = tokenData.userData;
                if (DEBUG) console.log('Authentication successful, user set:', JSON.stringify(req.user, null, 2));
                return next();
            } catch (err) {
                console.error('=== Token Verification Error ===');
                console.error('Error type:', err.name);
                console.error('Error message:', err.message);
                console.error('Stack trace:', err.stack);

                let response;
                if (err.name === 'JsonWebTokenError') {
                    response = createSoapFaultResponse(401, 'AuthenticationError', `Invalid token format: ${err.message}`);
                } else if (err.name === 'TokenExpiredError') {
                    tokenStore.remove(token);
                    response = createSoapFaultResponse(401, 'AuthenticationError', 'Token has expired');
                } else {
                    response = createSoapFaultResponse(401, 'AuthenticationError', err.message);
                }
                return res.status(401).type('application/xml').send(response);
            }
        }

        if (DEBUG) console.log('Error: Invalid authentication method');
        const response = createSoapFaultResponse(401, 'AuthenticationError', 'Invalid authentication method');
        return res.status(401).type('application/xml').send(response);
    } catch (error) {
        console.error('=== Authentication Error ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);

        const response = createSoapFaultResponse(401, 'AuthenticationError', error.message);
        return res.status(401).type('application/xml').send(response);
    }
};

// Function to generate JWT token
const generateToken = (user) => {
    if (DEBUG) {
        console.log('\n=== Token Generation Start ===');
        console.log('Generating token for user:', JSON.stringify(user, null, 2));
        console.log('Using JWT secret:', JWT_SECRET);
    }

    const token = jwt.sign(
        {
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    if (DEBUG) console.log('Generated token:', token.substring(0, 20) + '...');

    // Store token with user data
    tokenStore.add(token, user);

    return token;
};

// Function to invalidate token (logout)
const invalidateToken = (token) => {
    console.log('Invalidating token:', token);
    tokenStore.remove(token);
    console.log('Current tokens:', Array.from(tokenStore.tokens.keys()));
};

// Function to validate token without completing authentication
const validateToken = (token) => {
    try {
        if (!token) return false;
        const decoded = jwt.verify(token, JWT_SECRET);
        const tokenData = tokenStore.get(token);
        const isValid = tokenStore.has(token) && decoded.username === tokenData?.userData?.username;
        if (DEBUG) {
            console.log('Token validation check:');
            console.log('- Token exists in store:', tokenStore.has(token));
            console.log('- Decoded username:', decoded.username);
            console.log('- Stored username:', tokenData?.userData?.username);
            console.log('- Final result:', isValid);
        }
        return isValid;
    } catch (error) {
        console.error('Token validation error:', error);
        return false;
    }
};

module.exports = {
    authenticate,
    generateToken,
    invalidateToken,
    validateToken,
    createSoapFaultResponse,
    createSoapSuccessResponse
};