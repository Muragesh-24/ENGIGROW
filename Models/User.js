const mongoose = require('mongoose');

// Define the schema for the user
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    college: {
        type: String,
        required: true,
    },
    interests: {
        type: [String], // An array of strings to store multiple interests
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Ensures that email is unique in the database
    },
});

// Create the model based on the schema
const User = mongoose.model('User', userSchema);

// Export the model for use in other parts of the app
module.exports = User;
