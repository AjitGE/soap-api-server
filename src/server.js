const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { authenticate, createSoapFaultResponse } = require('./middleware/auth');
const playerRoutes = require('./routes/playerRoutes');

const app = express();

// Enable detailed logging
const DEBUG = true;

// Middleware to parse SOAP XML first
app.use(bodyParser.text({
    type: 'text/xml',
    limit: '5mb'
}));

// Request logging middleware
app.use((req, res, next) => {
    if (DEBUG) {
        console.log('\n=== Incoming Request ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Method:', req.method);
        console.log('URL:', req.url);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));

        // Log body only if it exists and is not empty
        if (req.body) {
            console.log('Body length:', req.body.length);
            console.log('Body preview:', req.body.substring(0, 500));
        } else {
            console.log('No body in request');
        }
    }
    next();
});

// CORS middleware
app.use((req, res, next) => {
    if (DEBUG) console.log('=== CORS Middleware ===');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        if (DEBUG) console.log('Handling OPTIONS request');
        return res.sendStatus(200);
    }
    next();
});

// Debug middleware before authentication
app.use('/soap/player', (req, res, next) => {
    if (DEBUG) {
        console.log('\n=== Pre-Auth Middleware ===');
        console.log('Request URL:', req.url);
        console.log('Request method:', req.method);
        console.log('Authorization header:', req.get('Authorization') ? req.get('Authorization').substring(0, 20) + '...' : 'none');
        console.log('Content-Type:', req.get('Content-Type'));
        console.log('Body available:', !!req.body);
        if (req.body) {
            console.log('Body type:', typeof req.body);
            console.log('Body preview:', req.body.substring(0, 200));
        }
    }
    next();
});

// Apply authentication middleware except for token generation
app.use('/soap/player', (req, res, next) => {
    if (DEBUG) console.log('\n=== Auth Middleware Check ===');

    // Check if body exists and is properly parsed
    if (!req.body) {
        console.error('No body found in request');
        return res.status(400).type('application/xml').send(createSoapFaultResponse(400, 'ValidationError', 'No body found in request'));
    }

    // Skip authentication for token generation requests
    if (req.body.includes('generateTokenRequest')) {
        if (DEBUG) console.log('Skipping auth for token generation');
        return next();
    }

    if (DEBUG) console.log('Applying authentication');
    return authenticate(req, res, next);
});

// Use routes
app.use('/soap/player', playerRoutes);

// Error handling middleware for SOAP faults
app.use((err, req, res, next) => {
    console.error('\n=== Error Handler ===');
    console.error('Error:', err);
    const statusCode = err.statusCode || 500;
    const faultType = err.type || 'ServerError';
    const message = err.message || 'Internal Server Error';

    const response = createSoapFaultResponse(statusCode, faultType, message);
    return res.status(statusCode).type('application/xml').send(response);
});

// Final error handler for unhandled errors
app.use((err, req, res, next) => {
    console.error('\n=== Unhandled Error ===');
    console.error('Error:', err);
    const response = createSoapFaultResponse(500, 'ServerError', 'Internal Server Error');
    return res.status(500).type('application/xml').send(response);
});

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

// Create HTTP server with error handling
const httpServer = http.createServer(app);

httpServer.on('error', (error) => {
    console.error('HTTP Server Error:', error);
    process.exit(1);
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`\n=== Server Started ===`);
    console.log(`HTTP SOAP server running on port ${HTTP_PORT}`);
    console.log('Debug mode:', DEBUG ? 'enabled' : 'disabled');
    console.log('Current timestamp:', new Date().toISOString());
    console.log('Process ID:', process.pid);
    console.log('Node.js version:', process.version);
    console.log('Platform:', process.platform);
});

// Create HTTPS server if certificates exist
try {
    const httpsOptions = {
        key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
        cert: fs.readFileSync(path.join(__dirname, '../certs/server.cert'))
    };
    const httpsServer = https.createServer(httpsOptions, app);

    httpsServer.on('error', (error) => {
        console.error('HTTPS Server Error:', error);
    });

    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS SOAP server running on port ${HTTPS_PORT}`);
    });
} catch (error) {
    console.log('HTTPS server not started (certificates not found)');
}

// Handle process errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;