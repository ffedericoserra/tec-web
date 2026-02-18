const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
    try {
        const uri = `mongodb://${env.DB_USER}:${env.DB_PASS}@${env.DB_HOST}/${env.DB_NAME}?authSource=admin`;
        await mongoose.connect(uri);
        console.log(`MongoDB connected to ${env.DB_HOST}/${env.DB_NAME}`)
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
}

const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('MongoDB disconnection error:', error.message);
    }
}

module.exports = {connectDB, disconnectDB}