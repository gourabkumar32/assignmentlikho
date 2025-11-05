// Set SSL/TLS environment variables
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.TLS_MIN_VERSION = 'TLSv1.2';

// Import and run the main server
require('./server.js');