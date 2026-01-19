require('dotenv').config();

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 8000,

    // Database
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'site242557',
    DB_PASS: process.env.DB_PASS || '',
    DB_NAME: process.env.DB_NAME || 'mongo_site242557',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'artaround-dev-secret-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

    // OpenAI (Tier 3)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

    // Helpers
    isDev: () => env.NODE_ENV === 'development',
    isProd: () => env.NODE_ENV === 'production',
}