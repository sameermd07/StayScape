const mongoose = require('mongoose');

const connectDb = async () => {
    try {
        // Use the existing DB name exactly as created to avoid case conflicts
        await mongoose.connect('mongodb://127.0.0.1:27017/WonderLust');
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
};

module.exports = { connectDb };