const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const env = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: parseInt(process.env.PORT, 10),

    // Database
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.DB_NAME,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,

    // OpenAI (Tier 3)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    // Helpers
    isDev: () => env.NODE_ENV === 'development',
    isProd: () => env.NODE_ENV === 'production',
};

// Validate required variables in production
if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required in production');
    }
}

module.exports = env;