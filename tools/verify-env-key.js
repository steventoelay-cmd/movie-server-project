require('dotenv').config({ path: require('path').join(__dirname, '../env.for-ec2.upload') });
const { securityConfig } = require('../src/config/security.config');
console.log('loaded API_KEY length:', securityConfig.apiKey.length);
console.log('starts with jj352:', securityConfig.apiKey.startsWith('jj352'));
console.log('ends with slfjn:', securityConfig.apiKey.endsWith('slfjn'));
